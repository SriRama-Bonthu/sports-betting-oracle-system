// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SportsOracle {
    address public oracleAddress;

    struct PlayerPerformance {
        uint256 pointsScored;
        bool finalized;
    }

    mapping(uint256 => mapping(uint256 => PlayerPerformance)) public performances;

    event DataSubmitted(uint256 indexed matchId, uint256 indexed playerId);
    event DataFinalized(uint256 indexed matchId, uint256 indexed playerId);
    event OracleAddressUpdated(address indexed oldOracle, address indexed newOracle);

    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Only oracle can call");
        _;
    }

    constructor(address initialOracle) {
        require(initialOracle != address(0), "Invalid oracle address");
        oracleAddress = initialOracle;
    }

    function setOracleAddress(address newOracle) external onlyOracle {
        require(newOracle != address(0), "Invalid oracle address");
        address oldOracle = oracleAddress;
        oracleAddress = newOracle;
        emit OracleAddressUpdated(oldOracle, newOracle);
    }

    function submitPlayerData(
        uint256 matchId,
        uint256 playerId,
        uint256 pointsScored
    ) external onlyOracle {
        PlayerPerformance storage performance = performances[matchId][playerId];
        require(!performance.finalized, "Performance already finalized");

        performance.pointsScored = pointsScored;
        emit DataSubmitted(matchId, playerId);
    }

    function finalizeMatch(uint256 matchId, uint256 playerId) external onlyOracle {
        PlayerPerformance storage performance = performances[matchId][playerId];
        require(!performance.finalized, "Performance already finalized");

        performance.finalized = true;
        emit DataFinalized(matchId, playerId);
    }
}
