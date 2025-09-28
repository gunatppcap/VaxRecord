// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, euint64, ebool, externalEuint32, externalEuint64, externalEbool} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title MaskedVaccine — 疫苗接种加密记录（MVP）
/// @notice 使用 FHEVM 将敏感字段以密文形式上链，提供最小权限的 ACL 授权与解密审计事件
/// @dev 仅存储密文与元数据；明文永不上链。合约不直接输出明文，仅发出解密请求/证明事件。
contract MaskedVaccine is SepoliaConfig {
    // 概念：记录状态（Active/Revoked）
    enum RecordStatus { Active, Revoked }

    // ACL 授权范围（示例：按字段位掩码组合，前端/链下约定语义）
    // 例如 bit0=vaccineType, bit1=date, bit2=provider, bit3=batch, bit4=notes
    // 使用 euint32 存储 scope 作为密文范围表达（可按需扩展）

    struct VaccineRecord {
        address patient;               // 患者地址（或其哈希，MVP 直接用地址）
        euint64 encryptedPointer;      // 密文指针/内容（可用于引用链下存储标识）
        bytes32 providerHash;          // 非敏感元数据：接种方哈希
        uint64 createdAt;              // 时间戳（区块时间）
        RecordStatus status;           // 记录状态
    }

    struct VerifierAuthorization {
        uint256 recordId;              // 记录 ID
        address verifier;              // 验证方地址
        euint32 scope;                 // 授权的字段范围（密文位掩码）
        uint64 expiry;                 // 到期时间（秒）
        bool active;                   // 是否有效
    }

    // 事件（审计）
    event RecordCreated(uint256 indexed recordId, address indexed patient, bytes32 providerHash);
    event RecordRevoked(uint256 indexed recordId, address indexed patient);
    event VerifierAuthorized(uint256 indexed authId, uint256 indexed recordId, address indexed verifier, uint64 expiry, bytes scopeCipherHandle);
    event VerifierRevoked(uint256 indexed authId, uint256 indexed recordId, address indexed verifier);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed recordId, address indexed verifier, bytes scopeCipherHandle);
    event DecryptionResultStored(uint256 indexed proofId, uint256 indexed recordId, address indexed verifier, bytes32 proofHash, bytes proofMeta);

    // 存储
    uint256 public nextRecordId = 1;
    uint256 public nextAuthId = 1;
    uint256 public nextRequestId = 1;
    uint256 public nextProofId = 1;

    mapping(uint256 => VaccineRecord) public records;           // recordId => VaccineRecord
    mapping(uint256 => VerifierAuthorization) public auths;     // authId => VerifierAuthorization
    // recordId + verifier => 最新授权 id（便于快速查询）
    mapping(uint256 => mapping(address => uint256)) public latestAuthIdByRecordAndVerifier;

    // 基本修饰符
    modifier onlyPatient(uint256 recordId) {
        require(records[recordId].patient == msg.sender, "Not record owner");
        _;
    }

    // 创建记录：前端先本地加密，传入密文句柄与 inputProof
    function createRecord(
        externalEuint64 encryptedPointerExt,
        bytes calldata inputProof,
        bytes32 providerHash
    ) external returns (uint256 recordId) {
        euint64 encryptedPointer = FHE.fromExternal(encryptedPointerExt, inputProof);

        recordId = nextRecordId++;
        records[recordId] = VaccineRecord({
            patient: msg.sender,
            encryptedPointer: encryptedPointer,
            providerHash: providerHash,
            createdAt: uint64(block.timestamp),
            status: RecordStatus.Active
        });

        // 允许本合约与患者对该密文进行后续操作/授权（根据 FHEVM 要求）
        FHE.allowThis(encryptedPointer);
        FHE.allow(encryptedPointer, msg.sender);

        emit RecordCreated(recordId, msg.sender, providerHash);
    }

    // 撤销记录（标记为 Revoked，不删除历史）
    function revokeRecord(uint256 recordId) external onlyPatient(recordId) {
        require(records[recordId].status == RecordStatus.Active, "Already revoked");
        records[recordId].status = RecordStatus.Revoked;
        emit RecordRevoked(recordId, msg.sender);
    }

    // 授权验证方读取指定 scope（密文表达）
    function authorizeVerifier(
        uint256 recordId,
        address verifier,
        externalEuint32 scopeExt,
        bytes calldata inputProof,
        uint64 expiry
    ) external onlyPatient(recordId) returns (uint256 authId) {
        require(records[recordId].status == RecordStatus.Active, "Record not active");
        require(verifier != address(0), "Invalid verifier");
        require(expiry > block.timestamp, "Invalid expiry");

        euint32 scope = FHE.fromExternal(scopeExt, inputProof);

        authId = nextAuthId++;
        auths[authId] = VerifierAuthorization({
            recordId: recordId,
            verifier: verifier,
            scope: scope,
            expiry: expiry,
            active: true
        });
        latestAuthIdByRecordAndVerifier[recordId][verifier] = authId;

        // 允许必要的访问者（合约自身 + 患者 + 验证方）后续对 scope 密文进行验证/转换
        FHE.allowThis(scope);
        FHE.allow(scope, msg.sender);
        FHE.allow(scope, verifier);

        // 事件中带出密文句柄（仅句柄，不泄露明文）用于 KMS 侧拉取/验证
        emit VerifierAuthorized(authId, recordId, verifier, expiry, _encodeHandle(scope));
    }

    function revokeAuthorization(uint256 authId) external {
        VerifierAuthorization storage a = auths[authId];
        require(a.recordId != 0, "Auth not found");
        require(records[a.recordId].patient == msg.sender, "Not record owner");
        require(a.active, "Already inactive");
        a.active = false;
        emit VerifierRevoked(authId, a.recordId, a.verifier);
    }

    // 验证方向合约发起解密请求（仅记录事件，由 KMS 监听处理）
    function requestDecryption(uint256 recordId, externalEuint32 scopeExt, bytes calldata inputProof) external returns (uint256 requestId) {
        require(records[recordId].status == RecordStatus.Active, "Record not active");
        // 基础 ACL：需存在有效授权
        uint256 authId = latestAuthIdByRecordAndVerifier[recordId][msg.sender];
        require(authId != 0 && auths[authId].active, "Not authorized");
        require(auths[authId].expiry > block.timestamp, "Authorization expired");

        // 传入的 scope 必须是授权 scope 的子集（密文域比较在 KMS 侧进行，链上只作事件记录）
        euint32 scope = FHE.fromExternal(scopeExt, inputProof);

        requestId = nextRequestId++;
        emit DecryptionRequested(requestId, recordId, msg.sender, _encodeHandle(scope));
    }

    // KMS 将解密证明写回链上（不含明文）
    function storeDecryptionProof(
        uint256 recordId,
        address verifier,
        bytes32 proofHash,
        bytes calldata proofMeta
    ) external returns (uint256 proofId) {
        // MVP 简化：任何人都可写入证明（演示用）；生产需限制为 KMS 多签或治理地址
        require(records[recordId].patient != address(0), "Record not found");
        proofId = nextProofId++;
        emit DecryptionResultStored(proofId, recordId, verifier, proofHash, proofMeta);
    }

    // 视图：返回元数据（不返回明文）
    function getEncryptedRecord(uint256 recordId)
        external
        view
        returns (
            address patient,
            bytes memory encryptedPointerHandle,
            bytes32 providerHash,
            uint64 createdAt,
            RecordStatus status
        )
    {
        VaccineRecord storage r = records[recordId];
        require(r.patient != address(0), "Record not found");
        return (
            r.patient,
            _encodeHandle(r.encryptedPointer),
            r.providerHash,
            r.createdAt,
            r.status
        );
    }

    // 视图：是否存在有效授权
    function isAuthorized(uint256 recordId, address verifier) external view returns (bool) {
        uint256 authId = latestAuthIdByRecordAndVerifier[recordId][verifier];
        if (authId == 0) return false;
        VerifierAuthorization storage a = auths[authId];
        return a.active && a.expiry > block.timestamp;
    }

    // 将 euintX 句柄编码为 bytes（供事件/返回值引用），不暴露明文
    function _encodeHandle(ebool v) internal pure returns (bytes memory) { return abi.encodePacked(FHE.toBytes32(v)); }
    function _encodeHandle(euint32 v) internal pure returns (bytes memory) { return abi.encodePacked(FHE.toBytes32(v)); }
    function _encodeHandle(euint64 v) internal pure returns (bytes memory) { return abi.encodePacked(FHE.toBytes32(v)); }
}



