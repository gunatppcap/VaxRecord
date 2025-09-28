import { ethers } from "ethers";

async function check() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  try {
    const n = await provider.getBlockNumber();
    console.log(`Hardhat node OK. block=${n}`);
  } catch {
    console.error("Local Hardhat node is not running on :8545");
    console.error("Start it under action/maskedvaccine-hardhat with: npx hardhat node");
    process.exit(1);
  }
}

check();



