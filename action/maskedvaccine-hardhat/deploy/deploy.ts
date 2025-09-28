import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;

  const masked = await deploy("MaskedVaccine", {
    from: deployer,
    log: true,
  });

  log(`MaskedVaccine deployed at ${masked.address}`);
};

export default func;
func.id = "deploy_maskedvaccine";
func.tags = ["MaskedVaccine"];



