var Battleship = artifacts.require("../contracts/Battleship.sol"); 

module.exports = function(deployer){
    deployer.deploy(Battleship);
};

