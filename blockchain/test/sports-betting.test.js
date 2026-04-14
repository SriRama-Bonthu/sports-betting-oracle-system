const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Sports Oracle + Betting Market", function () {
  async function deployFixture() {
    const [deployer, oracleAccount, bettor, attacker] = await ethers.getSigners();

    const SportsOracle = await ethers.getContractFactory("SportsOracle", deployer);
    const sportsOracle = await SportsOracle.deploy(oracleAccount.address);
    await sportsOracle.waitForDeployment();

    const BettingMarket = await ethers.getContractFactory("BettingMarket", deployer);
    const bettingMarket = await BettingMarket.deploy(await sportsOracle.getAddress());
    await bettingMarket.waitForDeployment();

    return { deployer, oracleAccount, bettor, attacker, sportsOracle, bettingMarket };
  }

  describe("SportsOracle", function () {
    it("stores oracle address", async function () {
      const { oracleAccount, sportsOracle } = await deployFixture();
      expect(await sportsOracle.oracleAddress()).to.equal(oracleAccount.address);
    });

    it("allows oracle to submit and finalize data", async function () {
      const { oracleAccount, sportsOracle } = await deployFixture();

      await expect(sportsOracle.connect(oracleAccount).submitPlayerData(1, 101, 25))
        .to.emit(sportsOracle, "DataSubmitted")
        .withArgs(1, 101);

      const perf = await sportsOracle.performances(1, 101);
      expect(perf.pointsScored).to.equal(25);
      expect(perf.finalized).to.equal(false);

      await expect(sportsOracle.connect(oracleAccount).finalizeMatch(1, 101))
        .to.emit(sportsOracle, "DataFinalized")
        .withArgs(1, 101);

      const finalPerf = await sportsOracle.performances(1, 101);
      expect(finalPerf.finalized).to.equal(true);
    });

    it("reverts non-oracle access", async function () {
      const { attacker, sportsOracle } = await deployFixture();

      await expect(
        sportsOracle.connect(attacker).submitPlayerData(1, 101, 12)
      ).to.be.revertedWith("Only oracle can call");
    });

    it("does not allow updates after finalization", async function () {
      const { oracleAccount, sportsOracle } = await deployFixture();

      await sportsOracle.connect(oracleAccount).submitPlayerData(1, 101, 25);
      await sportsOracle.connect(oracleAccount).finalizeMatch(1, 101);

      await expect(
        sportsOracle.connect(oracleAccount).submitPlayerData(1, 101, 30)
      ).to.be.revertedWith("Performance already finalized");
    });
  });

  describe("BettingMarket", function () {
    it("places a bet with non-zero value", async function () {
      const { bettor, bettingMarket } = await deployFixture();

      await expect(
        bettingMarket.connect(bettor).placeBet(1, 101, 20, {
          value: ethers.parseEther("0.5"),
        })
      ).to.emit(bettingMarket, "BetPlaced");

      const bet = await bettingMarket.bets(0);
      expect(bet.bettor).to.equal(bettor.address);
      expect(bet.amount).to.equal(ethers.parseEther("0.5"));
      expect(bet.settled).to.equal(false);
      expect(bet.matchId).to.equal(1);
      expect(bet.playerId).to.equal(101);
      expect(bet.predictedValue).to.equal(20);
    });

    it("reverts zero-value bet", async function () {
      const { bettor, bettingMarket } = await deployFixture();

      await expect(
        bettingMarket.connect(bettor).placeBet(1, 101, 20, { value: 0 })
      ).to.be.revertedWith("Bet amount must be greater than 0");
    });

    it("reverts bet placement if match already finalized", async function () {
      const { oracleAccount, bettor, sportsOracle, bettingMarket } = await deployFixture();

      await sportsOracle.connect(oracleAccount).submitPlayerData(1, 101, 15);
      await sportsOracle.connect(oracleAccount).finalizeMatch(1, 101);

      await expect(
        bettingMarket.connect(bettor).placeBet(1, 101, 10, {
          value: ethers.parseEther("0.1"),
        })
      ).to.be.revertedWith("Match already finalized");
    });

    it("settles a winning bet and pays 2x", async function () {
      const { deployer, oracleAccount, bettor, sportsOracle, bettingMarket } = await deployFixture();

      await deployer.sendTransaction({
        to: await bettingMarket.getAddress(),
        value: ethers.parseEther("3"),
      });

      await bettingMarket.connect(bettor).placeBet(10, 7, 20, {
        value: ethers.parseEther("1"),
      });

      await sportsOracle.connect(oracleAccount).submitPlayerData(10, 7, 25);
      await sportsOracle.connect(oracleAccount).finalizeMatch(10, 7);

      const before = await ethers.provider.getBalance(bettor.address);
      const tx = await bettingMarket.connect(bettor).settleBet(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const after = await ethers.provider.getBalance(bettor.address);

      expect(after + gasUsed - before).to.equal(ethers.parseEther("2"));

      const bet = await bettingMarket.bets(0);
      expect(bet.settled).to.equal(true);
    });

    it("settles a losing bet without payout", async function () {
      const { oracleAccount, bettor, sportsOracle, bettingMarket } = await deployFixture();

      await bettingMarket.connect(bettor).placeBet(10, 7, 30, {
        value: ethers.parseEther("0.2"),
      });

      await sportsOracle.connect(oracleAccount).submitPlayerData(10, 7, 20);
      await sportsOracle.connect(oracleAccount).finalizeMatch(10, 7);

      await expect(bettingMarket.connect(bettor).settleBet(0))
        .to.emit(bettingMarket, "BetSettled")
        .withArgs(0, bettor.address, false, 0, 20);

      const bet = await bettingMarket.bets(0);
      expect(bet.settled).to.equal(true);
    });

    it("reverts settlement if already settled", async function () {
      const { deployer, oracleAccount, bettor, sportsOracle, bettingMarket } = await deployFixture();

      await deployer.sendTransaction({
        to: await bettingMarket.getAddress(),
        value: ethers.parseEther("1"),
      });

      await bettingMarket.connect(bettor).placeBet(10, 7, 10, {
        value: ethers.parseEther("0.2"),
      });

      await sportsOracle.connect(oracleAccount).submitPlayerData(10, 7, 11);
      await sportsOracle.connect(oracleAccount).finalizeMatch(10, 7);
      await bettingMarket.connect(bettor).settleBet(0);

      await expect(bettingMarket.connect(bettor).settleBet(0)).to.be.revertedWith(
        "Bet already settled"
      );
    });

    it("reverts settlement before match finalization", async function () {
      const { bettor, bettingMarket } = await deployFixture();

      await bettingMarket.connect(bettor).placeBet(1, 2, 10, {
        value: ethers.parseEther("0.1"),
      });

      await expect(bettingMarket.connect(bettor).settleBet(0)).to.be.revertedWith(
        "Match not finalized"
      );
    });
  });
});
