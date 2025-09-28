export type FhevmInstance = {
  createEncryptedInput: (contract: `0x${string}`, user: string) => {
    add32: (v: number) => void;
    add64?: (v: number | bigint) => void;
    addBool?: (v: boolean) => void;
    encrypt: () => Promise<{ handles: string[]; inputProof: string }>;
  };
  userDecrypt: (
    items: Array<{ handle: string; contractAddress: `0x${string}` }>,
    privateKey: string,
    publicKey: string,
    signature: string,
    contracts: string[],
    user: string,
    startTs: number,
    durationDays: number
  ) => Promise<Record<string, bigint | boolean | string>>;
  getPublicKey: () => string;
  getPublicParams: (bits: number) => string;
};







