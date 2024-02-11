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


    // Array of matches
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
    modifier isnotAccused(uint _matchID) {
        // Ensure the sender is not the accused opponent in the specified match
        require(gamesArray[_matchID].accusedOpponent != msg.sender, "impossible to accuse opponent again");
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

    // create a new match with specified board size and number of ships
    function createMatch(uint _boardSize, uint _numberOfShips) public validSize(_boardSize) {

        // Create a new Battle instance
        Battle memory newMatch;

        // set match parameters
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

        // insert the new match to the gamesArray
        gamesArray.push(newMatch);
        // increment the counter for active matches
        currentGames++;
        // output an event for the creation of a new match
        emit newMatchCreated(msg.sender, gamesArray.length-1);
    }


    // define function to join a specific match by match ID
    function JoinMatch(uint _matchID) checkValidityIdMatch(_matchID) public {

        // matchInstance is a reference as type Battle to the specific match ID, with storage matchInstance points to the blockchain (not a copy of the data)
        Battle storage matchIstance = gamesArray[_matchID];
        // check if the match is joinable
        require(currentGames > 0, "No available matches!");

        uint returnIndex = _matchID;
        // check conditions before allowing a player to join the match
        require(matchIstance.playerX != address(0), "No player in this match");
        require(matchIstance.playerY == address(0), "Both players already joined");
        require(matchIstance.joinableMatch, "Match not joinable");
        require(matchIstance.playerX != msg.sender, "You are already in this match");

        // set the match as no longer joinable and assign the current player (msg.sender) as playerY
        matchIstance.joinableMatch = false;
        matchIstance.playerY = msg.sender;
        // so decrement the count of available matches
        currentGames--;
        // send event to notify the players have joined the match
        emit playersJoined(
            matchIstance.playerX,
            matchIstance.playerY,
            matchIstance.stakeProposal,
            returnIndex,
            matchIstance.boardSize,
            matchIstance.NumShipsX
        );
    }

    // private function to find a joinable match
    function findJoinableMatch() private view returns (uint) {

        bytes32 rand = randomValue(); 
        // convert it to a valid index within the range of active matches
        uint remainingIndex = uint(rand) % currentGames + 1; 
        // Iterate through the match list to find a joinable match.
        for (uint i = 0; i < gamesArray.length; i++) {
            // check if the current match is joinable
            if (gamesArray[i].joinableMatch) { 
                // if the remaining index is 1 -> found the desired match
                if (remainingIndex == 1) { 
                    // return the index of the joinable match
                    return i; 
                }
                // decrement the remaining index if the current match is not joinable
                remainingIndex--; 
            }
        }
        return gamesArray.length; // No joinable match found, return the length of the match list.
    }

    // function for random value
    function randomValue() private view returns (bytes32) {
        // uses th hash of the current block and the random number from the beacon chain
        bytes32 randValue = keccak256(abi.encodePacked(blockhash(block.number), block.timestamp, block.basefee));
        return randValue;
    }

    // function to join a RANDOM MATCH (a game must be created)
    function randomGame() public {
        // need available matches
        require(currentGames > 0, "No matches found");

        // find a joinable match and store its index in returnIndex
        uint returnIndex = findJoinableMatch();

        // a valid match index is returned
        require(returnIndex < gamesArray.length, "No available matches!");

        // cccess the matched game using its index and store it in matchedGame
        Battle storage matchedGame = gamesArray[returnIndex];

        // the current player (msg.sender) is not already in the match
        require(matchedGame.playerX != msg.sender, "You are in this match");

        // assign the current player (msg.sender) as playerY and mark the match as no longer joinable
        matchedGame.playerY = msg.sender;
        matchedGame.joinableMatch = false;
        // decrement the counter
        currentGames--;

        // emit event s.t. players have joined the match
        emit playersJoined(
            matchedGame.playerX,
            matchedGame.playerY,
            matchedGame.stakeProposal,
            returnIndex,
            matchedGame.boardSize,
            matchedGame.NumShipsX
        );
    }

    // function to propose a stake for a specific match (1st step for the amont of eth)
    function proposeStake(uint _matchID, uint _stake) checkValidityIdMatch(_matchID) public {

        // get the match instance from the gamesArray based on ID
        Battle storage matchInstance = gamesArray[_matchID];

        // ensure that the sender is one of the players in the match
        require(matchInstance.playerX == msg.sender || matchInstance.playerY == msg.sender, "Unauthorized player");

        // set the proposed stake amount for the match
        matchInstance.stakeProposal = _stake;
        // set the sender's address as the stake proposer
        matchInstance.stakeProposer = msg.sender;
        //notify that a stake proposal has been made
        emit stakeProposal(_matchID, _stake, msg.sender);
    }


    // function to accept the proposed stake for a specific match (2nd step for the amont of eth)
    function stakeConfirm(uint _matchID) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) stakeVariable(_matchID) {
        
        // get the match instance from the gamesArray based on ID
        Battle storage matchIstance = gamesArray[_matchID];
        // ensure that the sender is not the stake proposer
        require(matchIstance.stakeProposer != msg.sender, "It' your stake, nisba!");
        // Set the stake amount for the match to the proposed stake
        matchIstance.stake = matchIstance.stakeProposal;

        // notify that the stake proposal has been accepted
        emit stakeAccepted(_matchID, matchIstance.stake);
    }

