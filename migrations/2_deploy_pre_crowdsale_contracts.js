var SafeMath = artifacts.require("./SafeMath.sol")
var TKRPToken = artifacts.require("./TKRPToken.sol")
var PreCrowdsale = artifacts.require("./PreCrowdsale.sol")

module.exports = function(deployer) {
  var owner = web3.eth.accounts[0]
  console.log("Owner address: " + owner)

  deployer.deploy(SafeMath, { from: owner })
  deployer.link(SafeMath, TKRPToken)
  return deployer.deploy(TKRPToken, { from: owner }).then(() => {
    return deployer.deploy(PreCrowdsale, TKRPToken.address, owner, { from: owner }).then(() => {
      TKRPToken.at(TKRPToken.address).transfer(PreCrowdsale.address, 500000)
    })
  })
}
