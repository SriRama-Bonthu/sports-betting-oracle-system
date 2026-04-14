// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISportsOracle {
    function performances(uint256 matchId, uint256 playerId)
        external
        view
        returns (uint256 pointsScored, bool finalized);
}

contract BettingMarket {
    ISportsOracle public oracle;

    struct Bet {
        address bettor;
        uint256 amount;
        bool settled;
        uint256 matchId;
        uint256 playerId;
        uint256 predictedValue;
    }

    uint256 public betCount;
    mapping(uint256 => Bet) public bets;

    event BetPlaced(
        uint256 indexed betId,
        address indexed bettor,
        uint256 indexed matchId,
        uint256 playerId,
        uint256 predictedValue,
        uint256 amount
    );

    event BetSettled(
        uint256 indexed betId,
        address indexed bettor,
        bool won,
        uint256 payout,
        uint256 actualPoints
    );

    constructor(address oracleAddress) {
        require(oracleAddress != address(0), "Invalid oracle address");
        oracle = ISportsOracle(oracleAddress);
    }

    receive() external payable {}

    function placeBet(uint256 matchId, uint256 playerId, uint256 predictedValue) external payable {
        require(msg.value > 0, "Bet amount must be greater than 0");

        (, bool finalized) = oracle.performances(matchId, playerId);
        require(!finalized, "Match already finalized");

        bets[betCount] = Bet({
            bettor: msg.sender,
            amount: msg.value,
            settled: false,
            matchId: matchId,
            playerId: playerId,
            predictedValue: predictedValue
        });

        emit BetPlaced(
            betCount,
            msg.sender,
            matchId,
            playerId,
            predictedValue,
            msg.value
        );

        betCount += 1;
    }

    function settleBet(uint256 betId) external {
        Bet storage bet = bets[betId];

        require(bet.bettor != address(0), "Bet does not exist");
        require(!bet.settled, "Bet already settled");

        (uint256 actualPoints, bool finalized) = oracle.performances(bet.matchId, bet.playerId);
        require(finalized, "Match not finalized");

        bool won = actualPoints > bet.predictedValue;
        uint256 payout = 0;

        if (won) {
            payout = bet.amount * 2;
            require(address(this).balance >= payout, "Insufficient contract balance");

            (bool success, ) = payable(bet.bettor).call{value: payout}("");
            require(success, "Payout transfer failed");
        }

        bet.settled = true;
        emit BetSettled(betId, bet.bettor, won, payout, actualPoints);
    }

    function getBet(uint256 betId) external view returns (Bet memory) {
        return bets[betId];
    }
}
