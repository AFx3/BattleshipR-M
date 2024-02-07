// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 < 0.9.0;

contract Battleship {


    // Struct to represent a match between two players
    struct Battle {
        address playerX;             // Address of player A
        address playerY;             // Address of player B
        bool joinableMatch;          // Indicates whether the match is joinable
        bool startedMatch;           // Indicates whether the match has started
        uint boardSize;              // Size of the board
        uint stake;                  // Decided amount of the stake for the match
        address stakeProposer;      // Address of the player who proposed the stake
        uint stakeProposal;          // Proposed stake amount
        bytes32 merkleX;       // Merkle root for player A's data
        bytes32 merkleY;       // Merkle root for player B's data
        uint stakeX;             // Amount of Ether staked by player A
        uint stakeY;             // Amount of Ether staked by player B
        uint NumShipsX;        // Number of ships owned by player A at each turn
        uint NumShipsY;        // Number of ships owned by player B at each turn
        uint fixedShipsNumber;       // Number of ships in the match
        uint timeoutForAccusation;   // Timeout period for making an accusation
        address accusedOpponent;     // Address of the accused opponent
        address currentPlayerTurn;   // Address of the player whose turn it is
    }

    modifier validMatch(uint _matchID) {
        // Ensure the provided match ID is within valid range
        require(_matchID < gamesArray.length, "Invalid match ID");
        _;
    }



    modifier onlyPlayer(uint _matchID) {
        // Ensure the sender is one of the players in the specified match
        require(gamesArray[_matchID].playerX == msg.sender || gamesArray[_matchID].playerY == msg.sender, "Unauthorized player");
        _;
    }



    modifier notAccused(uint _matchID) {
        // Ensure the sender is not the accused opponent in the specified match
        require(gamesArray[_matchID].accusedOpponent != msg.sender, "Cannot accuse opponent again");
        _;
    }


    modifier matchNotStarted(uint _matchID) {
        // Ensure both players have provided their merkle roots, indicating match start
        require(gamesArray[_matchID].startedMatch == true, "Match not started");
        _;
    }

    modifier validSize(uint _size) {
        // Ensure the provided board size is valid (greater than zero)
        require(_size > 0, "Invalid board size");
        _;
    }

    modifier validStake(uint _stake) {
        // Ensure the provided stake amount is valid (greater than zero)
        require(_stake > 0, "Stake must be greater than zero");
        _;
    }

    modifier stakeNotSet(uint _matchID) {
        // Ensure the stake for the specified match has not been set yet
        require(gamesArray[_matchID].stake == 0, "Stake already set");
        _;
    }

    modifier temporaryStakeSet(uint _matchID) {
        // Ensure the temporary stake for the specified match has been set
        require(gamesArray[_matchID].stakeProposal > 0, "Temporary stake not set");
        _;
    }

    modifier shipsNotSunk(uint _matchID) {
        // Ensure at least one player has sunk all their ships in the specified match
        require(gamesArray[_matchID].NumShipsX <= 0 || gamesArray[_matchID].NumShipsY <= 0, "Ships not sunked by any player");
        _;
    }
 




    // Event to notify when players have joined the match
    event playersJoined(address indexed _playerX,address indexed _playerY,uint _stakeTemp ,uint indexed _matchID,uint _boardSize,uint _numberOfShips);

    // Event to propose the stake of money for the match stake
    event stakeProposal(uint indexed _matchID,uint _stake,address _proposer);

    // Event to notify that the stake proposal has been accepted
    event stakeAccepted(uint indexed _matchID,uint _stake);

    // Event to output a uint value
    event UintOutput(address indexed _proposer,uint _assignedMatchID);

    // Custom error event
    error ErrorOut(string err);

    // Event to signal the official start of the match
    event matchStarted(uint indexed _matchID, address indexed _playerX, address indexed _playerY);

    // Event to notify an attack by a player on an opponent
    event attackNotify(uint indexed _matchID ,address _attackerAddress, address _opponentAddress, uint _attackedRow, uint _attackedCol);

    // Event to indicate the result of an attack
    event attackResult(uint _matchID, uint8  _result,address _attackerAddress);

    // Event to signal the end of the match and init verification of the winner board
    event matchFinished(uint indexed _matchID,address _winnerAddr,address _loserAddr,string _cause);

    // Event to notify an accusation made by a player against another player
    event accusationNotify(uint indexed _matchID,address _accused,address _accuser);

    // Event to notify the winner of the match
    event winnerIs(uint indexed _matchID,address _winnerAddr, string _cause);


    
    //Array of matches
    Battle[] public gamesArray;

    // Count of active matches
    uint public currentGames=0;




    function NewMatch(uint _boardSize, uint _numberOfShips) public validSize(_boardSize) {
        // Create a new Match and push it to the matchList array
        // The Match constructor initializes various properties of the match
        gamesArray.push(
            Battle(
                msg.sender,          // Player 1 (creator)
                address(0),          // Player 2 (not set yet)
                true,                // Match is joinable
                false,               // Match has not started yet
                _boardSize,           // Board dimension
                0,                   // Game stake (not set yet)
                address(0),          // Address of player who proposed the stake (not set yet)
                0,                   // Game stake proposal (not set yet)
                0,                   // Player 1's Merkle root (not set yet)
                0,                   // Player 2's Merkle root (not set yet)
                0,                   // Player 1 ETH stake
                0,                   // Player 2 ETH stake
                _numberOfShips,      // Number of ships remaining for player 1
                _numberOfShips,      // Number of ships remaining for player 2
                _numberOfShips,      // Number of ships in the match
                0,                   // Total number of attacks made
                address(0),          // Address of player who accused (not set yet)
                msg.sender           // Address of the creator
            )
        );

        // Increment the count of open games
        currentGames++;

        // Emit an event to indicate the creation of a new match
        emit UintOutput(msg.sender, gamesArray.length-1);
    }


 
    function JoinMatch(uint _matchID) validMatch(_matchID) public {

        Battle storage matchIstance = gamesArray[_matchID];
        require(currentGames > 0, "No available matches!");

        uint returnIndex = _matchID;

        require(matchIstance.playerX != address(0), "No player in this match");
        require(matchIstance.playerY == address(0), "Both players already joined");
        require(matchIstance.joinableMatch, "Match not joinable");
        require(matchIstance.playerX != msg.sender, "You are already in this match");

        matchIstance.joinableMatch = false;
        matchIstance.playerY = msg.sender;
        currentGames--;

        emit playersJoined(
            matchIstance.playerX,
            matchIstance.playerY,
            matchIstance.stakeProposal,
            returnIndex,
            matchIstance.boardSize,
            matchIstance.NumShipsX
        );
    }

  
    function JoinRandom() public {
        require(currentGames > 0, "No available matches!");

        uint returnIndex = findJoinableMatch();

        require(returnIndex < gamesArray.length, "No available matches!");

        Battle storage matchedGame = gamesArray[returnIndex];
        require(matchedGame.playerX != msg.sender, "You are already in this match");


        matchedGame.playerY = msg.sender;
        matchedGame.joinableMatch = false;
        currentGames--;

        emit playersJoined(
            matchedGame.playerX,
            matchedGame.playerY,
            matchedGame.stakeProposal,
            returnIndex,
            matchedGame.boardSize,
            matchedGame.NumShipsX
        );
    }


function findJoinableMatch() private view returns (uint) {
    bytes32 rand = randomValue(); // Get a random value.
    uint remainingIndex = uint(rand) % currentGames + 1; // Convert it to a valid index within the range of active matches.

    // Iterate through the match list to find a joinable match.
    for (uint i = 0; i < gamesArray.length; i++) {
        if (gamesArray[i].joinableMatch) { // Check if the current match is joinable.
            if (remainingIndex == 1) { // If the remaining index is 1, we've found the desired match.
                return i; // Return the index of the joinable match.
            }
            remainingIndex--; // Decrement the remaining index if the current match is not joinable.
        }
    }
    return gamesArray.length; // No joinable match found, return the length of the match list.
}


    /**
    * @dev Commit a stake for a specific match.
    * @param _matchID The ID of the match to commit the stake to.
    * @param _stake The stake of stake to commit.
    * @notice This function allows a participant to commit a stake for a match they are part of.
    *         The stake stake must be greater than zero, the match ID must be valid, and the
    *         participant must be part of the match. The function emits an event indicating the
    *         stake committed for the match.
    * @dev Requires:
    *         - The creator's address for the given match is not null.
    *         - The stake is greater than zero and the match ID is within a valid range.
    *         - The sender is a participant of the match.
    *         - The stake for the match has not already been decided.
    */
    function proposeStake(uint _matchID, uint _stake) public validMatch(_matchID) onlyPlayer(_matchID) stakeNotSet(_matchID) validStake(_stake) {

        Battle storage matchIstance = gamesArray[_matchID];
        // Update temporary stake and requester for the match
        matchIstance.stakeProposal = _stake;
        matchIstance.stakeProposer = msg.sender;

        // Emit an event to indicate the stake to spend for the match
        emit stakeProposal(_matchID, _stake, msg.sender);
    }


    /**
    * @dev Accepts a stake for a match.
    * @param _matchID The ID of the match for which the stake is being accepted.
    * @notice This function allows players to commit their stakes for a match, provided certain conditions are met.
    *         The match must exist, both players must have joined, and the sender must be one of the players.
    *         The requester's address must be valid and not the same as the sender's.
    *         The match's stake must not be set yet, and the temporary stake must be decided.
    *         Upon successful stake acceptance, the match's stake is updated with the temporary stake.
    *         An event is emitted to indicate the stake has been decided.
    */
    function acceptStake(uint _matchID) public validMatch(_matchID) onlyPlayer(_matchID) temporaryStakeSet(_matchID) {
        

        Battle storage matchIstance = gamesArray[_matchID];
        require(matchIstance.stakeProposer != msg.sender, "Cannot accept your own stake");
        matchIstance.stake = matchIstance.stakeProposal;

        emit stakeAccepted(_matchID, matchIstance.stake);
    }



    /**
    * @dev Send Ether to a specific match for the specified player.
    * @param _matchID The ID of the match.
    *                The match ID should be less than the total number of games (matchList.length).
    * @notice This function allows players to send Ether to a specific match they are part of.
    *         Players must be registered for the match and only one of the match's players can send Ether at a time.
    *         Ether sent will be added to the player's balance for the match.
    * @notice This function requires a non-zero stake of Ether to be sent.
    * @notice Reverts if the match ID is invalid, players are not set for the match, or sender is not a player of the match.
    * @param _matchID The ID of the match to send Ether to.
    */
    function payStake(uint _matchID) public payable validMatch(_matchID) onlyPlayer(_matchID) {

        // Check if sent Ether stake is greater than 0
        require(msg.value > 0, "Eth is 0!");

        // Update the corresponding player's Ether stake
        if (gamesArray[_matchID].playerX == msg.sender) {
            gamesArray[_matchID].stakeX += msg.value; // Use "+=" to add the sent Ether to existing balance
        } else {
            gamesArray[_matchID].stakeY += msg.value; 
        }
    }

    /**
        * @dev Allows a player to attack their opponent in the specified match.
        * @param _matchID The ID of the match.
        * @param _attackedRow The row of the attack.
        * @param _attackedCol The column of the attack.
        */
    function attackOpponent(uint _matchID, uint256 _attackedRow, uint256 _attackedCol) public validMatch(_matchID) onlyPlayer(_matchID) {
            
            Battle storage matchIstance = gamesArray[_matchID];

            // Check if it's the sender's turn to attack
            require(matchIstance.currentPlayerTurn == msg.sender, "Not your turn to attack");

            // Reset accused player and timeout
            matchIstance.accusedOpponent = address(0);
            matchIstance.timeoutForAccusation = 0;

            address opponent = (matchIstance.playerX == msg.sender) ? matchIstance.playerY : matchIstance.playerX;

            // Emit the attack event and update player turn
            emit attackNotify(_matchID, msg.sender, opponent, _attackedRow, _attackedCol);
            matchIstance.currentPlayerTurn = opponent;
        }


    /**
    * @dev Records the provided merkle root for a player in a match, indicating readiness to start the match.
    * @param _merkleroot The merkle root hash of the player's match data.
    * @param _matchID The unique identifier of the match.
    */
    function registerMerkleRoot(bytes32 _merkleroot, uint _matchID) public validMatch(_matchID) onlyPlayer(_matchID) {

        // Get the reference to the match data using the match ID
        Battle storage matchData = gamesArray[_matchID];

        // Update the appropriate player's merkle root based on the sender
        if (msg.sender == matchData.playerX) {
            matchData.merkleX = _merkleroot;
        } else {
            matchData.merkleY = _merkleroot;
        }

        // Check if both players have provided their merkle roots to start the match
        if (matchData.merkleY != 0 && matchData.merkleX != 0) {

            matchData.startedMatch = true;

            // Emit an event indicating that the match has started
            emit matchStarted(_matchID, matchData.playerX, matchData.playerY);
        }
    }


    /**
    * @dev Submit an attack proof for a match.
    * @param _matchID The ID of the match for which the attack proof is being submitted.
    * @param _attackResult The result of the attack (0 for miss, 1 for hit).
    * @param _attackHash The hash of the attack data for verification.
    * @param merkleProof The Merkle proof for verifying the attack.
    * @notice This function allows a player to submit an attack proof for a match they are part of.
    *         The function validates the proof against the player's board, handles game mechanics,
    *         and transfers rewards in case of a valid attack. It also detects cheating attempts.
    * @dev Requires:
    *         - The match ID must be valid and ongoing (according to modifiers).
    *         - The sender must be a participant of the match.
    * @dev Emits:
    *         - An attackResult event indicating the outcome of the attack.
    *         - A matchFinished event if cheating is detected or if all ships are sunk.
    */
    function submitAttackProof(uint _matchID, uint8 _attackResult, bytes32 _attackHash, bytes32[] memory merkleProof) public validMatch(_matchID) onlyPlayer(_matchID) matchNotStarted(_matchID) {

        Battle storage matchInstance = gamesArray[_matchID];
        bytes32 computedMerkleRoot = _attackHash;
        bool cheaterDetected = false;

        address winner;
        address loser;

        // Calculate the computed Merkle root using the provided Merkle proof.
        for (uint i = 0; i < merkleProof.length; i++) {
            computedMerkleRoot = keccak256(abi.encodePacked(merkleProof[i] ^ computedMerkleRoot));
        }

        uint256 playerNumShips;
        bytes32 playerMerkleRoot;

        // Determine the player's Merkle root and the number of their remaining ships.
        if (matchInstance.playerX == msg.sender) {
            playerNumShips = matchInstance.NumShipsX;
            playerMerkleRoot =  matchInstance.merkleX;
        } else {
            playerNumShips = matchInstance.NumShipsY;
            playerMerkleRoot = matchInstance.merkleY;
        }

        // Hash the player's Merkle root to compare with the computed Merkle root.
        playerMerkleRoot = keccak256(abi.encodePacked(playerMerkleRoot));
        computedMerkleRoot = keccak256(abi.encodePacked(computedMerkleRoot));

        // If the computed Merkle root matches the player's Merkle root, process the attack.
        if (computedMerkleRoot == playerMerkleRoot) {
            emit attackResult(_matchID, _attackResult, (msg.sender == matchInstance.playerX) ? matchInstance.playerY : matchInstance.playerX);

            // Handle ship destruction and updates based on the attack result.
            if (_attackResult == 1) {
                if (msg.sender == matchInstance.playerX) {
                    matchInstance.NumShipsX = playerNumShips - 1;
                } else {
                    matchInstance.NumShipsY = playerNumShips - 1;
                }
            }
        } else {
            // Cheating detected: update winner and loser, finish the match.
            if (msg.sender == matchInstance.playerX) {
                winner = matchInstance.playerY;
                loser = matchInstance.playerX;
            } else {
                winner = matchInstance.playerX;
                loser = matchInstance.playerY;
            }

            matchInstance.startedMatch = false;
            emit matchFinished(_matchID, winner, loser, "Cheater detected: ETH sent to the winner!");
            cheaterDetected = true;
        }

        // Check for match completion conditions and transfer rewards if applicable.
        if (matchInstance.NumShipsX <= 0 || matchInstance.NumShipsY <= 0) {
            if (msg.sender == matchInstance.playerX) {
                winner = matchInstance.playerY;
            } else {
                winner = matchInstance.playerX;
            }

            matchInstance.startedMatch = false;
            emit matchFinished(_matchID, winner, msg.sender, "All ships sunk: match finished!");
        }

        // Mitigate reentrancy vulnerability using "Checks-Effects-Interactions" pattern. See report for details.
        if (cheaterDetected && winner != address(0)) {
            payable(winner).transfer(matchInstance.stake * 2);
        }
    }

    /**
    * @dev Verify the opponent's board after the match is finished.
    * @param _matchID The ID of the finished match.
    * @param _cells The array representing the opponent's board cells.
    * @notice This function allows a player to verify the opponent's board after a match is finished.
    *         It checks if the board size matches the declared size and if the number of remaining ships
    *         matches the declared number of ships. If cheating is detected, rewards are transferred.
    * @dev Requires:
    *         - The match ID must be valid and finished (according to modifiers).
    *         - The sender must be a participant of the match.
    * @dev Emits:
    *         - A matchFinished event if cheating is detected and rewards are transferred.
    *         - A matchFinished event if the verification is successful and rewards are transferred.
    */
    function verifyBoard(uint _matchID, int256[] memory _cells) public validMatch(_matchID) onlyPlayer(_matchID) {

        Battle storage matchInstance = gamesArray[_matchID];
        address winner;
        address loser;
        uint256 shipsNumber = 0;
        bool cheaterDetected = false;

        // Determine the winner and loser based on the player's remaining ships.
        if (msg.sender == matchInstance.playerX && matchInstance.NumShipsY <= 0) {
            winner = matchInstance.playerX;
            loser = matchInstance.playerY;
        } else if (msg.sender == matchInstance.playerY && matchInstance.NumShipsX <= 0) {
            winner = matchInstance.playerY;
            loser = matchInstance.playerX;
        } else {
            revert("Error: there is no winner!");
        }

        shipsNumber = matchInstance.fixedShipsNumber;
        uint256 declaredSize = matchInstance.boardSize;

        // Check if the actual board size matches the declared size.
        uint256 actualLength = _cells.length;
        if (actualLength != declaredSize * declaredSize) {
            cheaterDetected = true;
            emit winnerIs(_matchID, loser, "Opponent declared a different board size!");
        } else {
            // Check if the number of remaining ships matches the declared number of ships.
            uint shipCount = 0;
            for (uint i = 0; i < _cells.length; i++) {
                // Check if the cell contains a ship: >= 1 because hit ships are marked with 2.
                if (_cells[i] >= 1) {
                    shipCount++;
                }
            }

            if (shipCount < shipsNumber) {
                // Detected board cheat.
                cheaterDetected = true;
                emit winnerIs(_matchID, loser, "Opponent declared a different number of ships!");
            } else {
                // Winner is legitimate.
                emit winnerIs(_matchID, winner, "ETH transferred to your account!");
            }
        }

        // Mitigate reentrancy vulnerability using "Checks-Effects-Interactions" pattern.
        if (cheaterDetected) {
            payable(loser).transfer(matchInstance.stake * 2);
        } else {
            payable(winner).transfer(matchInstance.stake * 2);
        }


        //Match finished, remove it from the list
        delete gamesArray[_matchID];
    }



    /**
    * @dev Notifies the opponent to play, triggering a timeout event and potentially ending the match.
    * @param _matchID The unique identifier of the match.
    */
    function accuseOpponent(uint _matchID) public validMatch(_matchID) onlyPlayer(_matchID) notAccused(_matchID) {
        
        Battle storage matchIstance = gamesArray[_matchID];
        address accusedOpponent;

        bool timeoutExceeded = false;
        address winner;
        address loser;

        // Determine the accused opponent based on the sender
        if (matchIstance.playerY == msg.sender) {
            accusedOpponent = matchIstance.playerX;
        } else {
            accusedOpponent = matchIstance.playerY;
        }

        // Handle timeout scenario
        if (matchIstance.timeoutForAccusation != 0) {
            // Check if more than 5 blocks have passed since the notify was triggered
            if (block.number >= matchIstance.timeoutForAccusation) {
                // Determine the winner and transfer ETH accordingly

                if (matchIstance.accusedOpponent == matchIstance.playerY) {
                    winner = matchIstance.playerX;
                    loser = matchIstance.playerY;
                } else {
                    winner = matchIstance.playerY;
                    loser = matchIstance.playerX;
                }

                timeoutExceeded = true;

                // End the match due to timeout
                emit winnerIs(_matchID, winner, "AFK timeout reached: match finished!");
            } else {
                // Emit accusation notification
                emit accusationNotify(_matchID, accusedOpponent, msg.sender);
            }
        } else {
            // Set the timeout for accusation and record the accused opponent
            matchIstance.timeoutForAccusation = block.number + 5;
            matchIstance.accusedOpponent = accusedOpponent;

            // Emit accusation notification
            emit accusationNotify(_matchID, accusedOpponent, msg.sender);
        }

        if(timeoutExceeded && winner != address(0)){
            // Transfer the stake to the accused opponent
            payable(winner).transfer(matchIstance.stake * 2);
        }
    }


    /**
    * @dev Generates a pseudo-random value based on the current block hash.
    * @return A pseudo-random bytes32 value.
    */
    function randomValue() private view returns (bytes32) {
        // Retrieve the block hash of the previous block
        bytes32 previousBlockHash = blockhash(block.number - 1);

        // Copy relevant bytes from the block hash to a new bytes array
        bytes memory bytesArray = new bytes(32);
        for (uint i = 0; i < 32; i++) {
            bytesArray[i] = previousBlockHash[i];
        }

        // Generate a pseudo-random value using the copied bytes and keccak256
        bytes32 randValue = keccak256(bytesArray);

        return randValue;
    }



}


