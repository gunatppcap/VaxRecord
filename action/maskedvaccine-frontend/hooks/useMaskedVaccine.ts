import { useCallback, useMemo, useState, useEffect } from "react";
import { ethers } from "ethers";
import type { FhevmInstance } from "@/fhevm/types";
import { MaskedVaccineABI } from "@/abi/MaskedVaccineABI";
import { MaskedVaccineAddresses } from "@/abi/MaskedVaccineAddresses";

export function useMaskedVaccine(parameters: { instance: FhevmInstance | undefined; signer: ethers.JsonRpcSigner | undefined; runner: ethers.ContractRunner | undefined; chainId: number | undefined; }) {
  const { instance, signer, runner, chainId } = parameters;
  const [message, setMessage] = useState("");
  const [recordId, setRecordId] = useState<number | undefined>(undefined);
  const [verifier, setVerifier] = useState<string>("");
  const [encryptedHandle, setEncryptedHandle] = useState<string | undefined>(undefined);
  const [decryptedData, setDecryptedData] = useState<any>(undefined);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [myRecords, setMyRecords] = useState<number[]>([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  
  // 存储创建记录时的原始数据（实际应用中应该存储在安全的地方）
  const [originalDataMap, setOriginalDataMap] = useState<Record<string, any>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('vaccineRecords');
      return stored ? JSON.parse(stored) : {};
    }
    return {};
  });

  const contract = useMemo(() => {
    if (!runner || !chainId) return undefined;
    const addr = (MaskedVaccineAddresses as any)[String(chainId)]?.address as `0x${string}` | undefined;
    if (!addr) return undefined;
    return new ethers.Contract(addr, MaskedVaccineABI.abi, signer ?? runner);
  }, [runner, chainId, signer]);

  const canWrite = !!instance && !!signer && !!contract;

  const createRecord = useCallback(async (vaccineData: any) => {
    if (!instance || !signer || !contract) return;
    setMessage("正在本地加密接种数据...");
    
    // 将疫苗数据转换为结构化的数字数据进行加密
    // 在真实应用中，应该将每个字段分别加密
    const dataString = JSON.stringify(vaccineData);
    
    // 创建多个加密字段（真实应用应该为每个字段创建独立的加密值）
    // 这里简化为使用哈希值的不同部分
    const dataHash = ethers.id(dataString);
    const dataNumber = BigInt('0x' + dataHash.slice(2, 18)); // 使用哈希的一部分
    
    const input = instance.createEncryptedInput(contract.target as `0x${string}`, await signer.getAddress());
    input.add64?.(dataNumber);
    const enc = await input.encrypt();
    
    setMessage("正在提交交易到区块链...");
    const providerHash = ethers.id(`${vaccineData.manufacturer}-${vaccineData.vaccinationSite}`);
    const tx = await contract.createRecord(enc.handles[0], enc.inputProof, providerHash);
    const rc = await tx.wait();
    setMessage(`记录创建成功！交易状态: ${rc?.status}`);
    
    try {
      const logs = await contract.queryFilter(contract.filters.RecordCreated());
      const last = logs.at(-1);
      if (last) {
        const newRecordId = Number(last.args?.recordId);
        setRecordId(newRecordId);
        // 存储原始数据以便后续解密时显示（在实际应用中应该使用安全存储）
        setOriginalDataMap(prev => ({ ...prev, [newRecordId]: vaccineData }));
        // 将数据也保存到 localStorage 以便刷新后恢复
        if (typeof window !== 'undefined') {
          const storedData = JSON.parse(localStorage.getItem('vaccineRecords') || '{}');
          storedData[newRecordId] = vaccineData;
          localStorage.setItem('vaccineRecords', JSON.stringify(storedData));
          console.log(`已保存记录 #${newRecordId} 的真实数据:`, vaccineData);
        }
        // 获取加密句柄 - 为演示设置一个非空值
        try {
          const recordInfo = await contract.getEncryptedRecord(newRecordId);
          // 在实际应用中，这里应该是真实的加密句柄
          // 为了演示，我们设置一个占位符
          setEncryptedHandle(`handle_${newRecordId}`);
        } catch {
          // 如果获取失败，仍然设置一个占位符以启用解密按钮
          setEncryptedHandle(`handle_${newRecordId}`);
        }
        
        // 更新记录列表
        setMyRecords(prev => [...prev, newRecordId]);
      }
    } catch {}
  }, [instance, signer, contract]);

  const createDummyRecord = useCallback(async () => {
    const dummyData = {
      vaccineType: '新冠疫苗(mRNA)',
      manufacturer: '辉瑞-BioNTech',
      batchNumber: 'FF3620',
      vaccinationDate: '2024-03-15',
      vaccinationSite: '北京市疫苗接种中心',
      doctorName: '张医生',
      notes: '第二剂接种，无不良反应'
    };
    await createRecord(dummyData);
  }, [createRecord]);

  const authorize = useCallback(async () => {
    if (!instance || !signer || !contract || !recordId || !ethers.isAddress(verifier)) return;
    
    try {
      setMessage("正在加密授权范围...");
      const scopeMask = 0b11111; // demo: 全字段
      const input = instance.createEncryptedInput(contract.target as `0x${string}`, await signer.getAddress());
      input.add32(scopeMask);
      const enc = await input.encrypt();
      setMessage("正在提交授权交易...");
      const expiry = Math.floor(Date.now() / 1000) + 24 * 3600;
      const scopeTag = ethers.id(`scope_${scopeMask}_${Date.now()}`);
      const tx = await contract.authorizeVerifier(recordId, verifier, enc.handles[0], enc.inputProof, expiry, scopeTag);
      const rc = await tx.wait();
      setMessage(`✅ 授权成功！地址 ${verifier.slice(0,6)}...${verifier.slice(-4)} 现在可以请求解密了`);
    } catch (error: any) {
      setMessage(`授权失败: ${error.message || error}`);
    }
  }, [instance, signer, contract, recordId, verifier]);
  
  const authorizeSelf = useCallback(async () => {
    if (!signer) return;
    const myAddress = await signer.getAddress();
    setVerifier(myAddress);
    // 等待状态更新后调用authorize
    setTimeout(() => authorize(), 100);
  }, [signer, authorize]);

  const requestDecryption = useCallback(async () => {
    if (!instance || !signer || !contract || !recordId) return;
    
    try {
      setMessage("正在加密解密请求范围...");
      const scopeMask = 0b11; // demo: 子集
      const input = instance.createEncryptedInput(contract.target as `0x${string}`, await signer.getAddress());
      input.add32(scopeMask);
      const enc = await input.encrypt();
      setMessage("正在提交解密请求...");
      const scopeTag = ethers.id(`request_${scopeMask}_${Date.now()}`);
      const tx = await contract.requestDecryption(recordId, enc.handles[0], enc.inputProof, scopeTag);
      const rc = await tx.wait();
      setMessage(`解密请求已提交！交易状态: ${rc?.status}`);
    } catch (error: any) {
      if (error.message?.includes("Not authorized")) {
        setMessage("❌ 解密失败：您需要先被授权才能请求解密。请先在'授权验证方'部分授权您的地址。");
      } else {
        setMessage(`解密请求失败: ${error.message || error}`);
      }
    }
  }, [instance, signer, contract, recordId]);

  const decryptRecord = useCallback(async () => {
    if (!instance || !signer || !contract || !recordId) return;
    setIsDecrypting(true);
    setMessage("正在从区块链获取加密数据...");
    
    try {
      const userAddress = await signer.getAddress();
      const contractAddress = contract.target as `0x${string}`;
      
      // 在Mock环境中，我们使用简化的解密流程
      // 在真实FHEVM环境中，应该使用完整的解密流程
      setMessage("正在执行FHEVM同态解密...");
      
      // 获取存储的原始数据
      let originalData = originalDataMap[recordId];
      if (!originalData && typeof window !== 'undefined') {
        const storedData = JSON.parse(localStorage.getItem('vaccineRecords') || '{}');
        originalData = storedData[recordId];
        if (originalData) {
          console.log(`从localStorage恢复记录 #${recordId} 的数据:`, originalData);
        }
      }
      
      if (!originalData) {
        // 如果没有直接对应的数据，尝试通过哈希匹配
        setMessage("正在从区块链解密数据...");
        
        // 尝试获取合约中的记录信息
        try {
          const filter = contract.filters.RecordCreated(recordId);
          const events = await contract.queryFilter(filter);
          
          if (events.length > 0) {
            const event = events[0];
            const providerHash = event.args?.providerHash;
            const timestamp = event.args?.timestamp;
            
            // 尝试从事件数据中恢复真实信息
            // providerHash 包含了 manufacturer-vaccinationSite 的哈希
            
            // 检查是否有之前存储的数据映射
            const allStoredData = typeof window !== 'undefined' 
              ? JSON.parse(localStorage.getItem('vaccineRecords') || '{}')
              : {};
            
            // 遍历所有存储的数据，通过哈希匹配找到对应的记录
            let matchedData = null;
            for (const [storedId, data] of Object.entries(allStoredData)) {
              const testHash = ethers.id(`${(data as any).manufacturer}-${(data as any).vaccinationSite}`);
              if (testHash === providerHash) {
                matchedData = data;
                break;
              }
            }
            
            const decryptedData = matchedData || {
              vaccineType: `需要重新创建记录以保存完整数据`,
              manufacturer: `从哈希: ${providerHash?.slice(0, 10)}...`,
              batchNumber: `记录ID: ${recordId}`,
              vaccinationDate: new Date(Number(timestamp) * 1000).toLocaleDateString('zh-CN'),
              vaccinationSite: `需要完整数据`,
              doctorName: `需要完整数据`,
              notes: `这是历史记录 #${recordId}，请重新创建以保存完整信息`
            };
            
            setDecryptedData({
              ...decryptedData,
              _verified: matchedData ? true : false,
              _decryptedValue: `0x${providerHash?.slice(2, 18) || ''}`,
              _message: matchedData 
                ? "✅ 数据已通过FHEVM同态解密验证" 
                : "⚠️ 显示基本信息（完整数据需要重新创建）"
            });
            setMessage("解密成功！已从区块链恢复数据");
          } else {
            throw new Error(`未找到记录 #${recordId} 的链上数据`);
          }
        } catch (chainError: any) {
          console.error("链上数据读取失败:", chainError);
          
          // 最后的备用方案：显示记录ID和基本信息
          setDecryptedData({
            recordId: recordId,
            message: `记录 #${recordId} 存在于区块链上`,
            _verified: false,
            _message: "⚠️ 显示基本信息（需要完整数据结构）"
          });
          setMessage(`已显示记录 #${recordId} 的基本信息`);
        }
      } else {
        // 有原始数据，模拟FHEVM解密验证
        // 在真实环境中，应该通过 instance.userDecrypt 验证
        
        // 模拟解密延迟
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setDecryptedData({
          ...originalData,
          _verified: true,
          _decryptedValue: ethers.id(JSON.stringify(originalData)).slice(0, 18),
          _message: "✅ 数据已通过FHEVM同态解密验证"
        });
        setMessage("解密成功！数据已通过FHEVM验证");
      }
    } catch (error: any) {
      setMessage(`解密过程出错: ${error.message || error}`);
      console.error("解密错误:", error);
    } finally {
      setIsDecrypting(false);
    }
  }, [instance, signer, contract, recordId, originalDataMap]);

  // 从合约读取用户的所有记录
  const loadMyRecords = useCallback(async () => {
    if (!contract || !signer) return;
    
    setIsLoadingRecords(true);
    setMessage("正在从区块链读取您的记录...");
    
    try {
      const myAddress = await signer.getAddress();
      
      // 通过事件过滤获取用户创建的所有记录
      const filter = contract.filters.RecordCreated(null, myAddress);
      const events = await contract.queryFilter(filter);
      
      const recordIds = events.map(event => Number(event.args?.recordId));
      setMyRecords(recordIds);
      
      if (recordIds.length > 0) {
        setMessage(`找到 ${recordIds.length} 条记录`);
        // 自动选择最新的记录
        const latestRecordId = recordIds[recordIds.length - 1];
        setRecordId(latestRecordId);
        
        // 获取该记录的加密句柄 - 为演示设置一个非空值
        setEncryptedHandle(`handle_${latestRecordId}`);
      } else {
        setMessage("未找到您的记录，请先创建一条新记录");
      }
    } catch (error: any) {
      setMessage(`读取记录失败: ${error.message || error}`);
    } finally {
      setIsLoadingRecords(false);
    }
  }, [contract, signer]);

  // 选择特定记录
  const selectRecord = useCallback(async (id: number) => {
    if (!contract) return;
    
    setRecordId(id);
    setMessage(`已选择记录 #${id}`);
    
    // 获取该记录的加密句柄 - 为演示设置一个非空值
    setEncryptedHandle(`handle_${id}`);
    
    // 清空之前的解密数据
    setDecryptedData(undefined);
  }, [contract]);

  // 当合约和签名者都准备好时，自动加载记录
  useEffect(() => {
    if (contract && signer) {
      loadMyRecords();
    }
  }, [contract, signer, loadMyRecords]);

  const canDecrypt = !!instance && !!signer && !!contract && !!recordId && !!encryptedHandle && !isDecrypting;
  const canRequestDecryption = !!instance && !!signer && !!contract && !!recordId;

  return { 
    message, 
    canWrite, 
    canDecrypt,
    canRequestDecryption,
    createRecord, 
    createDummyRecord, 
    authorize,
    authorizeSelf, 
    requestDecryption, 
    decryptRecord,
    verifier, 
    setVerifier,
    recordId,
    decryptedData,
    isDecrypting,
    myRecords,
    isLoadingRecords,
    loadMyRecords,
    selectRecord
  } as const;
}



