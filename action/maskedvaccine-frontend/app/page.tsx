"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { useFhevm } from "@/fhevm/useFhevm";
import { useMaskedVaccine } from "@/hooks/useMaskedVaccine";
import { StatusCard } from "@/components/StatusCard";
import { 
  ShieldCheckIcon, 
  DocumentAddIcon, 
  UserGroupIcon, 
  LockClosedIcon, 
  EyeIcon, 
  HeartIcon, 
  SparklesIcon,
  CheckCircleIcon,
  RefreshIcon
} from "@/components/Icons";

export default function Home() {
  const [provider, setProvider] = useState<ethers.Eip1193Provider | undefined>();
  const [chainId, setChainId] = useState<number | undefined>(undefined);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | undefined>();
  const [runner, setRunner] = useState<ethers.ContractRunner | undefined>();
  const [isConnecting, setIsConnecting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [vaccineData, setVaccineData] = useState({
    vaccineType: '',
    manufacturer: '',
    batchNumber: '',
    vaccinationDate: '',
    vaccinationSite: '',
    doctorName: '',
    notes: ''
  });

  const connectWallet = async () => {
    setIsConnecting(true);
    try {
      const anyWin = window as any;
      if (anyWin.ethereum) {
        await anyWin.ethereum.request({ method: 'eth_requestAccounts' });
        const p = anyWin.ethereum as ethers.Eip1193Provider;
        setProvider(p);
        const web3p = new ethers.BrowserProvider(p);
        const s = await web3p.getSigner();
        setSigner(s);
        setRunner(web3p);
        const id = await web3p.getNetwork();
        setChainId(Number(id.chainId));
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const { instance, status, error } = useFhevm({ 
    provider, 
    chainId, 
    initialMockChains: { 31337: "http://127.0.0.1:8545" }, 
    enabled: true 
  });

  const mv = useMaskedVaccine({ instance, signer, runner, chainId });

  if (!provider || !signer) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '16px'
      }}>
        <div className="card slide-up" style={{ 
          maxWidth: '400px', 
          width: '100%', 
          textAlign: 'center' 
        }}>
          <div className="medical-gradient icon-lg" style={{ 
            margin: '0 auto 24px' 
          }}>
            <ShieldCheckIcon className="icon-lg" style={{ color: 'white' }} />
          </div>
          <h1 className="title">MaskedVaccine</h1>
          <p className="subtitle">疫苗接种加密记录系统</p>
          <p style={{ 
            fontSize: '14px', 
            color: '#6b7280', 
            marginBottom: '32px' 
          }}>
            基于 FHEVM 的隐私优先设计，确保您的接种记录安全加密存储
          </p>
          <button 
            className="btn btn-primary"
            onClick={connectWallet}
            disabled={isConnecting}
            style={{ width: '100%' }}
          >
            {isConnecting ? (
              <>
                <div className="loading-spinner" />
                <span>连接中...</span>
              </>
            ) : (
              <>
                <SparklesIcon />
                <span>连接钱包</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', padding: '16px' }}>
      <div className="container">
        {/* Header */}
        <div style={{ marginBottom: '32px' }}>
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div className="medical-gradient" style={{ 
                width: '48px', 
                height: '48px', 
                borderRadius: '12px' 
              }}>
                <ShieldCheckIcon style={{ color: 'white', width: '24px', height: '24px' }} />
              </div>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>
                  MaskedVaccine
                </h1>
                <p style={{ color: '#6b7280' }}>疫苗接种加密记录系统</p>
              </div>
            </div>
          </div>
        </div>

        {/* My Records */}
        {mv.myRecords.length > 0 && (
          <section style={{ marginBottom: '32px' }}>
            <h2 className="section-title">
              <DocumentAddIcon className="icon" style={{ color: '#0284c7' }} />
              我的记录
            </h2>
            <div className="card">
              <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                从区块链读取到您的接种记录：
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {mv.myRecords.map(id => (
                  <button
                    key={id}
                    className={`btn ${mv.recordId === id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => mv.selectRecord(id)}
                    style={{ minWidth: '100px' }}
                  >
                    记录 #{id}
                    {mv.recordId === id && ' ✓'}
                  </button>
                ))}
              </div>
              <button
                className="btn btn-secondary"
                onClick={() => mv.loadMyRecords()}
                disabled={mv.isLoadingRecords}
                style={{ marginTop: '12px' }}
              >
                {mv.isLoadingRecords ? (
                  <>
                    <div className="loading-spinner" />
                    <span>刷新中...</span>
                  </>
                ) : (
                  <>
                    <RefreshIcon className="icon" />
                    <span>刷新记录列表</span>
                  </>
                )}
              </button>
            </div>
          </section>
        )}

        {/* System Status */}
        <section style={{ marginBottom: '32px' }}>
          <h2 className="section-title">
            <HeartIcon className="icon" style={{ color: '#0284c7' }} />
            系统状态
          </h2>
          <div className="status-grid">
            <StatusCard
              title="FHEVM 实例"
              status={instance ? 'ready' : status === 'loading' ? 'loading' : 'error'}
              value={instance ? '已连接' : status}
              description="同态加密虚拟机"
            />
            <StatusCard
              title="链 ID"
              status={chainId ? 'ready' : 'idle'}
              value={chainId}
              description="区块链网络标识"
            />
            <StatusCard
              title="合约状态"
              status={mv.canWrite ? 'ready' : 'idle'}
              value={mv.canWrite ? '可用' : '不可用'}
              description="智能合约连接状态"
            />
            <StatusCard
              title="钱包地址"
              status={signer ? 'ready' : 'idle'}
              value={signer ? `${signer.address.slice(0, 6)}...${signer.address.slice(-4)}` : '未连接'}
              description="当前连接的钱包"
            />
          </div>
          {error && (
            <div className="message message-error">
              {error.message}
            </div>
          )}
        </section>

        {/* Create Record */}
        <section style={{ marginBottom: '32px' }}>
          <h2 className="section-title">
            <DocumentAddIcon className="icon" style={{ color: '#0284c7' }} />
            步骤1: 创建接种记录
          </h2>
          <div className="card">
            {!showCreateForm ? (
              <>
                <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                  创建一个加密的疫苗接种记录。所有敏感信息将在本地加密后上链存储。
                </p>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => setShowCreateForm(true)}
                    disabled={!mv.canWrite}
                  >
                    <DocumentAddIcon />
                    <span>填写接种信息</span>
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => mv.createDummyRecord()}
                    disabled={!mv.canWrite || mv.message.includes('正在')}
                  >
                    {mv.message.includes('正在') ? (
                      <>
                        <div className="loading-spinner" />
                        <span>处理中...</span>
                      </>
                    ) : (
                      <span>创建示例记录</span>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '600' }}>疫苗接种信息</h3>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      fontSize: '24px', 
                      cursor: 'pointer',
                      color: '#6b7280'
                    }}
                  >
                    ×
                  </button>
                </div>
                
                <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                      疫苗类型 *
                    </label>
                    <input
                      type="text"
                      placeholder="如：新冠疫苗(mRNA)"
                      value={vaccineData.vaccineType}
                      onChange={(e) => setVaccineData({...vaccineData, vaccineType: e.target.value})}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                      生产厂家 *
                    </label>
                    <input
                      type="text"
                      placeholder="如：辉瑞-BioNTech"
                      value={vaccineData.manufacturer}
                      onChange={(e) => setVaccineData({...vaccineData, manufacturer: e.target.value})}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                      批号
                    </label>
                    <input
                      type="text"
                      placeholder="如：FF3620"
                      value={vaccineData.batchNumber}
                      onChange={(e) => setVaccineData({...vaccineData, batchNumber: e.target.value})}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                      接种日期 *
                    </label>
                    <input
                      type="date"
                      value={vaccineData.vaccinationDate}
                      onChange={(e) => setVaccineData({...vaccineData, vaccinationDate: e.target.value})}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                      接种地点 *
                    </label>
                    <input
                      type="text"
                      placeholder="如：北京市疫苗接种中心"
                      value={vaccineData.vaccinationSite}
                      onChange={(e) => setVaccineData({...vaccineData, vaccinationSite: e.target.value})}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                      接种医生
                    </label>
                    <input
                      type="text"
                      placeholder="如：张医生"
                      value={vaccineData.doctorName}
                      onChange={(e) => setVaccineData({...vaccineData, doctorName: e.target.value})}
                      className="input"
                    />
                  </div>
                </div>
                
                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', marginBottom: '6px' }}>
                    备注
                  </label>
                  <textarea
                    placeholder="如：第二剂接种，无不良反应"
                    value={vaccineData.notes}
                    onChange={(e) => setVaccineData({...vaccineData, notes: e.target.value})}
                    className="input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                  />
                </div>
                
                <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      if (vaccineData.vaccineType && vaccineData.manufacturer && vaccineData.vaccinationDate && vaccineData.vaccinationSite) {
                        mv.createRecord(vaccineData);
                        setShowCreateForm(false);
                        // 重置表单
                        setVaccineData({
                          vaccineType: '',
                          manufacturer: '',
                          batchNumber: '',
                          vaccinationDate: '',
                          vaccinationSite: '',
                          doctorName: '',
                          notes: ''
                        });
                      } else {
                        alert('请填写必填字段（标有*的字段）');
                      }
                    }}
                    disabled={!mv.canWrite || mv.message.includes('正在')}
                  >
                    {mv.message.includes('正在') ? (
                      <>
                        <div className="loading-spinner" />
                        <span>加密上链中...</span>
                      </>
                    ) : (
                      <>
                        <LockClosedIcon />
                        <span>加密并创建记录</span>
                      </>
                    )}
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowCreateForm(false)}
                    disabled={mv.message.includes('正在')}
                  >
                    取消
                  </button>
                </div>
              </div>
            )}
            
            {mv.message && (
              <div className={`message ${
                mv.message.includes('成功') ? 'message-success' : 'message-info'
              }`}>
                {mv.message}
              </div>
            )}
          </div>
        </section>

        {/* Authorize Verifier */}
        <section style={{ marginBottom: '32px' }}>
          <h2 className="section-title">
            <UserGroupIcon className="icon" style={{ color: '#0284c7' }} />
            步骤2: 授权验证方
          </h2>
          <div className="card">
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              授权特定地址查看您的加密记录。被授权方需要您的显式许可才能请求解密。
            </p>
            
            {!mv.recordId ? (
              <div style={{ 
                padding: '12px', 
                background: '#fef3c7', 
                border: '1px solid #fbbf24',
                borderRadius: '8px',
                color: '#92400e'
              }}>
                ⚠️ 请先创建一个接种记录
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '500', 
                    marginBottom: '8px' 
                  }}>
                    验证方地址
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={mv.verifier}
                    onChange={(e) => mv.setVerifier(e.target.value)}
                    className="input"
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => mv.authorize()}
                    disabled={!mv.canWrite || !mv.recordId || !mv.verifier || !ethers.isAddress(mv.verifier) || mv.message.includes('正在')}
                  >
                    {mv.message.includes('正在') && mv.message.includes('授权') ? (
                      <>
                        <div className="loading-spinner" />
                        <span>处理中...</span>
                      </>
                    ) : (
                      <>
                        <LockClosedIcon />
                        <span>授权访问</span>
                      </>
                    )}
                  </button>
                  
                  <button
                    className="btn btn-secondary"
                    onClick={() => mv.authorizeSelf()}
                    disabled={!mv.canWrite || !mv.recordId}
                  >
                    <UserGroupIcon />
                    <span>授权自己（用于演示）</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </section>

        {/* Request Decryption */}
        <section style={{ marginBottom: '32px' }}>
          <h2 className="section-title">
            <EyeIcon className="icon" style={{ color: '#0284c7' }} />
            步骤3: 解密请求
          </h2>
          <div className="card">
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              作为被授权的验证方，您可以请求解密查看记录内容。
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => mv.requestDecryption()}
                disabled={!mv.canRequestDecryption || mv.message.includes('正在')}
              >
                {mv.message.includes('正在') && mv.message.includes('请求') ? (
                  <>
                    <div className="loading-spinner" />
                    <span>处理中...</span>
                  </>
                ) : (
                  <>
                    <EyeIcon />
                    <span>发起解密请求</span>
                  </>
                )}
              </button>
              
              <button
                className="btn btn-primary"
                onClick={() => mv.decryptRecord()}
                disabled={!mv.canDecrypt}
              >
                {mv.isDecrypting ? (
                  <>
                    <div className="loading-spinner" />
                    <span>解密中...</span>
                  </>
                ) : (
                  <>
                    <LockClosedIcon />
                    <span>解密查看内容</span>
                  </>
                )}
              </button>
            </div>
            
            {mv.recordId && (
              <div style={{ 
                marginTop: '16px', 
                padding: '12px', 
                background: '#f8fafc', 
                borderRadius: '8px',
                fontSize: '14px'
              }}>
                <strong>当前记录 ID:</strong> {mv.recordId}
              </div>
            )}
            
            {mv.decryptedData && (
              <div style={{ 
                marginTop: '20px',
                padding: '16px',
                background: mv.decryptedData._verified ? '#f0fdf4' : '#fef3c7',
                border: mv.decryptedData._verified ? '1px solid #bbf7d0' : '1px solid #fbbf24',
                borderRadius: '8px'
              }}>
                <h4 style={{ margin: '0 0 12px 0', color: mv.decryptedData._verified ? '#15803d' : '#92400e', fontSize: '16px' }}>
                  {mv.decryptedData._message || '解密成功！疫苗接种信息如下：'}
                </h4>
                
                <div style={{ 
                  display: 'grid', 
                  gap: '12px', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' 
                }}>
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>疫苗类型</label>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginTop: '4px' }}>
                      {mv.decryptedData.vaccineType || '-'}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>生产厂家</label>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginTop: '4px' }}>
                      {mv.decryptedData.manufacturer || '-'}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>批号</label>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginTop: '4px' }}>
                      {mv.decryptedData.batchNumber || '-'}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>接种日期</label>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginTop: '4px' }}>
                      {mv.decryptedData.vaccinationDate || '-'}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>接种地点</label>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginTop: '4px' }}>
                      {mv.decryptedData.vaccinationSite || '-'}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>接种医生</label>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#1f2937', marginTop: '4px' }}>
                      {mv.decryptedData.doctorName || '-'}
                    </div>
                  </div>
                </div>
                
                {mv.decryptedData.notes && (
                  <div style={{ marginTop: '16px' }}>
                    <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: '500' }}>备注</label>
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#1f2937', 
                      background: '#ffffff', 
                      padding: '8px 12px', 
                      borderRadius: '6px',
                      marginTop: '4px',
                      border: '1px solid #e5e7eb'
                    }}>
                      {mv.decryptedData.notes}
                    </div>
                  </div>
                )}
                
                {mv.decryptedData._decryptedValue && (
                  <div style={{ 
                    marginTop: '16px', 
                    padding: '12px', 
                    background: '#f3f4f6', 
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    <strong>区块链解密值:</strong> {mv.decryptedData._decryptedValue}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}