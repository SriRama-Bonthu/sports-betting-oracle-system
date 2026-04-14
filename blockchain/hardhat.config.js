require("@nomicfoundation/hardhat-toolbox");
require("solidity-coverage");
require("dotenv").config();

const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  networks: {
    hardhat: {},
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    ...(PRIVATE_KEY
      ? {
          sepolia: {
            url: process.env.SEPOLIA_RPC_URL || "",
            accounts: [PRIVATE_KEY],
          },
        }
      : {}),
  },
  mocha: {
    timeout: 60000,
  },
};
