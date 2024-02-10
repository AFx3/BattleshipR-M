const Battleship = artifacts.require("Battleship");
const truffleAssert = require("truffle-assertions");
const Web3Utils = require('web3-utils');

const fs = require("fs");
const gasFile = "gas_evaluation.json";
// test parameters
const shipNumber = 10;
const boardSize = 8;

const board = {
    size: boardSize,
    cells: [],
    shipNumber: shipNumber,
};

// fill the board for the test 8x8
for (let i = 0; i < boardSize; i++) {
    board.cells.push([]);
    for (let j = 0; j < boardSize; j++) {
      if (i === 2) {
        // 3 row with 1
        board.cells[i].push(1); 
      } else {
        // othrs cells 0
        board.cells[i].push(0); 
      }
    }
  }
// write empty json object
fs.writeFileSync(gasFile, JSON.stringify({}));

var merkleTreeLevels = [];
contract("Compute gas opponent", (accounts) => {

    let battleship;
    const [playerX, playerY] = accounts;
    const data = {};
  
    before(async () => {
      battleship = await Battleship.deployed();
    });
  
    describe("Report opponent and wait match end", () => {
      const amount = 1000;
      let matchId;
  
      before(async () => {
        const tx = await battleship.NewMatch(board.size, board.shipNumber, { from: playerX });
        matchId = tx.logs[0].args._assignedMatchID;
      });
  
      it("Join match", async () => {
        await battleship.JoinMatch(matchId, { from: playerY });
      });
  
      it("Commit stake", async () => {
        await battleship.proposeStake(matchId, amount, { from: playerX });
        await battleship.acceptStake(matchId, { from: playerY });
      });
  
      it("Stake to contract", async () => {
        await battleship.payStake(matchId, { from: playerX, value: amount });
        await battleship.payStake(matchId, { from: playerY, value: amount });
      });
  
      it("Accuse opponent left match", async () => {
        const tx = await battleship.accuseOpponent(matchId, { from: playerX });
        data.accuseOpponent = tx.receipt.gasUsed;
      });
  
      it("Wait 5 blocks", async () => {
        for (let i = 0; i < 5; i++) {
          await battleship.NewMatch(board.size, board.shipNumber, { from: playerX });
        }
        const tx = await battleship.accuseOpponent(matchId, { from: playerX });
        data.accuseOpponent = tx.receipt.gasUsed;
      });
  
      it("Save gas cost", () => {
        const prev = JSON.parse(fs.readFileSync(gasFile));
        fs.writeFileSync(gasFile, JSON.stringify({ ...data, ...prev }));
      });
    });
  });
  
