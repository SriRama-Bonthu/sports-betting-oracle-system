require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const axios = require("axios");

const { getSportsOracleContract } = require("./contracts");
const { withRetry } = require("./retry");

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", async (_req, res) => {
  try {
    let signerAddress = "";
    let configReady = false;

    if (
      process.env.ORACLE_PRIVATE_KEY &&
      process.env.RPC_URL &&
      process.env.ORACLE_CONTRACT_ADDRESS
    ) {
      const oracle = getSportsOracleContract();
      signerAddress = await oracle.runner.getAddress();
      configReady = true;
    }

    res.status(200).json({ status: "ok", oracleSigner: signerAddress, configReady });
  } catch (error) {
    res.status(200).json({ status: "ok", configReady: false, warning: error.message });
  }
});

app.get("/api/config", (_req, res) => {
  res.json({
    oracleContractAddress: process.env.ORACLE_CONTRACT_ADDRESS || "",
    bettingMarketContractAddress: process.env.BETTING_MARKET_CONTRACT_ADDRESS || "",
    rpcUrl: process.env.RPC_URL || ""
  });
});

app.post("/api/trigger-update", async (req, res) => {
  const { matchId, playerId, pointsScored } = req.body;

  if (
    matchId === undefined ||
    playerId === undefined ||
    pointsScored === undefined
  ) {
    return res.status(400).json({
      error: "matchId, playerId, and pointsScored are required"
    });
  }

  try {
    const oracle = getSportsOracleContract();

    const tx = await withRetry(
      () => oracle.submitPlayerData(matchId, playerId, pointsScored),
      { retries: 3, baseDelayMs: 300 }
    );
    const receipt = await tx.wait();

    return res.status(200).json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error("submitPlayerData failed", error);
    return res.status(500).json({
      success: false,
      error: error.reason || error.message
    });
  }
});

app.post("/api/trigger-finalize", async (req, res) => {
  const { matchId, playerId } = req.body;

  if (matchId === undefined || playerId === undefined) {
    return res.status(400).json({
      error: "matchId and playerId are required"
    });
  }

  try {
    const oracle = getSportsOracleContract();

    const tx = await withRetry(
      () => oracle.finalizeMatch(matchId, playerId),
      { retries: 3, baseDelayMs: 300 }
    );
    const receipt = await tx.wait();

    return res.status(200).json({
      success: true,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber
    });
  } catch (error) {
    console.error("finalizeMatch failed", error);
    return res.status(500).json({
      success: false,
      error: error.reason || error.message
    });
  }
});

app.post("/api/fetch-and-submit", async (req, res) => {
  const { matchId, playerId, sportsDbEventId, sportsDbPlayerId } = req.body;

  if (!matchId || !playerId || !sportsDbEventId || !sportsDbPlayerId) {
    return res.status(400).json({
      error: "matchId, playerId, sportsDbEventId, sportsDbPlayerId are required"
    });
  }

  const baseUrl = process.env.SPORTS_API_BASE_URL || "https://www.thesportsdb.com/api/v1/json/3";

  try {
    const pointsScored = await withRetry(async () => {
      const url = `${baseUrl}/lookupeventstats.php?id=${sportsDbEventId}`;
      const response = await axios.get(url, { timeout: 6000 });
      const players = response.data?.playerstats || [];
      const player = players.find((p) => String(p.idPlayer) === String(sportsDbPlayerId));

      if (!player) {
        throw new Error("Player not found in TheSportsDB response");
      }

      const points = Number(player.intPoints || 0);
      if (Number.isNaN(points) || points < 0) {
        throw new Error("Invalid points value from API");
      }

      return points;
    }, { retries: 3, baseDelayMs: 500 });

    const oracle = getSportsOracleContract();
    const tx = await oracle.submitPlayerData(matchId, playerId, pointsScored);
    const receipt = await tx.wait();

    return res.status(200).json({
      success: true,
      pointsScored,
      txHash: receipt.hash
    });
  } catch (error) {
    console.error("fetch-and-submit failed", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.use((err, _req, res, _next) => {
  console.error("Unhandled error", err);
  res.status(500).json({ success: false, error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Oracle service listening on port ${port}`);
});
