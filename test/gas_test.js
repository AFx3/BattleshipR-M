const Battleship = artifacts.require("Battleship");
const truffleAssert = require("truffle-assertions");
const Web3Utils = require('web3-utils');

const fs = require("fs");
const gasFile = "gas_total_cost.json";
const board = {
    size: 8,
    cells: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1],
      [1, 1, 1, 1, 1, 1, 1, 1]
    ],
    shipNumber: 10,
};

fs.writeFileSync(gasFile, JSON.stringify({}));
var merkleTreeLevels = [];



contract("Compute gas cost for opponent report", (accounts) => {

    let battleship;
    const playerOne = accounts[0];
    const playerTwo = accounts[1];
    const data = {};
  
    before(async () => {
      battleship = await Battleship.deployed();
    });
  
    describe("Report opponent and wait match end", () => {
      const amount = 100000;
      let matchId;
  
      before(async () => {
        const tx = await battleship.NewMatch(board.size, board.shipNumber, { from: playerOne });
        matchId = tx.logs[0].args._assignedMatchID;
      });
  
      it("Join the match", async () => {
        await battleship.JoinMatch(matchId, { from: playerTwo });
      });
  
      it("Commit stake for the match", async () => {
        await battleship.proposeStake(matchId, amount, { from: playerOne });
        await battleship.acceptStake(matchId, { from: playerTwo });
      });
  
      it("Pay stake to the contract", async () => {
        await battleship.payStake(matchId, { from: playerOne, value: amount });
        await battleship.payStake(matchId, { from: playerTwo, value: amount });
      });
  
      it("Accuse opponent of having left the match", async () => {
        const tx = await battleship.accuseOpponent(matchId, { from: playerOne });
        data.accuseOpponent = tx.receipt.gasUsed;
      });
  
      it("Wait for five blocks", async () => {
        for (let i = 0; i < 5; i++) {
          await battleship.NewMatch(board.size, board.shipNumber, { from: playerOne });
        }
        const tx = await battleship.accuseOpponent(matchId, { from: playerOne });
        data.accuseOpponent = tx.receipt.gasUsed;
      });
  
      it("Save data to gas_total_cost.json", () => {
        const prev = JSON.parse(fs.readFileSync(gasFile));
        fs.writeFileSync(gasFile, JSON.stringify({ ...data, ...prev }));
      });
    });
  });
  