// Contract testing for computing gas cost for an 8x8 board game
contract("Compute gas cost", (accounts) => {
  let matchId;
  const [playerX, playerY] = accounts;
  let battleship;
  const data = {};

  before(async () => {
    battleship = await Battleship.deployed();
  });

  before(async () => {
    // Create game
    const tx = await battleship.NewMatch(board.size, board.shipNumber, {from: playerX,});
    matchId = tx.logs[0].args._assignedMatchID;

    data.NewMatch = tx.receipt.gasUsed;

    // check if the event is fired
    truffleAssert.eventEmitted(tx, "newMatchCreated", (ev) => {
      matchId = ev._assignedMatchID;
      return ev._proposer == playerX;
    });

    const tx2 = await battleship.JoinMatch(matchId, { from: playerY });
    data.JoinMatch = tx2.receipt.gasUsed;
  });

  describe("Play new match", () => {
    // Don't really know where to put this if not here
    it("Create game and join randomly", async () => {
      // Create game
      await battleship.NewMatch(board.size, board.shipNumber, {
        from: playerX,
      });

      const tx = await battleship.JoinRandom({
        from: playerY,
      });
      data.JoinRandom = tx.receipt.gasUsed;
    });

    const amount = 1000;
    it("Propose a stake", async () => {
       

      const tx =  await battleship.proposeStake(matchId, amount, { from: playerX });
      data.proposeStake = tx.receipt.gasUsed;
    });

    it("Opponent agree", async () => {
      const tx =  await battleship.acceptStake(matchId, { from: playerY });

      data.acceptStake = tx.receipt.gasUsed;
    });

    it("Stake to the contract", async () => {
      const tx =  await battleship.payStake(matchId, { from: playerX, value: amount });

      data.payStake = tx.receipt.gasUsed;
      await battleship.payStake(matchId, { from: playerY, value: amount });

    });

    let p1_treeRoot;
    let p2_treeRoot;
    it("Registering Merkle Root players", async () => {
  
      salt = Math.floor(Math.random() * board.size);
      p1_treeRoot = merkleTree(board,salt);

      
      const tx = await battleship.registerMerkleRoot(p1_treeRoot, matchId, { from: playerX });
      data.registerMerkleRoot = tx.receipt.gasUsed;

      // same board, but different (weak) salts
      p2_treeRoot = merkleTree(board,salt);
      await battleship.registerMerkleRoot(String(p2_treeRoot), matchId, { from: playerY });
    });

    

    it("Players attack each other", async () => {
        let finish = false;
        for (let i = 0; i < 8 && !finish; i++) {
            for (let j = 0; j < 8 && !finish; j++){
                try {
                    let txAttack =  await battleship.attackOpponent(matchId, i, j, { from: playerX });
                    data.attackOpponent = txAttack.receipt.gasUsed;
                    const merkleProof = genMerkleProof(board, i, j);
                    const flatIndex = i * board.size + j;
                    let txAttackProof = await battleship.submitAttackProof(matchId, String(board.cells[i][j]), String(merkleTreeLevels[0][flatIndex]), merkleProof, { from: playerY });
                    data.submitAttackProof = txAttackProof.receipt.gasUsed;
                    txAttack =  await battleship.attackOpponent(matchId, i, j, { from: playerY });
                    data.attackOpponent = txAttack.receipt.gasUsed;
                    txAttackProof = await battleship.submitAttackProof(matchId, String(board.cells[i][j]), String(merkleTreeLevels[0][flatIndex]), merkleProof, { from: playerX });
                    data.submitAttackProof = txAttackProof.receipt.gasUsed;
                } catch(error) {
                    finish = true;
                    break;
                }
            }
        }
    });

    it("Player one send board for verification", async () => {
        const txVerification = await battleship.verifyBoard(matchId, board.cells.flat(), { from: playerX});
        data.verifyBoard = txVerification.receipt.gasUsed;
        truffleAssert.eventEmitted(txVerification, "winnerIs"); 
    });

    
    it("Gas cost", () => {
      const prev = JSON.parse(fs.readFileSync(gasFile));
      fs.writeFileSync(gasFile, JSON.stringify({ ...data, ...prev }));
    });
  });
});

function generateRandomSalt() {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  }

  function merkleTree(playerGrid, salt) {
    let boardForMT = playerGrid.cells.flat();

    // generate leaf nodes using hashed values
    let leafNodes = boardForMT.map(cellState => { 
      let salt = BigInt(generateRandomSalt()); // generate a random salt
      
      // concatenate the cell state and salt, then hash the result
      const val = Web3Utils.keccak256(String(cellState) + String(salt));
      return val;
    });

    merkleTreeLevels = [leafNodes]; // array to store the LEVELS of the MT
    // build MT
    while (leafNodes.length > 1) {
      let lastLevel = [];

      // iterate through leaf nodes pairwise to compute parent nodes
      for (let i = 0; i < leafNodes.length; i += 2) {

        let leftChild = leafNodes[i];
        let rightChild;
          if (i + 1 < leafNodes.length) {
            rightChild = leafNodes[i + 1];
          } else {
            rightChild = leftChild;
          }

         // combine the hashes of left and right children 
        let combinedHash = Web3Utils.keccak256(xor(String(leftChild), String(rightChild)));
        lastLevel.push(combinedHash); // push the combined hash to the last level
      }
      // update leaf nodes with the parent nodes
      leafNodes = lastLevel;
      // store the current level in the Merkle tree levels array
      merkleTreeLevels.push(leafNodes);
    }


    return leafNodes[0];
}



function genMerkleProof(playerGrid, row, col) {

    var merkleProof = [];
    let flatIndex = row * humanGrid.size + col;
  
    for (var arr of merkleTreeLevels) {
        // if current level has more than one node
        if (arr.length > 1) {
          // index of the sibling node
          let siblingIndex = flatIndex % 2 === 0 ? flatIndex + 1 : flatIndex - 1;
          
          // sibling node added to the proof
          merkleProof.push(arr[siblingIndex].toString());
          
          // update flat index to the parent node
          flatIndex = Math.floor(flatIndex / 2);
        }
      }
  
    return merkleProof;

  }


function xor(first, second) {
  const intermediate1 = BigInt(first);
  const intermediate2 = BigInt(second);
  const intermediate = (intermediate1 ^ intermediate2).toString(16);
  const result = "0x" + intermediate.padStart(64, "0");
  // Return the resulting hexadecimal string
  return result;
}


  