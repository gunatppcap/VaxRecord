module.exports = async function (hre) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, log } = hre.deployments;

  const masked = await deploy("MaskedVaccine", {
    from: deployer,
    log: true,
  });

  log(`MaskedVaccine deployed at ${masked.address}`);
};

module.exports.id = "deploy_maskedvaccine";
module.exports.tags = ["MaskedVaccine"];