/* function allowing players to send eth as a stake for a match (given the ID).
Ensure:
1) match ID provided is valid 
2) sender of transaction is one of the players in the match
3) the sent Ether stake is greater than 0.
If ok -> update the player's eth stake (based on sender add)
If sender is player X -> eth is added to player X's stake (stakeX).
If sender is player Y -> eth is added to player Y's stake (stakeY). */

    function sendEth(uint _matchID) public payable checkValidityIdMatch(_matchID) onlyPlayer(_matchID) {

        // check if sent Ether stake is greater than 0
        require(msg.value > 0, "no way!");

        // update the corresponding player's Ether stake
        if (gamesArray[_matchID].playerX == msg.sender) {
            gamesArray[_matchID].stakeX += msg.value; 
        } else {
            gamesArray[_matchID].stakeY += msg.value; 
        }
    }


    // manage the attacks, account for timeout,
    function shot(uint _matchID, uint256 _attackedRow, uint256 _attackedCol) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) {
        // get the match instance from the gamesArray based on ID
        Battle storage matchIstance = gamesArray[_matchID];

        // require it is the sender's turn to attack
        // checks if it's the sender's turn to attack by comparing the current player turn with the sender's address
        require(matchIstance.currentPlayerTurn == msg.sender, "Not your turn to attack");

        // reset accused player and timeout
        matchIstance.accusedOpponent = address(0);
        matchIstance.timeoutForAccusation = 0;

        // determine the opponent based on the sender's address
        address opponent = (matchIstance.playerX == msg.sender) ? matchIstance.playerY : matchIstance.playerX;

        // emit the attack event 
        emit attackPerformed(_matchID, msg.sender, opponent, _attackedRow, _attackedCol);
        // update player turn
        matchIstance.currentPlayerTurn = opponent;
    }


    // function to register the Merkle root for a specific matc by the id
    function sendMerkleRoot(bytes32 _merkleroot, uint _matchID) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) {
        // get the match instance from the gamesArray based on ID
        Battle storage matchData = gamesArray[_matchID];
        // if the sender of transaction is the  playerX
        if (msg.sender == matchData.playerX) {
            // set the merkel root for playerX 
            matchData.merkleX = _merkleroot;
        } else {
            // set the merkel root for playerY
            matchData.merkleY = _merkleroot;
        }
        // if both players have provided their merkle roots to start the match (spawn a Tr)
        if (matchData.merkleY != 0 && matchData.merkleX != 0) {
            // set the flag for match start
            matchData.startedMatch = true;
            // emit the match has started
            emit matchStarted(_matchID, matchData.playerX, matchData.playerY);
        }
    }


