// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 < 0.9.0; //okk version

// define the contract
contract Battleship {


    // Struct to represent a match 
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


     //Array of matches
    Battle[] public gamesArray;

    // Counter for active matches
    uint public currentGames = 0;


    // ensure the match ID is valid
    modifier checkValidityIdMatch(uint _matchID) {
        require(_matchID < gamesArray.length, "Invalid match ID");
        _;
    }

    // ensure the sender is one of the players in a specific match
    modifier onlyPlayer(uint _matchID) {
        require(gamesArray[_matchID].playerX == msg.sender || gamesArray[_matchID].playerY == msg.sender, "Unauthorized player");
        _;
    }

     // ensure both players have provided their merkle roots, indicating match start
    modifier merkleRootProvided(uint _matchID) {
        require(gamesArray[_matchID].startedMatch == true, "Match not started");
        _;
    }

    // ensure the provided board size is valid 
    modifier validSize(uint _size) {
        require(_size > 0, "Invalid board size");
        _;
    }
    
    // ensure the temporary stake for the specified match has been set
    modifier stakeVariable(uint _matchID) {
        require(gamesArray[_matchID].stakeProposal > 0, "Temporary stake not set");
        _;
    }

    // EVENTS
    // players have joined the match
    event playersJoined(address indexed _playerX,address indexed _playerY,uint _stakeTemp ,uint indexed _matchID,uint _boardSize,uint _numberOfShips);

    // propose the stake for the match 
    event stakeProposal(uint indexed _matchID,uint _stake,address _proposer);

    // stake proposal has been accepted
    event stakeAccepted(uint indexed _matchID,uint _stake);

    // match has been created
    event newMatchCreated(address indexed _proposer,uint _assignedMatchID);

    // match has started
    event matchStarted(uint indexed _matchID, address indexed _playerX, address indexed _playerY);

    // attack by a player 
    event attackPerformed(uint indexed _matchID ,address _attackerAddress, address _opponentAddress, uint _attackedRow, uint _attackedCol);

    // Event to indicate the result of an attack
    event attackResult(uint _matchID, uint8  _result,address _attackerAddress);

    // Event to signal the end of the match and init verification of the winner board
    event matchFinished(uint indexed _matchID,address _winnerAddr,address _loserAddr,string _cause);

    // Event to notify an accusation made by a player against another player
    event accuse(uint indexed _matchID,address _accused,address _accuser);

    // Event to notify the winner of the match
    event winnerIs(uint indexed _matchID,address _winnerAddr, string _cause);


    
   



    function NewMatch(uint _boardSize, uint _numberOfShips) public validSize(_boardSize) {
    // Create a new Battle instance
    Battle memory newMatch;

    // Set properties of the new match
    newMatch.playerX = msg.sender;
    newMatch.playerY = address(0);
    newMatch.joinableMatch = true;
    newMatch.startedMatch = false;
    newMatch.boardSize = _boardSize;
    newMatch.stake = 0;
    newMatch.stakeProposer = address(0);
    newMatch.stakeProposal = 0;
    newMatch.merkleX = 0;
    newMatch.merkleY = 0;
    newMatch.stakeX = 0;
    newMatch.stakeY = 0;
    newMatch.NumShipsX = _numberOfShips;
    newMatch.NumShipsY = _numberOfShips;
    newMatch.fixedShipsNumber = _numberOfShips;
    newMatch.timeoutForAccusation = 0;
    newMatch.accusedOpponent = address(0);
    newMatch.currentPlayerTurn = msg.sender;

    // Push the new match to the gamesArray
    gamesArray.push(newMatch);

    // Increment the count of open games
    currentGames++;

    // Emit an event to indicate the creation of a new match
    emit newMatchCreated(msg.sender, gamesArray.length-1);
}





    



 
    function JoinMatch(uint _matchID) checkValidityIdMatch(_matchID) public {

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


    function proposeStake(uint _matchID, uint _stake) checkValidityIdMatch(_matchID) public {
        Battle storage matchInstance = gamesArray[_matchID];
        require(matchInstance.playerX == msg.sender || matchInstance.playerY == msg.sender, "Unauthorized player");

        matchInstance.stakeProposal = _stake;
        matchInstance.stakeProposer = msg.sender;

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
    function acceptStake(uint _matchID) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) stakeVariable(_matchID) {
        

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
    function payStake(uint _matchID) public payable checkValidityIdMatch(_matchID) onlyPlayer(_matchID) {

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
    function attackOpponent(uint _matchID, uint256 _attackedRow, uint256 _attackedCol) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) {
            
            Battle storage matchIstance = gamesArray[_matchID];

            // Check if it's the sender's turn to attack
            require(matchIstance.currentPlayerTurn == msg.sender, "Not your turn to attack");

            // Reset accused player and timeout
            matchIstance.accusedOpponent = address(0);
            matchIstance.timeoutForAccusation = 0;

            address opponent = (matchIstance.playerX == msg.sender) ? matchIstance.playerY : matchIstance.playerX;

            // Emit the attack event and update player turn
            emit attackPerformed(_matchID, msg.sender, opponent, _attackedRow, _attackedCol);
            matchIstance.currentPlayerTurn = opponent;
        }


    /**
    * @dev Records the provided merkle root for a player in a match, indicating readiness to start the match.
    * @param _merkleroot The merkle root hash of the player's match data.
    * @param _matchID The unique identifier of the match.
    */
    function registerMerkleRoot(bytes32 _merkleroot, uint _matchID) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) {

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


/* 
handles the submission of an attack proof for a specific match identified by _matchID. 
The function first verifies that the match is valid, the sender is one of the players, and the match hasn't started yet. 
Then, it calculates a Merkle root based on the provided Merkle proof and compares it with the Merkle root of the attacking player. 
Depending on whether the Merkle roots match or not, the function processes the attack, updates ship counts, and handles cheating situations. 
Finally, it checks for match completion conditions and transfers rewards if applicable while mitigating reentrancy vulnerabilities.
*/
    function submitAttackProof(uint _matchID, uint8 _attackResult, bytes32 _attackHash, bytes32[] memory merkleProof) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) merkleRootProvided(_matchID) {
        // get the match instance form gamesArray
        Battle storage matchInstance = gamesArray[_matchID];

        // set the computed merkle root to provided attack hash
        bytes32 computedMerkleRoot = _attackHash;

        // flag to indicate if cheating is detected
        bool cheaterDetected = false;

        // addresses to store the winner and loser
        address winner;
        address loser;

        // Calculate the computed Merkle root using the provided merkle proof
        for (uint i = 0; i < merkleProof.length; i++) {
            computedMerkleRoot = keccak256(abi.encodePacked(merkleProof[i] ^ computedMerkleRoot));
        }

        // Determine the player's Merkle root and the number of their remaining ships
        uint256 playerNumShips;
        bytes32 playerMerkleRoot;

        // get player's ship count and merkle root 
        (playerNumShips, playerMerkleRoot) = getPlayerInfo(matchInstance, msg.sender);

        // hash the player's Merkle root to compare with the computed root
        playerMerkleRoot = keccak256(abi.encodePacked(playerMerkleRoot));
        computedMerkleRoot = keccak256(abi.encodePacked(computedMerkleRoot));

        // If m root ==  player's merkle root -> attack is valid
        if (computedMerkleRoot == playerMerkleRoot) {
            //emit attack result event
            emit attackResult(_matchID, _attackResult, getOpponent(matchInstance, msg.sender));

             // ship destruction and updates based on the attack result
            if (_attackResult == 1) {
                if (msg.sender == matchInstance.playerX) {
                    matchInstance.NumShipsX--;
                } else {
                    matchInstance.NumShipsY--;
                }
            }
        } else {
            // get the winner and loser in case of cheating
            (winner, loser) = getWinnerAndLoser(matchInstance, msg.sender);
            // set metch status fo finished
            matchInstance.startedMatch = false;

            // emit match finished event with cheating msg
            emit matchFinished(_matchID, winner, loser, "CHEATING: Invalid attack proof!");
            cheaterDetected = true;
        }

        // check for match completion conditions and transfer rewards if applicable
        if (matchInstance.NumShipsX <= 0 || matchInstance.NumShipsY <= 0) {
            // determin winner sccording to ramaining ships
            winner = (msg.sender == matchInstance.playerX) ? matchInstance.playerY : matchInstance.playerX;
            
            // set match as finished
            matchInstance.startedMatch = false;

            // emit match finished
            emit matchFinished(_matchID, winner, msg.sender, "No more ships left!");
        }

        // reentrancy vuln mitigation with cheater set to false before transferring founds
        // if try to attack explointing the flag, will not succeed as state change occurs 
        // before the external call to transfer()
        /*
        if (cheaterDetected && winner != address(0)) {
            // Set the flag before the transfer
            cheaterDetected = false; // Reset the flag after the transfer is complete
            payable(winner).transfer(matchInstance.stake * 2);
        }*/
    }



function getPlayerInfo(Battle storage matchInstance, address player) internal view returns (uint256, bytes32) {
    if (player == matchInstance.playerX) {
        return (matchInstance.NumShipsX, matchInstance.merkleX);
    } else {
        return (matchInstance.NumShipsY, matchInstance.merkleY);
    }
}

function getOpponent(Battle storage matchInstance, address player) internal view returns (address) {
    return (player == matchInstance.playerX) ? matchInstance.playerY : matchInstance.playerX;
}

function getWinnerAndLoser(Battle storage matchInstance, address cheater) internal view returns (address, address) {
    if (cheater == matchInstance.playerX) {
        return (matchInstance.playerY, matchInstance.playerX);
    } else {
        return (matchInstance.playerX, matchInstance.playerY);
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
    function verifyBoard(uint _matchID, int256[] memory _cells) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) {

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




   
    function accuseOpponent(uint _matchID) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) {
    Battle storage matchInstance = gamesArray[_matchID];

    // Check if the match has already ended
    require(matchInstance.startedMatch == true, "Match not started yet");

    address accusedOpponent;

    // Determine the accused opponent based on the sender
    if (matchInstance.playerY == msg.sender) {
        accusedOpponent = matchInstance.playerX;
    } else {
        accusedOpponent = matchInstance.playerY;
    }

    // Check if the accused opponent has already been accused
    require(matchInstance.accusedOpponent != accusedOpponent, "Opponent already accused");

    bool timeoutExceeded = false;
    address winner;
    address loser;

    // Handle timeout scenario
    if (matchInstance.timeoutForAccusation != 0) {
        // Check if more than 5 blocks have passed since the notify was triggered
        if (block.number >= matchInstance.timeoutForAccusation) {
            // Determine the winner and transfer ETH accordingly
            if (matchInstance.accusedOpponent == matchInstance.playerY) {
                winner = matchInstance.playerX;
                loser = matchInstance.playerY;
            } else {
                winner = matchInstance.playerY;
                loser = matchInstance.playerX;
            }

            timeoutExceeded = true;

            // End the match due to timeout
            emit winnerIs(_matchID, winner, "AFK timeout reached: match finished!");
        } else {
            // Emit accusation notification
            emit accuse(_matchID, accusedOpponent, msg.sender);
        }
    } else {
        // Set the timeout for accusation and record the accused opponent
        matchInstance.timeoutForAccusation = block.number + 5;
        matchInstance.accusedOpponent = accusedOpponent;

        // Emit accusation notification
        emit accuse(_matchID, accusedOpponent, msg.sender);
    }

    if (timeoutExceeded && winner != address(0)) {
        // Transfer the stake to the accused opponent
        payable(winner).transfer(matchInstance.stake * 2);
    }
}



    function randomValue() private view returns (bytes32) {
        // Utilizza l'hash del blocco corrente e il numero casuale della beacon chain
        bytes32 randValue = keccak256(abi.encodePacked(blockhash(block.number), block.timestamp, block.basefee));
        return randValue;
    }
}


