export const SPORTS_ORACLE_ABI = [
  "function performances(uint256 matchId, uint256 playerId) view returns (uint256 pointsScored, bool finalized)",
  "event DataSubmitted(uint256 indexed matchId, uint256 indexed playerId)",
  "event DataFinalized(uint256 indexed matchId, uint256 indexed playerId)"
];

export const BETTING_MARKET_ABI = [
  "function placeBet(uint256 matchId, uint256 playerId, uint256 predictedValue) payable",
  "function settleBet(uint256 betId)",
  "function bets(uint256 betId) view returns (address bettor, uint256 amount, bool settled, uint256 matchId, uint256 playerId, uint256 predictedValue)",
  "function betCount() view returns (uint256)",
  "event BetPlaced(uint256 indexed betId, address indexed bettor, uint256 indexed matchId, uint256 playerId, uint256 predictedValue, uint256 amount)",
  "event BetSettled(uint256 indexed betId, address indexed bettor, bool won, uint256 payout, uint256 actualPoints)"
];