/* function for submit of an attack proof (specific ID match) I need:
1) match must be valid, 
2) sender is one of the players
3) the match hasn't started yet
operations:
4) Calculates a Merkle root based on the provided Merkle proof 
5) compares it with the merkle root of the attacking player
IF Merkle roots match -> do the attack
                         updates ship counts
6) check the match is ended 
7) transfers money to the winne*/

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
            emit matchFinished(_matchID, winner, loser, "not valid attack!");
            cheaterDetected = true;
        }

        // check for match completion conditions and transfer rewards if applicable
        if (matchInstance.NumShipsX <= 0 || matchInstance.NumShipsY <= 0) {
            // determin winner sccording to ramaining ships
            winner = (msg.sender == matchInstance.playerX) ? matchInstance.playerY : matchInstance.playerX;
            
            // set match as finished
            matchInstance.startedMatch = false;

            // emit match finished
            emit matchFinished(_matchID, winner, msg.sender, "No ships left!");
        }

    }


    // retreive informations about the player
    function getPlayerInfo(Battle storage matchInstance, address player) internal view returns (uint256, bytes32) {
        // return the number of ships and the MR based if the player is X || Y
        // check if the player is playerX
        if (player == matchInstance.playerX) {
            // if playerX -> return the #ships and MR
            return (matchInstance.NumShipsX, matchInstance.merkleX);
        } else {
            // return palyerY stuff
            return (matchInstance.NumShipsY, matchInstance.merkleY);
        }
    }

    function getOpponent(Battle storage matchInstance, address player) internal view returns (address) {
        // return the opponent's address based on whether the provided player is playerX or playerY
        return (player == matchInstance.playerX) ? matchInstance.playerY : matchInstance.playerX;
    }

    function getWinnerAndLoser(Battle storage matchInstance, address cheater) internal view returns (address, address) {
        // determine the winner and loser based on the address of the player who cheated
        if (cheater == matchInstance.playerX) {
            return (matchInstance.playerY, matchInstance.playerX);
        } else {
            return (matchInstance.playerX, matchInstance.playerY);
        }
    }


    function verifyBoard(uint _matchID, int256[] memory _cells) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) {
        // get match instance from gamesArray
        Battle storage matchInstance = gamesArray[_matchID];

        // store the winner and loser
        address winner;
        address loser;

        // check who is winner or loser acc to remaining ships
        if ((msg.sender == matchInstance.playerX && matchInstance.NumShipsY <= 0) || 
            (msg.sender == matchInstance.playerY && matchInstance.NumShipsX <= 0)) {
                // / set winner and loser based on the sender's address
                winner = (msg.sender == matchInstance.playerX) ? matchInstance.playerX : matchInstance.playerY;
                loser = (msg.sender == matchInstance.playerX) ? matchInstance.playerY : matchInstance.playerX;
        } else {
            // revert if there is no winner (cheating detected)
            revert("Error: no winner!");
        }

        // get size of the board and the actual length of the provided cells array 
        uint256 declaredSize = matchInstance.boardSize;
        uint256 actualLength = _cells.length;

        // check if the actual board size matches the declared size
        if (actualLength != declaredSize * declaredSize) {
            // emit an event indicating that the opponent declared a different board size and transfer rewards to the loser
            emit winnerIs(_matchID, loser, "Opponent declared a different board size!");
            // so transfer
            transferRewards(loser, _matchID, true);
            return;
        }

        // number of remaining ships based on the provided cells array
        uint ships = 0;
        for (uint i = 0; i < _cells.length; i++) {
            if (_cells[i] >= 1) {
                ships++;
            }
        }
        // check if the number of remaining ships matches the declared number of ships
        uint256 shipsNumber = matchInstance.fixedShipsNumber;
        if (ships < shipsNumber) {
            emit winnerIs(_matchID, loser, "Opponent declared a different number of ships!");
            transferRewards(loser, _matchID, true);
            return;
        }
        // here NO cheating detected, transfer rewards to the winner.
        emit winnerIs(_matchID, winner, "ETH transferred to your account!");
        transferRewards(winner, _matchID, false);
    }


    function transferRewards(address _recipient, uint _matchID, bool _cheaterDetected) internal {
        // get match instance
        Battle storage matchInstance = gamesArray[_matchID];
        // calculate the reward amount (twice the stake)
        uint256 reward = matchInstance.stake * 2;

        // transfer rewards based on cheating detection
        if (_cheaterDetected) {
            // transfer rewards to the recipient
            payable(_recipient).transfer(reward);
        } else {
            // determine the loser based on the recipient
            address loser = (_recipient == matchInstance.playerX) ? matchInstance.playerY : matchInstance.playerX;
            // transfer rewards to the recipient and the lose
            payable(_recipient).transfer(reward);
            payable(loser).transfer(reward);
        }

        // remove the match from the list.
        delete gamesArray[_matchID];
    }

    // function to accuse the opponent of cheating
    function accuseOpponent(uint _matchID) public checkValidityIdMatch(_matchID) onlyPlayer(_matchID) isnotAccused(_matchID) {
        
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
                emit accuse(_matchID, accusedOpponent, msg.sender);
            }
        } else {
            // Set the timeout for accusation and record the accused opponent
            matchIstance.timeoutForAccusation = block.number + 5;
            matchIstance.accusedOpponent = accusedOpponent;

            // Emit accusation notification
            emit accuse(_matchID, accusedOpponent, msg.sender);
        }

        if(timeoutExceeded && winner != address(0)){
            // Transfer the stake to the accused opponent
            payable(winner).transfer(matchIstance.stake * 2);
        }
    }
    
}




