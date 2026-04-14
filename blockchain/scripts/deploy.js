const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const oracleSignerAddress =
    process.env.ORACLE_ADDRESS && process.env.ORACLE_ADDRESS.trim() !== ""
      ? process.env.ORACLE_ADDRESS.trim()
      : deployer.address;

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Oracle signer address:", oracleSignerAddress);

  const SportsOracle = await hre.ethers.getContractFactory("SportsOracle");
  const sportsOracle = await SportsOracle.deploy(oracleSignerAddress);
  await sportsOracle.waitForDeployment();

  const sportsOracleAddress = await sportsOracle.getAddress();
  console.log("SportsOracle deployed to:", sportsOracleAddress);

  const BettingMarket = await hre.ethers.getContractFactory("BettingMarket");
  const bettingMarket = await BettingMarket.deploy(sportsOracleAddress);
  await bettingMarket.waitForDeployment();

  const bettingMarketAddress = await bettingMarket.getAddress();
  console.log("BettingMarket deployed to:", bettingMarketAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
