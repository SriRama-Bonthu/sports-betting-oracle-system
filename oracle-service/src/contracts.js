const { ethers } = require("ethers");

const SPORTS_ORACLE_ABI = [
  "function submitPlayerData(uint256 matchId, uint256 playerId, uint256 pointsScored) external",
  "function finalizeMatch(uint256 matchId, uint256 playerId) external",
  "function performances(uint256 matchId, uint256 playerId) external view returns (uint256 pointsScored, bool finalized)"
];

const BETTING_MARKET_ABI = [
  "function placeBet(uint256 matchId, uint256 playerId, uint256 predictedValue) external payable",
  "function settleBet(uint256 betId) external",
  "function betCount() external view returns (uint256)",
  "function bets(uint256 betId) external view returns (address bettor, uint256 amount, bool settled, uint256 matchId, uint256 playerId, uint256 predictedValue)"
];

function getProvider() {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("Missing RPC_URL environment variable");
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

function getOracleWallet(provider) {
  const privateKey = process.env.ORACLE_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("Missing ORACLE_PRIVATE_KEY environment variable");
  }
  return new ethers.Wallet(privateKey, provider);
}

function getSportsOracleContract() {
  const provider = getProvider();
  const wallet = getOracleWallet(provider);

  const address = process.env.ORACLE_CONTRACT_ADDRESS;
  if (!address) {
    throw new Error("Missing ORACLE_CONTRACT_ADDRESS environment variable");
  }

  return new ethers.Contract(address, SPORTS_ORACLE_ABI, wallet);
}

module.exports = {
  SPORTS_ORACLE_ABI,
  BETTING_MARKET_ABI,
  getProvider,
  getSportsOracleContract
};
