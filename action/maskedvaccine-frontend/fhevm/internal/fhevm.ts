import { Eip1193Provider, JsonRpcProvider } from "ethers";
export type FhevmInstance = import("../types").FhevmInstance;

export class FhevmReactError extends Error { constructor(public code: string, message?: string, options?: ErrorOptions) { super(message, options); this.name = "FhevmReactError"; } }

async function getChainId(providerOrUrl: Eip1193Provider | string) {
  if (typeof providerOrUrl === "string") { const p = new JsonRpcProvider(providerOrUrl); const n = await p.getNetwork(); return Number(n.chainId); }
  const raw = await providerOrUrl.request({ method: "eth_chainId" });
  return Number.parseInt(raw as string, 16);
}

async function getWeb3Client(rpcUrl: string) { const p = new JsonRpcProvider(rpcUrl); const v = await p.send("web3_clientVersion", []); p.destroy(); return String(v); }
async function getFHEVMRelayerMetadata(rpcUrl: string) { const p = new JsonRpcProvider(rpcUrl); const v = await p.send("fhevm_relayer_metadata", []); p.destroy(); return v as { ACLAddress: `0x${string}`; InputVerifierAddress: `0x${string}`; KMSVerifierAddress: `0x${string}` }; }

async function tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl: string) {
  const v = await getWeb3Client(rpcUrl);
  if (!v.toLowerCase().includes("hardhat")) return undefined;
  try { return await getFHEVMRelayerMetadata(rpcUrl); } catch { return undefined; }
}

async function resolve(providerOrUrl: Eip1193Provider | string, mock?: Record<number, string>) {
  const chainId = await getChainId(providerOrUrl);
  const map = { 31337: "http://127.0.0.1:8545", ...(mock ?? {}) } as Record<number, string>;
  const rpcUrl = typeof providerOrUrl === "string" ? providerOrUrl : map[chainId];
  return { chainId, rpcUrl, isMock: !!map[chainId] } as const;
}

export async function createFhevmInstance(parameters: { provider: Eip1193Provider | string; mockChains?: Record<number, string>; signal: AbortSignal; onStatusChange?: (s: string) => void; }): Promise<FhevmInstance> {
  const { provider, mockChains, signal, onStatusChange } = parameters;
  const { chainId, rpcUrl, isMock } = await resolve(provider, mockChains);
  const notify = (s: string) => onStatusChange && onStatusChange(s);
  const throwIfAborted = () => { if (signal.aborted) throw new Error("aborted"); };

  if (isMock && rpcUrl) {
    const meta = await tryFetchFHEVMHardhatNodeRelayerMetadata(rpcUrl);
    if (meta) {
      notify("creating");
      const { fhevmMockCreateInstance } = await import("./mock/fhevmMock");
      const inst = await fhevmMockCreateInstance({ rpcUrl, chainId, metadata: meta });
      throwIfAborted();
      return inst;
    }
  }

  throw new FhevmReactError("RELAYER_UNAVAILABLE", "Relayer SDK not wired in MVP");
}






