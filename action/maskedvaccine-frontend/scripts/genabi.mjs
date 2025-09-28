import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const TEMPLATE_DEPLOY = join(process.cwd(), "../../zama_template/fhevm-hardhat-template/deployments/localhost/MaskedVaccine.json");
const ACTION_DEPLOY = join(process.cwd(), "../maskedvaccine-hardhat/deployments/localhost/MaskedVaccine.json");
const ABI_DIR = join(process.cwd(), "abi");

function resolveDeployPath() {
  if (existsSync(TEMPLATE_DEPLOY)) return TEMPLATE_DEPLOY;
  if (existsSync(ACTION_DEPLOY)) return ACTION_DEPLOY;
  return undefined;
}

function main() {
  const deployPath = resolveDeployPath();
  if (!deployPath) {
    console.warn("genabi: skipped (deployments not found)");
    return;
  }
  const raw = readFileSync(deployPath, "utf-8");
  const json = JSON.parse(raw);
  mkdirSync(ABI_DIR, { recursive: true });

  const abiTs = `export const MaskedVaccineABI = ${JSON.stringify({ abi: json.abi }, null, 2)} as const;\n`;
  const addrTs = `export const MaskedVaccineAddresses = {\n  "31337": { address: "${json.address}", chainId: 31337, chainName: "localhost" }\n} as const;\n`;

  writeFileSync(join(ABI_DIR, "MaskedVaccineABI.ts"), abiTs);
  writeFileSync(join(ABI_DIR, "MaskedVaccineAddresses.ts"), addrTs);
  console.log("genabi: OK from", deployPath);
}

main();



