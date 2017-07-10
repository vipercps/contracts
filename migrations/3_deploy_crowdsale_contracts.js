var SafeMath = artifacts.require("./SafeMath.sol")
var TKRPToken = artifacts.require("./TKRPToken.sol")
var TKRToken = artifacts.require("./TKRToken.sol")
var Crowdsale = artifacts.require("./Crowdsale.sol")

module.exports = function(deployer) {
  var owner = web3.eth.accounts[0]
  console.log("Owner address: " + owner)

  deployer.deploy(SafeMath, { from: owner })
  deployer.link(SafeMath, TKRToken)
  return deployer.deploy(TKRToken, { from: owner }).then(() => {
    return deployer.deploy(Crowdsale, TKRToken.address, TKRPToken.address, owner, { from: owner }).then(() => {
      TKRToken.at(TKRToken.address).transfer(Crowdsale.address, 58500000)
      TKRToken.at(TKRToken.address).transferOwnership(Crowdsale.address)
      TKRPToken.at(TKRPToken.address).transferOwnership(Crowdsale.address)
    })
  })
}
