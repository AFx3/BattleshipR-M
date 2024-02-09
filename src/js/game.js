// Set game variables
var matchID = null;                 // Ientifier of the match
var ethStake = null;                // Amount of ETH staked
var boardSize = 10;                 // 10x10 grid
var merkleRoot = null;              // store Merkle Root
var merkleTreeLevels = [];          // Array for Merkle Tree
var numberOfShips = 17;             // Ships
var playerShipsNumber = null;       // actual #ships of the player
var playerGrid = null;
var computerGrid = null;
var humanFleet = null;
var computerFleet = null;
var attackedRow = null;             // Row of the attacked cell
var attackedCol = null;             // Column of the attacked cell
var enemyHittedPos = new Set();     // Set of cells hitted positions by the enemy player
const data = {};
const gasFile = "gas_analysis.json";
var CONST = {};
CONST.AVAILABLE_SHIPS = ['asimovship', 'wormholecraft', 'destroyer', 'deathstar', 'warship'];
CONST.HUMAN_PLAYER = 0;
CONST.COMPUTER_PLAYER = 1;
// Possible values for the parameter `type` (string)
CONST.CSS_TYPE_EMPTY = 'empty';
CONST.CSS_TYPE_SHIP = 'ship';
CONST.CSS_TYPE_MISS = 'miss';
CONST.CSS_TYPE_HIT = 'hit';
CONST.CSS_TYPE_SUNK = 'sunk';
// Grid code:
CONST.TYPE_EMPTY = 0; // 0 = water (empty)
CONST.TYPE_SHIP = 1; // 1 = undamaged ship
CONST.TYPE_MISS = 2; // 2 = water with a cannonball in it (missed shot)
CONST.TYPE_HIT = 3; // 3 = damaged ship (hit shot)
CONST.TYPE_SUNK = 4; // 4 = sunk ship


