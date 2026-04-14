# Decentralized Sports Betting Oracle System

A full-stack DApp with:
- On-chain contracts (`SportsOracle.sol`, `BettingMarket.sol`) in Hardhat.
- Off-chain Node.js oracle service that submits and finalizes player stats.
- React + Vite frontend that connects wallet and places/settles bets.
- Docker Compose to run the whole stack locally.

## Project Structure

```text
sports-betting-oracle-system/
├── blockchain/
│   ├── contracts/
│   ├── scripts/
│   ├── test/
│   ├── hardhat.config.js
│   └── Dockerfile
├── oracle-service/
│   ├── src/
│   ├── .env.example
│   └── Dockerfile
├── frontend/
│   ├── src/
│   └── Dockerfile
├── architecture.mmd
├── docker-compose.yml
└── README.md
```

## Architecture

See `architecture.mmd` for the data-flow diagram source.

Data flow:
1. Oracle service fetches sports data from TheSportsDB.
2. Oracle service submits stats to `SportsOracle`.
3. Users place bets in `BettingMarket` through MetaMask.
4. Oracle finalizes player performance.
5. Users settle bets; winners receive payout.

## Smart Contracts

### SportsOracle
- `oracleAddress` state variable.
- `PlayerPerformance { pointsScored, finalized }`.
- `performances[matchId][playerId]` mapping.
- Events:
  - `DataSubmitted(uint256 indexed matchId, uint256 indexed playerId)`
  - `DataFinalized(uint256 indexed matchId, uint256 indexed playerId)`
- Protected by `onlyOracle` modifier.
- Functions:
  - `submitPlayerData(uint256 matchId, uint256 playerId, uint256 pointsScored)`
  - `finalizeMatch(uint256 matchId, uint256 playerId)`

### BettingMarket
- Linked to oracle via constructor.
- `Bet` struct includes bettor, amount, settled, and bet parameters.
- `placeBet(...)` is payable and checks non-finalized state.
- `settleBet(betId)` checks finalized state, computes win (`actualPoints > predictedValue`), pays `2x` if win, and marks settled.

## Oracle Service API

Base URL: `http://localhost:3001`

### Health
- `GET /health`

### Runtime config for frontend
- `GET /api/config`

### Manual trigger update
- `POST /api/trigger-update`
- Body:
```json
{
  "matchId": 1,
  "playerId": 101,
  "pointsScored": 25
}
```

### Manual trigger finalize
- `POST /api/trigger-finalize`
- Body:
```json
{
  "matchId": 1,
  "playerId": 101
}
```

### Optional TheSportsDB fetch + submit
- `POST /api/fetch-and-submit`
- Body:
```json
{
  "matchId": 1,
  "playerId": 101,
  "sportsDbEventId": "12345",
  "sportsDbPlayerId": "67890"
}
```

## Environment Variables

`oracle-service/.env.example` includes required keys:
- `ORACLE_PRIVATE_KEY`
- `RPC_URL`
- `ORACLE_CONTRACT_ADDRESS`

Additional optional keys:
- `BETTING_MARKET_CONTRACT_ADDRESS`
- `SPORTS_API_BASE_URL`
- `PORT`

## Frontend Requirements Mapping

- Connect button: `data-test-id="connect-wallet-button"`.
- Connected address rendered in: `data-test-id="user-address"`.
- Place bet buttons:
  - `data-test-id="place-bet-button-{matchId}-{playerId}"`.

## Run with Docker

```bash
docker compose up --build -d
```

Check status:
```bash
docker compose ps
```

Frontend: `http://localhost:5173`
Oracle API: `http://localhost:3001`
Hardhat RPC: `http://localhost:8545`

## Local Development (without Docker)

### 1) Blockchain
```bash
cd blockchain
npm install
npm run node
```

In another terminal:
```bash
cd blockchain
npx hardhat run scripts/deploy.js --network localhost
```

### 2) Oracle service
Copy `oracle-service/.env.example` to `oracle-service/.env`, then set:
- `ORACLE_PRIVATE_KEY`
- `ORACLE_CONTRACT_ADDRESS`
- `BETTING_MARKET_CONTRACT_ADDRESS`

Run:
```bash
cd oracle-service
npm install
npm start
```

### 3) Frontend
```bash
cd frontend
npm install
npm run dev
```

## Testing and Coverage

Run contract tests:
```bash
cd blockchain
npm test
```

Run coverage:
```bash
cd blockchain
npm run coverage
```

Target: at least 70% line coverage.

## Notes

- This uses a single trusted oracle model for simplicity.
- In production, use secure key management and multi-oracle aggregation.
- Never commit real private keys in `.env`.
