import { useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { BETTING_MARKET_ABI, SPORTS_ORACLE_ABI } from "./contracts";

const ORACLE_SERVICE_URL = import.meta.env.VITE_ORACLE_SERVICE_URL || "http://localhost:3001";
const BET_ETH = import.meta.env.VITE_DEFAULT_BET_ETH || "0.01";

const defaultMarkets = [
  { matchId: 1, playerId: 101, playerName: "Player 101", overUnderLine: 24 },
  { matchId: 1, playerId: 102, playerName: "Player 102", overUnderLine: 18 },
  { matchId: 2, playerId: 201, playerName: "Player 201", overUnderLine: 30 }
];

function shortenAddress(addr) {
  if (!addr) return "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function App() {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [address, setAddress] = useState("");
  const [oracleAddress, setOracleAddress] = useState("");
  const [marketAddress, setMarketAddress] = useState("");
  const [networkName, setNetworkName] = useState("unknown");
  const [status, setStatus] = useState("Disconnected");
  const [isConnecting, setIsConnecting] = useState(false);
  const [bets, setBets] = useState([]);
  const [predictionByKey, setPredictionByKey] = useState({});
  const [performanceMap, setPerformanceMap] = useState({});

  const bettingContract = useMemo(() => {
    if (!provider || !marketAddress) return null;
    return new ethers.Contract(marketAddress, BETTING_MARKET_ABI, provider);
  }, [provider, marketAddress]);

  const oracleContract = useMemo(() => {
    if (!provider || !oracleAddress) return null;
    return new ethers.Contract(oracleAddress, SPORTS_ORACLE_ABI, provider);
  }, [provider, oracleAddress]);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch(`${ORACLE_SERVICE_URL}/api/config`);
        const config = await response.json();
        setOracleAddress(config.oracleContractAddress || "");
        setMarketAddress(config.bettingMarketContractAddress || "");
      } catch {
        setStatus("Could not fetch contract config from oracle service");
      }
    })();
  }, []);

  useEffect(() => {
    if (!window.ethereum) {
      setStatus("MetaMask not found");
      return;
    }

    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    setProvider(browserProvider);

    (async () => {
      const network = await browserProvider.getNetwork();
      setNetworkName(network.name || String(network.chainId));
    })();

    window.ethereum.on("accountsChanged", (accounts) => {
      const next = accounts?.[0] || "";
      setAddress(next);
      if (!next) {
        setSigner(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!bettingContract || !oracleContract) return;

    const handleBetPlaced = () => {
      loadBets();
    };
    const handleBetSettled = () => {
      loadBets();
    };
    const handleDataUpdate = () => {
      loadPerformances();
    };

    bettingContract.on("BetPlaced", handleBetPlaced);
    bettingContract.on("BetSettled", handleBetSettled);
    oracleContract.on("DataSubmitted", handleDataUpdate);
    oracleContract.on("DataFinalized", handleDataUpdate);

    return () => {
      bettingContract.off("BetPlaced", handleBetPlaced);
      bettingContract.off("BetSettled", handleBetSettled);
      oracleContract.off("DataSubmitted", handleDataUpdate);
      oracleContract.off("DataFinalized", handleDataUpdate);
    };
  }, [bettingContract, oracleContract]);

  useEffect(() => {
    loadBets();
    loadPerformances();
  }, [bettingContract, oracleContract]);

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("Install MetaMask to continue");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const nextSigner = await browserProvider.getSigner();
      const network = await browserProvider.getNetwork();

      setProvider(browserProvider);
      setSigner(nextSigner);
      setAddress(accounts[0]);
      setNetworkName(network.name || String(network.chainId));
      setStatus("Wallet connected");
    } catch (error) {
      setStatus(error?.message || "Wallet connection failed");
    } finally {
      setIsConnecting(false);
    }
  }

  async function loadBets() {
    if (!bettingContract) return;

    try {
      const count = Number(await bettingContract.betCount());
      const list = [];

      for (let i = 0; i < count; i += 1) {
        const b = await bettingContract.bets(i);
        list.push({
          id: i,
          bettor: b.bettor,
          amount: ethers.formatEther(b.amount),
          settled: b.settled,
          matchId: Number(b.matchId),
          playerId: Number(b.playerId),
          predictedValue: Number(b.predictedValue)
        });
      }

      setBets(list.reverse());
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || "Failed to load bets");
    }
  }

  async function loadPerformances() {
    if (!oracleContract) return;

    try {
      const updates = {};
      for (const market of defaultMarkets) {
        const perf = await oracleContract.performances(market.matchId, market.playerId);
        updates[`${market.matchId}-${market.playerId}`] = {
          pointsScored: Number(perf.pointsScored),
          finalized: perf.finalized
        };
      }
      setPerformanceMap(updates);
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || "Failed to load oracle data");
    }
  }

  async function placeBet(market) {
    if (!signer || !marketAddress) {
      setStatus("Connect wallet first");
      return;
    }

    const prediction = Number(predictionByKey[`${market.matchId}-${market.playerId}`] ?? market.overUnderLine);
    if (Number.isNaN(prediction)) {
      setStatus("Prediction must be a number");
      return;
    }

    try {
      const contract = new ethers.Contract(marketAddress, BETTING_MARKET_ABI, signer);
      const tx = await contract.placeBet(market.matchId, market.playerId, prediction, {
        value: ethers.parseEther(BET_ETH)
      });
      setStatus(`Submitting bet tx: ${tx.hash}`);
      await tx.wait();
      setStatus("Bet placed successfully");
      await loadBets();
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || "Bet transaction failed");
    }
  }

  async function settleBet(betId) {
    if (!signer || !marketAddress) {
      setStatus("Connect wallet first");
      return;
    }

    try {
      const contract = new ethers.Contract(marketAddress, BETTING_MARKET_ABI, signer);
      const tx = await contract.settleBet(betId);
      setStatus(`Settling bet tx: ${tx.hash}`);
      await tx.wait();
      setStatus("Bet settled");
      await loadBets();
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || "Settlement failed");
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>Decentralized Sports Betting Oracle</h1>
        <button
          className="connect"
          data-test-id="connect-wallet-button"
          onClick={connectWallet}
          disabled={isConnecting}
        >
          {isConnecting ? "Connecting..." : address ? "Wallet Connected" : "Connect Wallet"}
        </button>
      </header>

      <section className="meta">
        <p data-test-id="user-address">User: {address || "Not connected"}</p>
        <p>Network: {networkName}</p>
        <p>Oracle: {shortenAddress(oracleAddress) || "Not configured"}</p>
        <p>Betting Market: {shortenAddress(marketAddress) || "Not configured"}</p>
        <p className="status">Status: {status}</p>
      </section>

      <section>
        <h2>Markets</h2>
        <div className="grid">
          {defaultMarkets.map((market) => {
            const key = `${market.matchId}-${market.playerId}`;
            const perf = performanceMap[key] || { pointsScored: 0, finalized: false };

            return (
              <article className="card" key={key}>
                <h3>{market.playerName}</h3>
                <p>Match ID: {market.matchId}</p>
                <p>Player ID: {market.playerId}</p>
                <p>Current line: over {market.overUnderLine}</p>
                <p>Oracle points: {perf.pointsScored}</p>
                <p>Finalized: {perf.finalized ? "Yes" : "No"}</p>

                <label>
                  Your prediction
                  <input
                    type="number"
                    value={predictionByKey[key] ?? market.overUnderLine}
                    onChange={(e) =>
                      setPredictionByKey((prev) => ({
                        ...prev,
                        [key]: e.target.value
                      }))
                    }
                  />
                </label>

                <button
                  data-test-id={`place-bet-button-${market.matchId}-${market.playerId}`}
                  onClick={() => placeBet(market)}
                  disabled={!address || perf.finalized}
                >
                  Place Bet ({BET_ETH} ETH)
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <h2>Placed Bets</h2>
        <div className="grid bets">
          {bets.length === 0 && <p>No bets yet.</p>}
          {bets.map((bet) => (
            <article className="card" key={bet.id}>
              <h3>Bet #{bet.id}</h3>
              <p>Bettor: {shortenAddress(bet.bettor)}</p>
              <p>Amount: {bet.amount} ETH</p>
              <p>Match/Player: {bet.matchId}/{bet.playerId}</p>
              <p>Prediction: {bet.predictedValue}</p>
              <p>Settled: {bet.settled ? "Yes" : "No"}</p>
              <button onClick={() => settleBet(bet.id)} disabled={bet.settled || !address}>
                Settle Bet
              </button>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