// Define APP object to manage interactions between the UI and the contract
App = {
  // provider Web3
  web3Provider: null, 
  contracts: {}, // game's contracts

  // initialize the app
  init: async function () {
    return await App.initWeb3();
  },
  
  // initialize web3 provider
  initWeb3: async function () {

    // check if winow.ethereum is available to use Metamask
    if (window.ethereum) {
      App.web3Provider = window.ethereum; // Set the Web3 provider as winow.ethereum
      try {
        // Send a request to the user to enable Metamask account
        await window.ethereum.enable(); 

      } catch (error) {
        console.error("User denied account access"); 
        alertFire('Error', 'error contract side: ' + error.message, 'error', false, 0);
 
      }
    }
    else if (window.web3) {
      App.web3Provider = window.web3.currentProvider; //use web3 provider
    }
    else {
      App.web3Provider = new Web3.providers.HttpProvider("http://localhost:7545"); // fallback to local provider
    }


    // create web3 instance with the provider available
    web3 = new Web3(App.web3Provider);
  
    // set the default account on Metamask
    web3.eth.defaultAccount = web3.eth.accounts[0];

    // get connected wallet address
    document.getElementById('wallet-info').innerText = "Connected wallet: " + web3.eth.defaultAccount;
   
    // log the wallet address
    console.log("[INIT] Wallet address: ", web3.eth.defaultAccount);

    // load parameters game
    loadParam();
    return App.initContract();
  },

  // SMART CONTRACT INITIALIZATION

  initContract: function () {
    $.getJSON("Battleship.json", function (data) {
      // Get the necessary contract artifact file and instantiate it with truffle-contract
      BattleshipArtifact = data; 

      // initialize the contract
      App.contracts.Battleship = TruffleContract(BattleshipArtifact);

      // Set the web3 provider for the contract
      App.contracts.Battleship.setProvider(App.web3Provider);
    });

    return App.registerUIevents();
  },


  // define async funtion to manage the events related to UI
  // so all the event handlers
  registerUIevents: async function () {
    
    // event when HTML doc is loaded
    $(document).ready(function() {
      // event: when the user clicks on the new game button, call the NewMatch function to set up a new game
        $("#newGameBtn").click(function() {
          App.NewMatch();
          showFormAndProposal("waiting...");

        }); 
        
        // event: when the user clicks on the join by ID button, show the form to insert the match ID
        $("#joinByIdBtn").click(function() {
          $("#buttons").hide();
          $("#formContainer").hide();
          $("#opponentProposal").hide();
          $("#joinByIdForm").show();
          $("#searchingGame").hide();
        });
      
        // event: when the user clicks on the join random button, call the JoinRandomGame function to join a random game
        $("#joinRandomBtn").click(function() {
          $("#buttons").hide();
          $("#formContainer").hide();
          $("#opponentProposal").hide();
          $("#joinByIdForm").hide();
          $("#searchingGame").hide();
          App.JoinRandomGame();

        });
      
        // event user send a stake proposal, and call CommitStake() to confirm the stake
        $("#betForm").submit(function (event) {
            event.preventDefault();
            App.CommitStake();
            ethAmount = $("#ethAmount").val();
           $("#yourProposalText").text(`${ethAmount} ETH`);
           document.getElementById("yourProposalText").style.color = "green";
           $("#accept-proposal").prop("disabled", true);

          });
          
          // event to join via match ID
          $("#joinByIdForm").submit(function (event) {
            event.preventDefault();
            const matchID = $("#gameId").val();
            App.JoinMatchId(matchID);
          });

           // event for the "Accept proposal" button
            $("#accept-proposal").click(function () {
                App.AcceptStake();
            });

          
      });
      
      // function to show the form and the proposal on UI
      function showFormAndProposal(opponentProposal) {
        $("#accept-proposal").prop("disabled", true);
        $("#buttons-init").hide();
        $("#formContainer").show();
        $("#yourProposalText").text(opponentProposal);
        $("#opponentProposal").show();

      }

   },


   // I Have 3 cases: join by ID, join random, and new game

   // 1st function to create a NEW MATCH
   NewMatch: function () {
    // 1) Deploy the contract instance
    App.contracts.Battleship.deployed()
      .then(async function (instance) {

        // Get the deployed contract instance
        battleshipInstance = instance;
        // Call the NewMatch function on the contract to set up the new Match ID
        return battleshipInstance.NewMatch(boardSize, numberOfShips);
      })
      .then(async function (receipt) {
        // Extract match ID from the event logs
        var logsArray = receipt.logs;
        matchID = logsArray[0].args._assignedMatchID.toNumber();
        
        // Handle match ID validation
        if (matchID < 0) {
          // Display error message
          alertFire('Error', 'Inserisci in ID valido', 'error', false, 0);

  
          console.error("Invalid match ID");
          App.ResetGame();
        } else {
          // Update UI elements and display success message
          document.getElementById('game-info').innerText = "Match ID: " + matchID;
          
          alertFire('The game is ready, ID:' + matchID + ' .', 'Stake or Wait', 'success', false, 0);

           
          App.event_loop();
        }
      })
      .catch(function (err) {
        // Handle contract error and display error message
        console.error(err);
        alertFire('Error', 'Contract err: ' + err.message, 'error', false, 0);

      });
  },
  
  // 2nd function to join game randomly

  JoinRandomGame: function () {
    // Deploy the Battleship contract instance
    App.contracts.Battleship.deployed()
      .then(function (instance) {
        // Get the Battleship contract instance
        battleshipInstance = instance;
        // Call the JoinRandom function on the contract
        return battleshipInstance.JoinRandom();
      })
      .then(function (receipt) {
        // Extract infos from recepit
        const log = receipt.logs[0];
        matchID = log.args._matchID.toNumber();
        ethStake = log.args._stakeTemp.toNumber();
        boardSize = log.args._boardSize.toNumber();
        numberOfShips = log.args._numberOfShips.toNumber();
        playerShipsNumber = numberOfShips;
  
        // Log initial stake and update UI
        console.log("[JoinRandomGame " + matchID + "] Initial stake:", ethStake);
        if (ethStake === null || ethStake <= 0) {

          //show the rival proposal
          $("#opponentProposal").show();

          // set red as others when there is a different stake
          document.getElementById("yourProposalText").style.color = "red";

          // disable the button if the proposal is not valid (null, <0)
          document.getElementById('accept-proposal').disabled = ethStake === null || ethStake <= 0;

          // update the stake proposal with the amount converted from wei to eth
          $("#yourProposalText").text(" " + window.web3Utils.fromWei(ethStake.toString()) + " ETH");

          // hide unuseful objects form the UI
          $("#joinByIdForm, #buttons-init").hide();

          // show the proposal on the UI
          $("#formContainer").show();
          // update the game ID to the UI
          $("#game-info").text("Match ID: " + matchID);

          // start the event loop
          App.event_loop();

        } else {
          // Display success message and update UI
          alertFire('Match ' + matchID + ' joined!', 'The price is ' + window.web3Utils.fromWei(ethStake.toString()) + ' ETH', 'success', false, 0);
          // Update UI elements
          document.getElementById('game-info').innerText = "Match ID: " + matchID;

          App.AcceptStake();
          App.event_loop();
        }
      })
      .catch(function (err) {
        // Handle errors and display error message
        console.error(err);
        alertFire('Error', 'No games available now', 'error', false, 0);
   
      });
  },


  // define function to join a match by id
  JoinMatchId: function (insertedGameID) {
    // check if match ID is valid
    if (insertedGameID == null || insertedGameID == undefined || insertedGameID < 0) {

      alertFire('Error', 'invalid match ID', 'error', false, 0);

    } else {
      // get contract instance
      App.contracts.Battleship.deployed()
        .then(function (instance) {
          battleshipInstance = instance; //call the JoinMatch function on the contract with the id of the match
          return battleshipInstance.JoinMatch(insertedGameID);
        })
        .then(function (receipt) {
          // print to console recepit infos
          console.log("[JoinMatchId " + matchID + "] Initial stake:", ethStake);
          // extact game infos from the receipt
          matchID = insertedGameID;
          ethStake = receipt.logs[0].args._stakeTemp.toNumber();
          boardSize = receipt.logs[0].args._boardSize.toNumber();
          numberOfShips = receipt.logs[0].args._numberOfShips.toNumber();
          playerShipsNumber = numberOfShips;
          
          // show the proposal 
          $("#opponentProposal").show();
          
          // show the proposal on the UI
          document.getElementById("yourProposalText").style.color = "red";

          // diasble the button if the proposal is not valid (null, <0)
          document.getElementById('accept-proposal').disabled = !(ethStake && ethStake > 0);

          // update the stake proposal with the amount converted from wei to eth
          $("#yourProposalText").text(" " + window.web3Utils.fromWei(ethStake.toString()) + " ETH");
          
          // hide unuseful objects form the UI
          $("#joinByIdForm").hide();
          $("#buttons-init").hide();
          $("#formContainer").show();

          // update the game ID to the UI
          $("#game-info").text("Match ID: " + matchID);

          // start the event loop
          App.event_loop();
        })
        .catch(function (err) {
          // handle errors and display error message
          console.error(err);
          alertFire('Error', 'need a valid match ID!', 'error', false, 0);
 
        });
    }
  },













  
  CommitStake: function() {
    var ethStake = $('#ethAmount').val(); // Get the value of ethAmount input
    console.log("[CommitStake " + matchID + "] Stake proposal: ", ethStake);

    if (!ethStake || ethStake <= 0) {
        // Disable the button and show an error message
        document.getElementById('accept-proposal').disabled = true;
        alertFire('Error', 'Format error!', 'error', false, 0);
     
        return null;
    } else {
        document.getElementById('accept-proposal').disabled = false;

        // Deploy the Battleship contract and commit the stake
        return App.contracts.Battleship.deployed().then(function(instance) {
            battleshipInstance = instance;
            return battleshipInstance.proposeStake(matchID, window.web3Utils.toWei(ethStake.toString()));
        }).then(function(receipt) {
            // Display success message
            alertFire('Stake proposed!', 'You staked ' + ethStake + ' ETH. Wait...', 'success', false, 0);
    
        }).catch(function(err) {
            console.error(err);
            alertFire('Error', 'Contract reported error: ' + err.message, 'error', false, 0);
            
            throw new Error(err);
        });
    }
  },

  AcceptStake: function() {
    if (matchID === null) {
        // Show an error message and reset the match
        alertFire('Error', 'Something went wrong!', 'error', false, 0);
       
        App.ResetGame();
        return null;
    } else {
        // Deploy the Battleship contract and accept the stake
        return App.contracts.Battleship.deployed().then(function(instance) {
            battleshipInstance = instance;
            return battleshipInstance.acceptStake(matchID);
        }).then(function(receipt) {
            // Show board, hide unnecessary elements, and display betted ETH
            $("#game-container").removeAttr("hidden");
            $("#container-init").attr("hidden", true);
            $("#formContainer").hide();
            $("#opponentProposal").hide();
            $('#betted-info').text("Betted ETH: " + window.web3Utils.fromWei(ethStake.toString()) + " ETH");
        }).catch(function(err) {
            console.error(err);
            alertFire('Error', 'Contract reported error: ' + err.message, 'error', false, 0);
            
            throw new Error(err);
        });
    }
  },

  CommitBoard: async function () {
  try {
    // Generate Merkle root
    let merkleroot = await App.generateMerkleTree(playerGrid);
    console.log("[CommitBoard " + matchID + "] Merkle root: ", merkleroot);

    // Send Merkle root to contract
    let battleshipInstance = await App.contracts.Battleship.deployed();
    await battleshipInstance.registerMerkleRoot(merkleroot, matchID);

    // Show Merkle root registered message
    alertFire('Merkle root ok!', 'Wait Rival\'s merkle root...', 'success', false, 0);
    

    // Start event loop
    App.event_loop();
  } catch (error) {
    console.error(error);
    alertFire('Error', 'Contract reported error: ' + error.message, 'error', false, 0);
  

  }
  },

  SendAttack: function (row, col) {
  try {
    // Send attack to contract
    App.contracts.Battleship.deployed().then(async function (instance) {
      let battleshipInstance = instance;
      let receipt = await battleshipInstance.attackOpponent(matchID, row, col);

      // Log attack details
      attackedCol = col;
      attackedRow = row;
      console.log("[SendAttack " + matchID + "] from " + web3.eth.defaultAccount + " on opponentGrid([" + row + "][" + col + "])");

      // Show success toast
      const Toast = Swal.mixin({
        toast: true,
        position: 'top-center',
        showConfirmButton: true,
        timer: 6000,
        timerProgressBar: true,
        didOpen: (toast) => {
          toast.addEventListener('mouseenter', Swal.stopTimer);
          toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
      });

      Toast.fire({
        icon: 'success',
        title: 'Torpedo launched! Wait your turn!'
      });

      // Disable opponent grid interaction
      const opponentGrid = document.getElementById('computerGrid');
      opponentGrid.style.pointerEvents = 'none';

      // Enable report button
      document.getElementById('report-button').disabled = false;
    });
  } catch (error) {
    console.error(error);

    // Show error message
    alertFire('Error', 'Contract reported error: ' + error.message, 'error', false, 0);
    
  }
  },

  generateMerkleTree: async function (playerGrid) {
    // flatten the grid cells
    let boardForMT = playerGrid.cells.flat();

    // generate leaf nodes using hashed vales
    let leafNodes = boardForMT.map(cellState => { 
      let salt = BigInt(Math.floor(Number(generateSecure128BitInteger()) * playerGrid.size)); // generate a random salt
      
      // concatenate the cell state and salt, then hash the result
      const val = window.web3Utils.keccak256(String(cellState) + String(salt));
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
        let combinedHash = window.web3Utils.keccak256(xor(String(leftChild), String(rightChild)));
        lastLevel.push(combinedHash); // push the combined hash to the last level
      }
      // udate leaf nodes with the parent nodes
      leafNodes = lastLevel;
      // store the current level in the Merkle tree levels array
      merkleTreeLevels.push(leafNodes);
    }
    return leafNodes[0]; // ROOT of the MT
  },

  /*
  - generates a Merkle proof for a specific cell in the player grid,
  - takes the row, col indexes of the cell as parameters. 
  */
  
  generateMerkleProof: function(row, col) {
    // array to store the MP
    var merkleProof = [];
    // calculate the flat index of the cell
    let flatIndex = row * playerGrid.size + col;
  
    // iterate thru levels of the MT
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
  },


  submitProofAttack: function (attackResult, hash, merkleProof) {
    try {
      // Get Battleship contract instance
      App.contracts.Battleship.deployed().then(function (instance) {
        battleshipInstance = instance;
        return battleshipInstance.submitAttackProof(matchID, attackResult, hash, merkleProof);
      }).then(function (receipt) {
        // Submission successful
      }).catch(function (err) {
        console.error(err);
        // Show error message
        alertFire('Error', 'Contract reported error: ' + err.message, 'error', false, 0);
       
      });
    } catch (error) {
      console.error(error);
    }
  },

  


  sendBordVerification: function () {

  //Retrieve original configuration, without hitted positions
  //This allows to recompute the original Merkle Tree on contract-side
  playerGrid.cells = playerGrid.cells.map(row =>
      row.map(cell => (cell > 1 ? 1 : cell))
  );

  console.log("[sendBordVerification " + matchID + "] Sending board for verification: ", playerGrid.cells);

    try {
      // Get Battleship contract instance
      App.contracts.Battleship.deployed().then(function (instance) {
        battleshipInstance = instance;
        return battleshipInstance.verifyBoard(matchID, playerGrid.cells.flat());
      }).then(function (receipt) {
        // Submission successful
      }).catch(function (err) {
        console.error(err);
        // Show error message
        alertFire('Error', 'Contract reported error: ' + err.message, 'error', false, 0);
       
      });
    } catch (error) {
      console.error(error);
    }
  },
  
  ResetGame: function () {
    try {
      // Highlight sidebar
      var sidebar = document.getElementById('restart-sidebar');
      sidebar.setAttribute('class', 'highlight');
  
      // Disable opponent grid interaction
      const opponentGrid = document.getElementById('computerGrid');
      opponentGrid.style.pointerEvents = 'none';
  
      // Deregister listeners
      var computerCells = document.querySelector('.computer-player').childNodes;
      for (var j = 0; j < computerCells.length; j++) {
        computerCells[j].removeEventListener('click', this.shootListener, false);
      }
      var playerRoster = document.querySelector('.fleet-roster').querySelectorAll('li');
      for (var i = 0; i < playerRoster.length; i++) {
        playerRoster[i].removeEventListener('click', this.rosterListener, false);
      }
  
      // Attach restart button listener
      var restartButton = document.getElementById('restart-game');
      var restartGame = function (e) {
        e.target.removeEventListener(e.type, arguments.callee);
        var self = e.target.self;
        document.getElementById('restart-sidebar').setAttribute('class', 'hidden');
        location.reload();
        
      };
  
      restartButton.addEventListener('click', restartGame, false);
      restartButton.self = this;
    } catch (error) {
      console.error(error);
      alertFire('Error', 'Contract reported error: ' + error.message, 'error', false, 0);
     
    }
  },
  
  ReportOpponentAFK: function () {
    try {
      // Accuse opponent using Battleship contract
      App.contracts.Battleship.deployed().then(function (instance) {
        battleshipInstance = instance;
        return battleshipInstance.accuseOpponent(matchID);
      }).then(function (receipt) {
        // Disable report button
        document.getElementById('report-button').disabled = true;
      }).catch(function (err) {
        console.error(err);
        // Show error message
        alertFire('Error', 'Contract reported error: ' + err.message, 'error', false, 0);

      });
    } catch (error) {
      console.error(error);
      alertFire('Error', 'Contract reported error: ' + error.message, 'error', false, 0);
         
    }
  },
  

  event_loop: async function () {

    //https://ethereum.stackexchange.com/questions/15402/duplicate-events-firing-in-a-web3-listener
    //Resource suggest to use the lastBlock variable to avoid duplicate events
    let lastBlock = null;

    await battleshipInstance.allEvents({ fromBlock: 'latest', toBlock: 'latest' },
      (err, events) => {

        if(err){
            console.log("[ERR_EVENT_LOOP " + matchID + "] " + err);
        } 


        if(events.blockNumber != lastBlock && events.args._matchID != null && events.args._matchID != undefined && events.args._matchID == matchID) {
      

          switch (events.event) {
            case "stakeAccepted":
              

            lastBlock = events.blockNumber;
            ethStake = events.args._stake.toNumber();


            const agreedETH = window.web3Utils.fromWei(ethStake.toString());
            // Get references to all the HTML elements by their IDs
            const containerInit = document.querySelector('.container-init');
            const buttonsInit = document.querySelector('#buttons-init');
            const formContainer = document.querySelector('#formContainer');
            const opponentProposal = document.querySelector('#opponentProposal');
            const joinByIdForm = document.querySelector('#joinByIdForm');
            const searchingGame = document.querySelector('#searchingGame');

            // Hide all the HTML components by adding the "hidden" class to them
            containerInit.classList.add('hidden');
            buttonsInit.classList.add('hidden');
            formContainer.classList.add('hidden');
            opponentProposal.classList.add('hidden');
            joinByIdForm.classList.add('hidden');
            searchingGame.classList.add('hidden');

          alertFire('Agreed on '+ agreedETH +' ETH!', 'Both agreed on betting amount!', 'success', false, 0);
     

          App.contracts.Battleship.deployed().then(function (instance) {
            battleshipInstance = instance;
            return battleshipInstance.payStake(events.args._matchID.toNumber(), { value: (ethStake) });
          }).then(function (reciept) {
           
            $('#betted-info').text("Betted ETH: " + window.web3Utils.fromWei(ethStake.toString()) + " ETH");

          
          

            
            const opponentGrid = document.getElementById('computerGrid');
            opponentGrid.style.pointerEvents = 'none';
            $("#game-container").removeAttr("hidden");


          }).catch(function (err) {
            console.error(err);
            alertFire('Error', 'Contract reported error: ' + err.message, 'error', false, 0);
       
          });

              break;
            case "stakeProposal":


            //Notify amount to spend
              lastBlock = events.blockNumber;

              if(events.args._proposer != web3.eth.defaultAccount){

                  
                    ethStake = events.args._stake.toNumber();
                    if(ethStake === null || ethStake == 0)  document.getElementById('accept-proposal').disabled = true;
                    else document.getElementById('accept-proposal').disabled = false;
          
                    alertFire('Opponent\'s proposal', 'Opponet\'s proposal is ' + window.web3Utils.fromWei(ethStake.toString()) + ' ETH', 'info', false, 0);
                    document.getElementById("yourProposalText").style.color = "red";
          
          
                    $("#yourProposalText").text(window.web3Utils.fromWei(ethStake.toString()));
                    $("#accept-proposal").prop("disabled", false);

                    $("#game-container").attr("hidden", true);
                    $("#yourProposalText").text(window.web3Utils.fromWei(ethStake.toString()) + " ETH");
              } 
            break;
            case "matchStarted":

                if(events.args._playerX == web3.eth.defaultAccount || events.args._playerY == web3.eth.defaultAccount){

                    lastBlock = events.blockNumber;

                    if (events.args._playerX == web3.eth.defaultAccount) {
                      alertFire('Match started, it\'s your turn!', '', 'info', true, 0);
                 
          
                        const opponentGrid = document.getElementById('computerGrid');
                        opponentGrid.style.pointerEvents = 'auto';
                      
                        document.getElementById('report-button').disabled = true;

          
          
                    } else {
          
                      alertFire('Match started, opponent turn, wait for your turn!', '', 'info', false, 0);
                   
                      document.getElementById('report-button').disabled = false;

          
                    }
              }
  
            

            break;
            case "matchFinished":

                  if(events.args._matchID == matchID && events.args._winnerAddr != null) {

                    if(events.args._winnerAddr == web3.eth.defaultAccount){

                      alertFire('You destroyed all enemy ships!','Sending the board for verification. Wait to see if you won the match!', 'question', false, 0);
                      App.sendBordVerification();

                  } else if(events.args._loserAddr == web3.eth.defaultAccount) {

                    alertFire('Enemy destroyed all your ships!', 'Verifying enemy\'s board. Wait to see if you lost the match!', 'question', false, 0);

                    }

                  }

                  opponentGrid = document.getElementById('computerGrid');
                  opponentGrid.style.pointerEvents = 'none';
                  document.getElementById('report-button').disabled = true;


                  var statsSidebar = document.getElementById('stats-sidebar');
                  statsSidebar.style.display = 'none';

                 
            break;
            case "winnerIs":

            console.log("[winnerIs] " + events.args._matchID + " winner is " + events.args._winnerAddr);


                  if(events.args._winnerAddr == web3.eth.defaultAccount){
                    Swal.fire({
                      title: 'You won the match!',
                      imageUrl: 'https://i.gifer.com/3b4.gif',
                      text: events.args._cause + ' Click on restart to play another game!',
                      showClass: {
                        popup: 'animate__animated animate__fadeInDown'
                      },
                      hideClass: {
                        popup: 'animate__animated animate__fadeOutUp'
                      }
                    });
                    alertFire('Winner', 'Congratulations!', 'success', false, 1);
               
                  } else if(events.args._winnerAddr != web3.eth.defaultAccount) {
                    alertFire('You lost ' + window.web3Utils.fromWei(ethStake.toString()) +' ETH!', 'Better luck next time!', 'error', false, -1);

                  }

                  
                  App.ResetGame();

                 
            break;
            
            case "attackResult":

              if (events.args._attackerAddress == web3.eth.defaultAccount) {
                  lastBlock = events.blockNumber;

                  console.log("[attackResult " + matchID + "] result on opponent[" + attackedRow + "][" + attackedCol+ "] is " + events.args._result);

                  if(events.args._result != undefined && events.args._result != null) {
                      if (events.args._result == 1) {
                        // update the board/grid
                        computerGrid.updateCell(attackedRow, attackedCol, 'hit', CONST.COMPUTER_PLAYER);
                          
                          addHitCoordinate(attackedRow, attackedCol);
                      
                          if(enemyHittedPos.size === numberOfShips) {

                            alertFire('You destroyed all enemy ships!', 'Sending the board for verification. Wait to see if you won the match!', 'question', false, 0);
                              
                            App.sendBordVerification();

          

                            const opponentGrid = document.getElementById('computerGrid');
                            opponentGrid.style.pointerEvents = 'none';
                            document.getElementById('report-button').disabled = true;
          
          
                            var statsSidebar = document.getElementById('stats-sidebar');
                            statsSidebar.style.display = 'none';

                          }
      
                      
                        // IMPORTANT: This function needs to be called _after_ updating the cell to a 'hit',
                        // because it overrides the CSS class to 'sunk' if we find that the ship was sunk
                        computerFleet.findShipByCoords(attackedRow, attackedCol).incrementDamage(); // increase the damage
                    
                    } else {
                        computerGrid.updateCell(attackedRow, attackedCol, 'miss', CONST.COMPUTER_PLAYER);
                        
                    }
                  } else {
                    alertFire('Error', 'Contract reported error: unable to determine attack result ' + events.args._result, 'error', false, 0);
       

                }

              }
            break;
            case "attackPerformed":
              var row = events.args._attackedRow.toNumber();
              var col = events.args._attackedCol.toNumber();
              console.log("[AttackPerformed " + matchID + "]: from " + events.args._attackerAddress +" on [" + row + "][" + col + "] is " + events.args._result);


            if(events.args._opponentAddress == web3.eth.defaultAccount){

              lastBlock = events.blockNumber;


              var row = events.args._attackedRow.toNumber();
              var col = events.args._attackedCol.toNumber();


              if(events.args._result == undefined) { 
                //your turn
                alertFire('It\'s your turn!', 'First send the Merkle proof by approving the transaction!', 'success', false, 0);


                const opponentGrid = document.getElementById('computerGrid');
                opponentGrid.style.pointerEvents = 'auto';
                document.getElementById('report-button').disabled = true;

              }

              var merkleProof = App.generateMerkleProof(row, col);
              let flatIndex = row * playerGrid.size + col;


              if (playerGrid.cells[row][col] == 1) {
                App.submitProofAttack(1, merkleTreeLevels[0][flatIndex].toString(), merkleProof);

                playerGrid.updateCell(row, col, 'hit', CONST.HUMAN_PLAYER);
        
                playerGrid.findShipByCoords(row, col).incrementDamage(); // increase the damage
                
              } else {
                App.submitProofAttack(0, merkleTreeLevels[0][flatIndex].toString(), merkleProof);
                
                playerGrid.updateCell(row, col, 'miss', CONST.HUMAN_PLAYER);
                

              }

              
              alertFire('It\'s your turn!', 'First send the Merkle proof by approving the transaction!', 'success', false, 0);
         

            const opponentGrid = document.getElementById('computerGrid');
            opponentGrid.style.pointerEvents = 'auto';
            document.getElementById('report-button').disabled = true;




            }

          break;
            case "accuse":
            lastBlock = events.blockNumber;

            if(events.args._accused == web3.eth.defaultAccount){
              alertFire('You have been accused of being AFK!', 'If you don\'t play you will automatically lose the match!', 'warning', false, 0); 
   
            } else if(events.args._accuser == web3.eth.defaultAccount){
              lastBlock = events.blockNumber;
              document.getElementById('report-button').disabled = false;


            }
            break;
            case "playersJoined":
              lastBlock = events.blockNumber;
              alertFire('Match created!', 'Both player joined match ' + events.args._matchID.toNumber() + '!','success', false, 0);
              break;
            default:
              console.log("[DEFAULT_EVENT_LOOP " + matchID + "] Event NOT recognized: " + events.event.toString());
              break;
         }

      }
      
    });
  },








};

$(function () {
  $(window).on("load", function () {
    App.init();
  });
});

(function() {
    // Battleboat UI grid functionalities
    // Bill Mei, 2014
    // MIT License
    
    // Thanks to Nick Berry for the inspiration
    // http://www.datagenetics.com/blog/december32011/

    // Global Constants
    var CONST = {};
    CONST.AVAILABLE_SHIPS = ['asimovship', 'wormholecraft', 'destroyer', 'deathstar', 'warship'];
    // You are player 0 and the computer is player 1
    // The virtual player is used for generating temporary ships
    // for calculating the probability heatmap
    CONST.HUMAN_PLAYER = 0;
    CONST.COMPUTER_PLAYER = 1;
    // Possible values for the parameter `type` (string)
    CONST.CSS_TYPE_EMPTY = 'empty';
    CONST.CSS_TYPE_SHIP = 'ship';
    CONST.CSS_TYPE_MISS = 'miss';
    CONST.CSS_TYPE_HIT = 'hit';
    CONST.CSS_TYPE_SUNK = 'sunk';
    // Grid code:
    CONST.TYPE_EMPTY = 0; // 0 = water (empty)
    CONST.TYPE_SHIP = 1; // 1 = undamaged ship
    CONST.TYPE_MISS = 2; // 2 = water with a cannonball in it (missed shot)
    CONST.TYPE_HIT = 3; // 3 = damaged ship (hit shot)
    CONST.TYPE_SUNK = 4; // 4 = sunk ship
    
    // Global variables
    Game.usedShips = [CONST.UNUSED, CONST.UNUSED, CONST.UNUSED, CONST.UNUSED, CONST.UNUSED];
    CONST.USED = 1;
    CONST.UNUSED = 0;
    

    
    // Game manager object
    // Constructor
    function Game(size) {
        Game.size = size;
        this.shotsTaken = 0;
        this.createGrid();
        this.init();
    }

    Game.size = 10; // Default grid size is 10x10
    Game.gameOver = false;

    // Shoots at the target player on the grid.
    // Returns {int} Constants.TYPE: What the shot uncovered
    Game.prototype.shoot = function(x, y, targetPlayer) {
        var targetGrid;
        var targetFleet;
    
        targetGrid = computerGrid;
        targetFleet = computerFleet;
        App.SendAttack(x,y);

        targetGrid.updateCell(x, y, 'miss', targetPlayer);
        return CONST.TYPE_MISS;

    };
    // Creates click event listeners on each one of the 100 grid cells
    Game.prototype.shootListener = function(e) {
        
        var self = e.target.self;
        // Extract coordinates from event listener
        var x = parseInt(e.target.getAttribute('data-x'), 10);
        var y = parseInt(e.target.getAttribute('data-y'), 10);
        var result = null;
        if (self.readyToPlay) {
            result = self.shoot(x, y, CONST.COMPUTER_PLAYER);
        }
    
      
        
    };
    // Creates click event listeners on each of the ship names in the roster
    Game.prototype.rosterListener = function(e) {
        var self = e.target.self;
        // Remove all classes of 'placing' from the fleet roster first
        var roster = document.querySelectorAll('.fleet-roster li');
        for (var i = 0; i < roster.length; i++) {
            var classes = roster[i].getAttribute('class') || '';
            classes = classes.replace('placing', '');
            roster[i].setAttribute('class', classes);
        }
    
        // Move the highlight to the next step
        if (gameTutorial.currentStep === 1) {
            gameTutorial.nextStep();
        }
        
        // Set the class of the target ship to 'placing'
        Game.placeShipType = e.target.getAttribute('id');
        document.getElementById(Game.placeShipType).setAttribute('class', 'placing');
        Game.placeShipDirection = parseInt(document.getElementById('rotate-button').getAttribute('data-direction'), 10);
        self.placingOnGrid = true;
    };
    // Creates click event listeners on the human player's grid to handle
    // ship placement after the user has selected a ship name
    Game.prototype.placementListener = function(e) {
        var self = e.target.self;
        if (self.placingOnGrid) {
            // Extract coordinates from event listener
            var x = parseInt(e.target.getAttribute('data-x'), 10);
            var y = parseInt(e.target.getAttribute('data-y'), 10);
            
            // Don't screw up the direction if the user tries to place again.
            var successful = humanFleet.placeShip(x, y, Game.placeShipDirection, Game.placeShipType);
            if (successful) {
                // Done placing this ship
                self.endPlacing(Game.placeShipType);
    
                // Remove the helper arrow
                if (gameTutorial.currentStep === 2) {
                    gameTutorial.nextStep();
                }
    
                self.placingOnGrid = false;
                if (self.areAllShipsPlaced()) {
                    var el = document.getElementById('rotate-button');
                    el.addEventListener(transitionEndEventName(),(function(){
                        el.setAttribute('class', 'hidden');
                        if (gameTutorial.showTutorial) {
                            document.getElementById('start-game').setAttribute('class', 'highlight');
                        } else {
                            document.getElementById('start-game').removeAttribute('class');	
                        }
                    }),false);
                    el.setAttribute('class', 'invisible');
                    App.CommitBoard();
                }
            }
        }
    };
    // Creates mouseover event listeners that handles mouseover on the
    // human player's grid to draw a phantom ship implying that the user
    // is allowed to place a ship there
    Game.prototype.placementMouseover = function(e) {
        var self = e.target.self;
        if (self.placingOnGrid) {
            var x = parseInt(e.target.getAttribute('data-x'), 10);
            var y = parseInt(e.target.getAttribute('data-y'), 10);
            var classes;
            var fleetRoster = humanFleet.fleetRoster;
    
            for (var i = 0; i < fleetRoster.length; i++) {
                var shipType = fleetRoster[i].type;
    
                if (Game.placeShipType === shipType &&
                    fleetRoster[i].isLegal(x, y, Game.placeShipDirection)) {
                    // Virtual ship
                    fleetRoster[i].create(x, y, Game.placeShipDirection, true);
                    Game.placeShipCoords = fleetRoster[i].getAllShipCells();
    
                    for (var j = 0; j < Game.placeShipCoords.length; j++) {
                        var el = document.querySelector('.grid-cell-' + Game.placeShipCoords[j].x + '-' + Game.placeShipCoords[j].y);
                        classes = el.getAttribute('class');
                        // Check if the substring ' grid-ship' already exists to avoid adding it twice
                        if (classes.indexOf(' grid-ship') < 0) {
                            classes += ' grid-ship';
                            el.setAttribute('class', classes);
                        }
                    }
                }
            }
        }
    };
    // Creates mouseout event listeners that un-draws the phantom ship
    // on the human player's grid as the user hovers over a different cell
    Game.prototype.placementMouseout = function(e) {
        var self = e.target.self;
        if (self.placingOnGrid) {
            for (var j = 0; j < Game.placeShipCoords.length; j++) {
                var el = document.querySelector('.grid-cell-' + Game.placeShipCoords[j].x + '-' + Game.placeShipCoords[j].y);
                classes = el.getAttribute('class');
                // Check if the substring ' grid-ship' already exists to avoid adding it twice
                if (classes.indexOf(' grid-ship') > -1) {
                    classes = classes.replace(' grid-ship', '');
                    el.setAttribute('class', classes);
                }
            }
        }
    };
    // Click handler for the Rotate Ship button
    Game.prototype.toggleRotation = function(e) {
        // Toggle rotation direction
        var direction = parseInt(e.target.getAttribute('data-direction'), 10);
        if (direction === Ship.DIRECTION_VERTICAL) {
            e.target.setAttribute('data-direction', '1');
            Game.placeShipDirection = Ship.DIRECTION_HORIZONTAL;
        } else if (direction === Ship.DIRECTION_HORIZONTAL) {
            e.target.setAttribute('data-direction', '0');
            Game.placeShipDirection = Ship.DIRECTION_VERTICAL;
        }
    };
    // Click handler for the Start Game button
    Game.prototype.startGame = function(e) {
        
        var self = e.target.self;
        var el = document.getElementById('roster-sidebar');
        var fn = function() {el.setAttribute('class', 'hidden');};
        el.addEventListener(transitionEndEventName(),fn,false);
        el.setAttribute('class', 'invisible');
        self.readyToPlay = true;
    
        // Advanced the tutorial step
        if (gameTutorial.currentStep === 3) {
            gameTutorial.nextStep();
        }
        el.removeEventListener(transitionEndEventName(),fn,false);

    };
    // Click handler for Restart Game button
    Game.prototype.restartGame = function(e) {
        e.target.removeEventListener(e.type, arguments.callee);
        var self = e.target.self;
        document.getElementById('restart-sidebar').setAttribute('class', 'hidden');
        self.resetFogOfWar();
        self.init();
    };
    // Debugging function used to place all ships and just start
    Game.prototype.placeRandomly = function(e){
        e.target.removeEventListener(e.type, arguments.callee);
        humanFleet.placeShipsRandomly();
        e.target.self.readyToPlay = true;
        document.getElementById('roster-sidebar').setAttribute('class', 'hidden');
        this.setAttribute('class', 'hidden');
        App.CommitBoard();

    };
    // Ends placing the current ship
    Game.prototype.endPlacing = function(shipType) {
        document.getElementById(shipType).setAttribute('class', 'placed');
        
        // Mark the ship as 'used'
        Game.usedShips[CONST.AVAILABLE_SHIPS.indexOf(shipType)] = CONST.USED;
    
        // Wipe out the variable when you're done with it
        Game.placeShipDirection = null;
        Game.placeShipType = '';
        Game.placeShipCoords = [];
    };
    // Checks whether or not all ships are done placing
    // Returns boolean
    Game.prototype.areAllShipsPlaced = function() {
        var playerRoster = document.querySelectorAll('.fleet-roster li');
        for (var i = 0; i < playerRoster.length; i++) {
            if (playerRoster[i].getAttribute('class') === 'placed') {
                continue;
            } else {
                return false;
            }
        }
        // Reset temporary variables
        Game.placeShipDirection = 0;
        Game.placeShipType = '';
        Game.placeShipCoords = [];
        return true;
    };
    // Resets the fog of war
    Game.prototype.resetFogOfWar = function() {
        for (var i = 0; i < Game.size; i++) {
            for (var j = 0; j < Game.size; j++) {
                playerGrid.updateCell(i, j, 'empty', CONST.HUMAN_PLAYER);
                computerGrid.updateCell(i, j, 'empty', CONST.COMPUTER_PLAYER);
            }
        }
        // Reset all values to indicate the ships are ready to be placed again
        Game.usedShips = Game.usedShips.map(function(){return CONST.UNUSED;});
    };
    // Resets CSS styling of the sidebar
    Game.prototype.resetRosterSidebar = function() {
        var els = document.querySelector('.fleet-roster').querySelectorAll('li');
        for (var i = 0; i < els.length; i++) {
            els[i].removeAttribute('class');
        }
    
        if (gameTutorial.showTutorial) {
            gameTutorial.nextStep();
        } else {
            document.getElementById('roster-sidebar').removeAttribute('class');
        }
        document.getElementById('rotate-button').removeAttribute('class');
        document.getElementById('start-game').setAttribute('class', 'hidden');
        
        document.getElementById('place-randomly').removeAttribute('class');
        
    };
    Game.prototype.showRestartSidebar = function() {
        var sidebar = document.getElementById('restart-sidebar');
        sidebar.setAttribute('class', 'highlight');
    
        // Deregister listeners
        var computerCells = document.querySelector('.computer-player').childNodes;
        for (var j = 0; j < computerCells.length; j++) {
            computerCells[j].removeEventListener('click', this.shootListener, false);
        }
        var playerRoster = document.querySelector('.fleet-roster').querySelectorAll('li');
        for (var i = 0; i < playerRoster.length; i++) {
            playerRoster[i].removeEventListener('click', this.rosterListener, false);
        }
    
        var restartButton = document.getElementById('restart-game');
        restartButton.addEventListener('click', this.restartGame, false);
        restartButton.self = this;
    };
    // Generates the HTML divs for the grid for both players
    Game.prototype.createGrid = function() {
        var gridDiv = document.querySelectorAll('.grid');
        for (var grid = 0; grid < gridDiv.length; grid++) {
            gridDiv[grid].removeChild(gridDiv[grid].querySelector('.no-js')); // Removes the no-js warning
            for (var i = 0; i < Game.size; i++) {
                for (var j = 0; j < Game.size; j++) {
                    var el = document.createElement('div');
                    el.setAttribute('data-x', i);
                    el.setAttribute('data-y', j);
                    el.setAttribute('class', 'grid-cell grid-cell-' + i + '-' + j);
                    gridDiv[grid].appendChild(el);
                }
            }
        }
    };


    // Initializes the Game. Also resets the game if previously initialized
    Game.prototype.init = function() {
        playerGrid = new Grid(Game.size);
        //this.playerGrid = playerGrid;
        computerGrid = new Grid(Game.size);
        humanFleet = new Fleet(playerGrid, CONST.HUMAN_PLAYER);
        computerFleet = new Fleet(computerGrid, CONST.COMPUTER_PLAYER);
    
      
        // Reset game variables
        this.shotsTaken = 0;
        this.readyToPlay = false;
        this.placingOnGrid = false;
        Game.placeShipDirection = 0;
        Game.placeShipType = '';
        Game.placeShipCoords = [];
    
        this.resetRosterSidebar();
    
        // Add a click listener for the Grid.shoot() method for all cells
        // Only add this listener to the computer's grid
        var computerCells = document.querySelector('.computer-player').childNodes;
        for (var j = 0; j < computerCells.length; j++) {
            computerCells[j].self = this;
            computerCells[j].addEventListener('click', this.shootListener, false);
        }
    
        // Add a click listener to the roster	
        var playerRoster = document.querySelector('.fleet-roster').querySelectorAll('li');
        for (var i = 0; i < playerRoster.length; i++) {
            playerRoster[i].self = this;
            playerRoster[i].addEventListener('click', this.rosterListener, false);
        }
    
        // Add a click listener to the human player's grid while placing
        var humanCells = document.querySelector('.human-player').childNodes;
        for (var k = 0; k < humanCells.length; k++) {
            humanCells[k].self = this;
            humanCells[k].addEventListener('click', this.placementListener, false);
            humanCells[k].addEventListener('mouseover', this.placementMouseover, false);
            humanCells[k].addEventListener('mouseout', this.placementMouseout, false);
        }
    
        var rotateButton = document.getElementById('rotate-button');
        rotateButton.addEventListener('click', this.toggleRotation, false);
        var startButton = document.getElementById('start-game');
        startButton.self = this;
        startButton.addEventListener('click', this.startGame, false);
        var reportAFKButton = document.getElementById('report-button');
        reportAFKButton.addEventListener('click', App.ReportOpponentAFK, false);
        var randomButton = document.getElementById('place-randomly');
        randomButton.self = this;
        randomButton.addEventListener('click', this.placeRandomly, false);
        computerFleet.placeShipsRandomly();
    };
    
    // Grid object
    // Constructor
    function Grid(size) {
        this.size = size;
        this.cells = [];
        this.init();
    }
    
    // Initialize and populate the grid
    Grid.prototype.init = function() {
        for (var x = 0; x < this.size; x++) {
            var row = [];
            this.cells[x] = row;
            for (var y = 0; y < this.size; y++) {
                row.push(CONST.TYPE_EMPTY);
            }
        }
    };
    
    // Updates the cell's CSS class based on the type passed in
    Grid.prototype.updateCell = function(x, y, type, targetPlayer) {
        var player;
        if (targetPlayer === CONST.HUMAN_PLAYER) {
            player = 'human-player';
        } else if (targetPlayer === CONST.COMPUTER_PLAYER) {
            player = 'computer-player';
        } else {
            // Should never be called
            console.log("There was an error trying to find the correct player's grid");
        }
    
        let timerInterval;
        switch (type) {
            case CONST.CSS_TYPE_EMPTY:
                this.cells[x][y] = CONST.TYPE_EMPTY;
                break;
            case CONST.CSS_TYPE_SHIP:
                this.cells[x][y] = CONST.TYPE_SHIP;
                break;
            case CONST.CSS_TYPE_MISS:
                this.cells[x][y] = CONST.TYPE_MISS;
                break;
            case CONST.CSS_TYPE_HIT:
                this.cells[x][y] = CONST.TYPE_HIT;
                break;
            default:
                this.cells[x][y] = CONST.TYPE_EMPTY;
                break;
        }

        // FEATURE: UI update here, preventive
        var classes = ['grid-cell', 'grid-cell-' + x + '-' + y, 'grid-' + type];
        document.querySelector('.' + player + ' .grid-cell-' + x + '-' + y).setAttribute('class', classes.join(' '));
    };
    // Checks to see if a cell contains an undamaged ship
    // Returns boolean
    Grid.prototype.isUndamagedShip = function(x, y) {
        return this.cells[x][y] === CONST.TYPE_SHIP;
    };
    // Checks to see if the shot was missed. This is equivalent
    // to checking if a cell contains a cannonball
    // Returns boolean
    Grid.prototype.isMiss = function(x, y) {
        return this.cells[x][y] === CONST.TYPE_MISS;
    };
    // Checks to see if a cell contains a damaged ship,
    // either hit or sunk.
    // Returns boolean
    Grid.prototype.isDamagedShip = function(x, y) {
        return this.cells[x][y] === CONST.TYPE_HIT || this.cells[x][y] === CONST.TYPE_SUNK;
    };
    
    // Fleet object
    // This object is used to keep track of a player's portfolio of ships
    // Constructor
    function Fleet(playerGrid, player) {
        this.numShips = CONST.AVAILABLE_SHIPS.length;
        this.playerGrid = playerGrid;
        this.player = player;
        this.fleetRoster = [];
        this.populate();
    }
    // Populates a fleet
    Fleet.prototype.populate = function() {
        for (var i = 0; i < this.numShips; i++) {
            // loop over the ship types when numShips > Constants.AVAILABLE_SHIPS.length
            var j = i % CONST.AVAILABLE_SHIPS.length;
            this.fleetRoster.push(new Ship(CONST.AVAILABLE_SHIPS[j], this.playerGrid, this.player));
        }
    };
    // Places the ship and returns whether or not the placement was successful
    // Returns boolean
    Fleet.prototype.placeShip = function(x, y, direction, shipType) {
        var shipCoords;
        for (var i = 0; i < this.fleetRoster.length; i++) {
            var shipTypes = this.fleetRoster[i].type;
    
            if (shipType === shipTypes &&
                this.fleetRoster[i].isLegal(x, y, direction)) {
                this.fleetRoster[i].create(x, y, direction, false);
                shipCoords = this.fleetRoster[i].getAllShipCells();
    
                for (var j = 0; j < shipCoords.length; j++) {
                    this.playerGrid.updateCell(shipCoords[j].x, shipCoords[j].y, 'ship', this.player);
                }
                return true;
            }
        }
        return false;
    };
    // Places ships randomly on the board
    Fleet.prototype.placeShipsRandomly = function() {
        var shipCoords;
        for (var i = 0; i < this.fleetRoster.length; i++) {
            var illegalPlacement = true;
        
            // Prevents the random placement of already placed ships
            if(this.player === CONST.HUMAN_PLAYER && Game.usedShips[i] === CONST.USED) {
                continue;
            }
            while (illegalPlacement) {
                var randomX = Math.floor(Game.size * Math.random());
                var randomY = Math.floor(Game.size * Math.random());
                var randomDirection = Math.floor(2*Math.random());
                
                if (this.fleetRoster[i].isLegal(randomX, randomY, randomDirection)) {
                    this.fleetRoster[i].create(randomX, randomY, randomDirection, false);
                    shipCoords = this.fleetRoster[i].getAllShipCells();
                    illegalPlacement = false;
                } else {
                    continue;
                }
            }
            if (this.player === CONST.HUMAN_PLAYER && Game.usedShips[i] !== CONST.USED) {
                for (var j = 0; j < shipCoords.length; j++) {
                    this.playerGrid.updateCell(shipCoords[j].x, shipCoords[j].y, 'ship', this.player);
                    Game.usedShips[i] = CONST.USED;
                }
            }
        }
    };
    // Finds a ship by location
    // Returns the ship object located at (x, y)
    // If no ship exists at (x, y), this returns null instead
    Fleet.prototype.findShipByCoords = function(x, y) {
        for (var i = 0; i < this.fleetRoster.length; i++) {
            var currentShip = this.fleetRoster[i];
            if (currentShip.direction === Ship.DIRECTION_VERTICAL) {
                if (y === currentShip.yPosition &&
                    x >= currentShip.xPosition &&
                    x < currentShip.xPosition + currentShip.shipLength) {
                    return currentShip;
                } else {
                    continue;
                }
            } else {
                if (x === currentShip.xPosition &&
                    y >= currentShip.yPosition &&
                    y < currentShip.yPosition + currentShip.shipLength) {
                    return currentShip;
                } else {
                    continue;
                }
            }
        }
        return null;
    };
    // Finds a ship by its type
    // Param shipType is a string
    // Returns the ship object that is of type shipType
    // If no ship exists, this returns null.
    Fleet.prototype.findShipByType = function(shipType) {
        for (var i = 0; i < this.fleetRoster.length; i++) {
            if (this.fleetRoster[i].type === shipType) {
                return this.fleetRoster[i];
            }
        }
        return null;
    };
    // Checks to see if all ships have been sunk
    // Returns boolean
    Fleet.prototype.allShipsSunk = function() {
        for (var i = 0; i < this.fleetRoster.length; i++) {
            // If one or more ships are not sunk, then the sentence "all ships are sunk" is false.
            if (this.fleetRoster[i].sunk === false) {
                return false;
            }
        }
        return true;
    };
    
    // Ship object
    // Constructor
    function Ship(type, playerGrid, player) {
        this.damage = 0;
        this.type = type;
        this.playerGrid = playerGrid;
        this.player = player;
    
        switch (this.type) {
            case CONST.AVAILABLE_SHIPS[0]:
                this.shipLength = 5;
                break;
            case CONST.AVAILABLE_SHIPS[1]:
                this.shipLength = 4;
                break;
            case CONST.AVAILABLE_SHIPS[2]:
                this.shipLength = 3;
                break;
            case CONST.AVAILABLE_SHIPS[3]:
                this.shipLength = 3;
                break;
            case CONST.AVAILABLE_SHIPS[4]:
                this.shipLength = 2;
                break;
            default:
                this.shipLength = 3;
                break;
        }
        this.maxDamage = this.shipLength;
        this.sunk = false;
    }
    // Checks to see if the placement of a ship is legal
    // Returns boolean
    Ship.prototype.isLegal = function(x, y, direction) {
        // first, check if the ship is within the grid...
        if (this.withinBounds(x, y, direction)) {
            // ...then check to make sure it doesn't collide with another ship
            for (var i = 0; i < this.shipLength; i++) {
                if (direction === Ship.DIRECTION_VERTICAL) {
                    if (this.playerGrid.cells[x + i][y] === CONST.TYPE_SHIP ||
                        this.playerGrid.cells[x + i][y] === CONST.TYPE_MISS ||
                        this.playerGrid.cells[x + i][y] === CONST.TYPE_SUNK) {
                        return false;
                    }
                } else {
                    if (this.playerGrid.cells[x][y + i] === CONST.TYPE_SHIP ||
                        this.playerGrid.cells[x][y + i] === CONST.TYPE_MISS ||
                        this.playerGrid.cells[x][y + i] === CONST.TYPE_SUNK) {
                        return false;
                    }
                }
            }
            return true;
        } else {
            return false;
        }
    };
    // Checks to see if the ship is within bounds of the grid
    // Returns boolean
    Ship.prototype.withinBounds = function(x, y, direction) {
        if (direction === Ship.DIRECTION_VERTICAL) {
            return x + this.shipLength <= Game.size;
        } else {
            return y + this.shipLength <= Game.size;
        }
    };
    // Increments the damage counter of a ship
    // Returns Ship
    Ship.prototype.incrementDamage = function() {
        this.damage++;
        if (this.isSunk()) {
            this.sinkShip(false); // Sinks the ship
        }
    };
    // Checks to see if the ship is sunk
    // Returns boolean
    Ship.prototype.isSunk = function() {
        return this.damage >= this.maxDamage;
    };
    // Sinks the ship
    Ship.prototype.sinkShip = function(virtual) {
        this.damage = this.maxDamage; // Force the damage to exceed max damage
        this.sunk = true;
    
        // Make the CSS class sunk, but only if the ship is not virtual
        if (!virtual) {
            var allCells = this.getAllShipCells();
            for (var i = 0; i < this.shipLength; i++) {
                this.playerGrid.updateCell(allCells[i].x, allCells[i].y, 'sunk', this.player);
            }
        }
    };
    /**
     * Gets all the ship cells
     *
     * Returns an array with all (x, y) coordinates of the ship:
     * e.g.
     * [
     *	{'x':2, 'y':2},
     *	{'x':3, 'y':2},
     *	{'x':4, 'y':2}
     * ]
     */
    Ship.prototype.getAllShipCells = function() {
        var resultObject = [];
        for (var i = 0; i < this.shipLength; i++) {
            if (this.direction === Ship.DIRECTION_VERTICAL) {
                resultObject[i] = {'x': this.xPosition + i, 'y': this.yPosition};
            } else {
                resultObject[i] = {'x': this.xPosition, 'y': this.yPosition + i};
            }
        }
        return resultObject;
    };
    // Initializes a ship with the given coordinates and direction (bearing).
    // If the ship is declared "virtual", then the ship gets initialized with
    // its coordinates but DOESN'T get placed on the grid.
    Ship.prototype.create = function(x, y, direction, virtual) {
        // This function assumes that you've already checked that the placement is legal
        this.xPosition = x;
        this.yPosition = y;
        this.direction = direction;
    
        // If the ship is virtual, don't add it to the grid.
        if (!virtual) {
            for (var i = 0; i < this.shipLength; i++) {
                if (this.direction === Ship.DIRECTION_VERTICAL) {
                    this.playerGrid.cells[x + i][y] = CONST.TYPE_SHIP;
                } else {
                    this.playerGrid.cells[x][y + i] = CONST.TYPE_SHIP;
                }
            }
        }
        
    };
    // direction === 0 when the ship is facing north/south
    // direction === 1 when the ship is facing east/west
    Ship.DIRECTION_VERTICAL = 0;
    Ship.DIRECTION_HORIZONTAL = 1;
    
    // Tutorial Object
    // Constructor
    function Tutorial() {
        this.currentStep = 0;
        // Check if 'showTutorial' is initialized, if it's uninitialized, set it to true.
        this.showTutorial = localStorage.getItem('showTutorial') !== 'false';
    }
    // Advances the tutorial to the next step
    Tutorial.prototype.nextStep = function() {
        var playerGrid = document.querySelector('.human-player');
        var computerGrid = document.querySelector('.computer-player');
        switch (this.currentStep) {
            case 0:
                document.getElementById('roster-sidebar').setAttribute('class', 'highlight');
                document.getElementById('step1').setAttribute('class', 'current-step');
                this.currentStep++;
                break;
            case 1:
                document.getElementById('roster-sidebar').removeAttribute('class');
                document.getElementById('step1').removeAttribute('class');
                playerGrid.setAttribute('class', playerGrid.getAttribute('class') + ' highlight');
                document.getElementById('step2').setAttribute('class', 'current-step');
                this.currentStep++;
                break;
            case 2:
                document.getElementById('step2').removeAttribute('class');
                var humanClasses = playerGrid.getAttribute('class');
                humanClasses = humanClasses.replace(' highlight', '');
                playerGrid.setAttribute('class', humanClasses);
                this.currentStep++;
                break;
            case 3:
                computerGrid.setAttribute('class', computerGrid.getAttribute('class') + ' highlight');
                document.getElementById('step3').setAttribute('class', 'current-step');
                this.currentStep++;
                break;
            case 4:
                var computerClasses = computerGrid.getAttribute('class');
                document.getElementById('step3').removeAttribute('class');
                computerClasses = computerClasses.replace(' highlight', '');
                computerGrid.setAttribute('class', computerClasses);
                document.getElementById('step4').setAttribute('class', 'current-step');
                this.currentStep++;
                break;
            case 5:
                document.getElementById('step4').removeAttribute('class');
                this.currentStep = 6;
                this.showTutorial = false;
                localStorage.setItem('showTutorial', false);
                break;
            default:
                break;
        }
    };
    
    
    // Global constant only initialized once
    var gameTutorial = new Tutorial();
    
    // Start the game
    var mainGame = new Game(10);
    
    })();
    
    // Array.prototype.indexOf workaround for IE browsers that don't support it
    // From MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/indexOf
    if (!Array.prototype.indexOf) {
        Array.prototype.indexOf = function (searchElement, fromIndex) {
    
            var k;
    
            // 1. Let O be the result of calling ToObject passing
            //    the this value as the argument.
            if (this === null || this === undefined) {
                throw new TypeError('"this" is null or not defined');
            }
    
            var O = Object(this);
    
            // 2. Let lenValue be the result of calling the Get
            //    internal method of O with the argument "length".
            // 3. Let len be ToUint32(lenValue).
            var len = O.length >>> 0;
    
            // 4. If len is 0, return -1.
            if (len === 0) {
                return -1;
            }
    
            // 5. If argument fromIndex was passed let n be
            //    ToInteger(fromIndex); else let n be 0.
            var n = +fromIndex || 0;
    
            if (Math.abs(n) === Infinity) {
                n = 0;
            }
    
            // 6. If n >= len, return -1.
            if (n >= len) {
                return -1;
            }
    
            // 7. If n >= 0, then Let k be n.
            // 8. Else, n<0, Let k be len - abs(n).
            //    If k is less than 0, then let k be 0.
            k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
    
            // 9. Repeat, while k < len
            while (k < len) {
                var kValue;
                // a. Let Pk be ToString(k).
                //   This is implicit for LHS operands of the in operator
                // b. Let kPresent be the result of calling the
                //    HasProperty internal method of O with argument Pk.
                //   This step can be combined with c
                // c. If kPresent is true, then
                //    i.  Let elementK be the result of calling the Get
                //        internal method of O with the argument ToString(k).
                //   ii.  Let same be the result of applying the
                //        Strict Equality Comparison Algorithm to
                //        searchElement and elementK.
                //  iii.  If same is true, return k.
                if (k in O && O[k] === searchElement) {
                    return k;
                }
                k++;
            }
            return -1;
        };
    }
    
    // Array.prototype.map workaround for IE browsers that don't support it
    // From MDN: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
    // Production steps of ECMA-262, Edition 5, 15.4.4.19
    // Reference: http://es5.github.io/#x15.4.4.19
    if (!Array.prototype.map) {
    
        Array.prototype.map = function(callback, thisArg) {
    
            var T, A, k;
    
            if (this == null) {
                throw new TypeError(" this is null or not defined");
            }
    
            // 1. Let O be the result of calling ToObject passing the |this| 
            //    value as the argument.
            var O = Object(this);
    
            // 2. Let lenValue be the result of calling the Get internal 
            //    method of O with the argument "length".
            // 3. Let len be ToUint32(lenValue).
            var len = O.length >>> 0;
    
            // 4. If IsCallable(callback) is false, throw a TypeError exception.
            // See: http://es5.github.com/#x9.11
            if (typeof callback !== "function") {
                throw new TypeError(callback + " is not a function");
            }
    
            // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
            if (arguments.length > 1) {
                T = thisArg;
            }
    
            // 6. Let A be a new array created as if by the expression new Array(len) 
            //    where Array is the standard built-in constructor with that name and 
            //    len is the value of len.
            A = new Array(len);
    
            // 7. Let k be 0
            k = 0;
    
            // 8. Repeat, while k < len
            while (k < len) {
    
                var kValue, mappedValue;
    
                // a. Let Pk be ToString(k).
                //   This is implicit for LHS operands of the in operator
                // b. Let kPresent be the result of calling the HasProperty internal 
                //    method of O with argument Pk.
                //   This step can be combined with c
                // c. If kPresent is true, then
                if (k in O) {
    
                    // i. Let kValue be the result of calling the Get internal 
                    //    method of O with argument Pk.
                    kValue = O[k];
    
                    // ii. Let mappedValue be the result of calling the Call internal 
                    //     method of callback with T as the this value and argument 
                    //     list containing kValue, k, and O.
                    mappedValue = callback.call(T, kValue, k, O);
    
                    // iii. Call the DefineOwnProperty internal method of A with arguments
                    // Pk, Property Descriptor 
                    // { Value: mappedValue, 
                    //   Writable: true, 
                    //   Enumerable: true, 
                    //   Configurable: true },
                    // and false.
    
                    // In browsers that support Object.defineProperty, use the following:
                    // Object.defineProperty(A, k, { 
                    //   value: mappedValue, 
                    //   writable: true, 
                    //   enumerable: true, 
                    //   configurable: true 
                    // });
    
                    // For best browser support, use the following:
                    A[k] = mappedValue;
                }
                // d. Increase k by 1.
                k++;
            }
    
            // 9. return A
            return A;
        };
    }
    
    // Browser compatability workaround for transition end event names.
    // From modernizr: http://stackoverflow.com/a/9090128
    function transitionEndEventName() {
        var i,
            undefined,
            el = document.createElement('div'),
            transitions = {
                'transition':'transitionend',
                'OTransition':'otransitionend',  // oTransitionEnd in very old Opera
                'MozTransition':'transitionend',
                'WebkitTransition':'webkitTransitionEnd'
            };
    
        for (i in transitions) {
            if (transitions.hasOwnProperty(i) && el.style[i] !== undefined) {
                return transitions[i];
            }
        }
    }
       
    // Toggles on or off DEBUG_MODE
    function setDebug(val) {
        DEBUG_MODE = true;
        localStorage.setItem('DEBUG_MODE', 'true');
        localStorage.setItem('showTutorial', 'false');
        //window.location.reload();
    }

 
function addHitCoordinate(row, col) {
  const coordinate = `${row},${col}`;
  
  if (!enemyHittedPos.has(coordinate)) {
      enemyHittedPos.add(coordinate);
  } 
}

function alertFire(title, message, icon, start, winner){

  if(start){
    Swal.fire({
      title: 'Match started, it\'s your turn!',
      width: 400,
      padding: '3em',
      color: '##2bec28',
      background: '#fff url(/images/rick.gif)',
    });
  } else if(winner == 1){

    Swal.fire({
      title: 'You won the match!',
      imageUrl: 'https://i.gifer.com/3b4.gif',
      text: events.args._cause + ' Click on restart to play another game!',
      showClass: {
        popup: 'animate__animated animate__fadeInDown'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp'
      }
    });


  } else if(winner == -1){
    Swal.fire({
      title: 'You lost!',
      imageUrl: 'https://i.gifer.com/4o9f.gif',
      text:  ' Click on restart to play another game!',
      showClass: {
        popup: 'animate__animated animate__fadeInDown'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp'
      }
    });
  } else {
    Swal.fire({
      title: title,
      text: message,
      icon: icon,
      showClass: {
        popup: 'animate__animated animate__fadeInDown'
      },
      hideClass: {
        popup: 'animate__animated animate__fadeOutUp'
      }
    });
  }


}

// Generate a cryptographically secure 128-bit integer
function generateSecure128BitInteger() {
  const randomBytes = new Uint8Array(16); // 16 bytes = 128 bits
  crypto.getRandomValues(randomBytes);
  
  let result = 0n;
  for (let i = 0; i < randomBytes.length; i++) {
    result = (result << 8n) | BigInt(randomBytes[i]);
  }
  
  return result;
}


  // utils: Performs a bitwise XOR operation on two hexadecimal strings.
function xor(first, second) {
    // Declare a variable `BN` and assign it the Big Number (BN) library from `window.web3Utils`.
    var BN = window.web3Utils.BN;

    // Extract the hexadecimal values from the two strings, and perform a bitwise XOR operation.
    // Create `BN` instances from the extracted hexadecimal values and perform the XOR operation.
    // Convert the result to a hexadecimal string.
    let intermediate = new BN(first.slice(2), 16).xor(new BN(second.slice(2), 16)).toString(16);

    // Prepend "0x" to the result string and ensure it has a length of 64 characters (32 bytes) by adding leading zeros if necessary.
    result = "0x" + intermediate.padStart(64, "0");

    // Return the resulting hexadecimal string.
    return result;
  }


function loadParam() {
  jsonFileUrl = '../bs-config.json';
  fetch(jsonFileUrl)
  .then(response => {
    if (!response.ok) {
      console.error("Cannot load game parameter, using default value: boardSize =" + boardSize + " numberOfShips = " + numberOfShips);
    }
    return response.json();
  })
  .then(data => {
    boardSize = data.gameParam.boardSize;
    numberOfShips = data.gameParam.numberOfShips;
   
  })
  .catch(error => {
    console.error('Error fetching or parsing JSON:', error);
  });
}