contract("Compute gas cost for a 8x8 board game", (accounts) => {
  let matchId;
  const playerOne = accounts[0];
  const playerTwo = accounts[1];
  let battleship;
  const data = {};

  before(async () => {
    battleship = await Battleship.deployed();
  });

  before(async () => {
    // Create game
    const tx = await battleship.NewMatch(board.size, board.shipNumber,{
      from: playerOne,
    });
    matchId = tx.logs[0].args._assignedMatchID;

    data.NewMatch = tx.receipt.gasUsed;
    truffleAssert.eventEmitted(tx, "UintOutput", (ev) => {
      matchId = ev._assignedMatchID;
      return ev._proposer == playerOne;
    });

    const tx2 = await battleship.JoinMatch(matchId, { from: playerTwo });
    data.JoinMatch = tx2.receipt.gasUsed;
  });

  describe("Play new match", () => {
    // Don't really know where to put this if not here
    it("Create game and join randomly", async () => {
      // Create game
      await battleship.NewMatch(board.size, board.shipNumber, {
        from: playerOne,
      });

      const tx = await battleship.JoinRandom({
        from: playerTwo,
      });
      data.JoinRandom = tx.receipt.gasUsed;
    });

    const amount = 100000;
    it("Propose a stake", async () => {
       

      const tx =  await battleship.proposeStake(matchId, amount, { from: playerOne });
      data.proposeStake = tx.receipt.gasUsed;
    });

    it("Opponent agree on proposed stake", async () => {
      const tx =  await battleship.acceptStake(matchId, { from: playerTwo });

      data.acceptStake = tx.receipt.gasUsed;
    });

    it("Players deposit stake to the contract", async () => {
      const tx =  await battleship.payStake(matchId, { from: playerOne, value: amount });

      data.payStake = tx.receipt.gasUsed;
      await battleship.payStake(matchId, { from: playerTwo, value: amount });

    });

    let p1_treeRoot;
    let p2_treeRoot;
    it("Players commit their board by registering Merkle Root", async () => {
      // we cannot use browser crypto utils, therefore, for testing only,
      // use weak salts

      // Format:
      // isShip, salt, boardIndex+
  
      salt = Math.floor(Math.random() * board.size);
      p1_treeRoot = generateMerkleTree(board,salt);

      
      const tx = await battleship.registerMerkleRoot(p1_treeRoot, matchId, { from: playerOne });
      data.registerMerkleRoot = tx.receipt.gasUsed;

      // same board, but different (weak) salts
      p2_treeRoot = generateMerkleTree(board,salt);
      await battleship.registerMerkleRoot(String(p2_treeRoot), matchId, { from: playerTwo });
    });

    

    it("Players attack each other", async () => {
      // Player who joined the game always starts attacking first
      
    
      //Generate 8x8 shoot combination
      let finish = false;
        for (let i = 0; i < 8 && !finish; i++) {
            for (let j = 0; j < 8 && !finish; j++){

              try{
                txAttack =  await battleship.attackOpponent(matchId, i, j, { from: playerOne });
                data.attackOpponent = txAttack.receipt.gasUsed;

                var merkleProof = generateMerkleProof(board, i, j);
                let flatIndex = i * board.size + j;

                txAttackProof = await battleship.submitAttackProof(matchId, String(board.cells[i][j]), String(merkleTreeLevels[0][flatIndex]), merkleProof, { from: playerTwo });
                data.submitAttackProof = txAttackProof.receipt.gasUsed;

         
                txAttack =  await battleship.attackOpponent(matchId, i, j, { from: playerTwo });
                data.attackOpponent = txAttack.receipt.gasUsed;

                var merkleProof = generateMerkleProof(board,i, j);
                txAttackProof = await battleship.submitAttackProof(matchId, String(board.cells[i][j]), String(merkleTreeLevels[0][flatIndex]), merkleProof, { from: playerOne });
                data.submitAttackProof = txAttackProof.receipt.gasUsed;
              }catch(error){
              
               //As the game is over, we can't attack anymore
               //The `error` is generated by another attack perfomed when the `matchFinished` is already fired
               //so to avoid listening to the event twice, we just break the loop
               finish = true;
               break;
             
            }


            }
        }

    

    });

    it("Player one send board for verification", async () => {

      txVerification = await battleship.verifyBoard(matchId, board.cells.flat(), { from: playerOne });
      data.verifyBoard = txVerification.receipt.gasUsed;

      //Check if the event is fired
      truffleAssert.eventEmitted(txVerification, "winnerIs"); 


    });

    
    it("Save data to gas_total_cost.json", () => {
      const prev = JSON.parse(fs.readFileSync(gasFile));
      fs.writeFileSync(gasFile, JSON.stringify({ ...data, ...prev }));
    });
  });
});

function generateMerkleTree(humanGrid, salt) {
    
  
    let flattenBoard = humanGrid.cells.flat();

    let leafNodes = flattenBoard.map(cellState => {
    
      const value = Web3Utils.keccak256(String(cellState + salt));
      return value;
    });

    merkleTreeLevels = [leafNodes];

    while (leafNodes.length > 1) {
      let lastLevel = [];
      
      for (let i = 0; i < leafNodes.length; i += 2) {
        let leftChild = leafNodes[i];
        let rightChild = (i + 1 < leafNodes.length) ? leafNodes[i + 1] : leftChild;
        
        let combinedHash = Web3Utils.keccak256(xor(String(leftChild),String(rightChild)));
        lastLevel.push(combinedHash);
      }

      leafNodes = lastLevel;
      merkleTreeLevels.push(leafNodes);
    }


    return leafNodes[0];


  
  
  
  }

function generateMerkleProof(humanGrid, row, col) {

    var merkleProof = [];
    let flatIndex = row * humanGrid.size + col;
  
    merkleTreeLevels.forEach(arr => {
      if (arr.length > 1) {
        let siblingIndex = flatIndex % 2 === 0 ? flatIndex + 1 : flatIndex - 1;
        merkleProof.push(String(arr[siblingIndex]));
        flatIndex = Math.floor(flatIndex / 2);
      }
    });
  
    return merkleProof;

  }



function xor(first, second) {
  // Convert hexadecimal strings to BigInt
  const intermediate1 = BigInt(first);
  const intermediate2 = BigInt(second);

  // Perform XOR operation and convert the result to a hexadecimal string
  const intermediate = (intermediate1 ^ intermediate2).toString(16);

  // Prepend "0x" to the result string and ensure it has a length of 64 characters (32 bytes) by adding leading zeros if necessary
  const result = "0x" + intermediate.padStart(64, "0");

  // Return the resulting hexadecimal string
  return result;
}


  