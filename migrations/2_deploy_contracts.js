var SafeMath = artifacts.require("./SafeMath.sol")
var TKRToken = artifacts.require("./TKRToken.sol")
var Crowdsale = artifacts.require("./Crowdsale.sol")

module.exports = function(deployer) {
  var owner = web3.eth.accounts[0]
  console.log("Owner address: " + owner)

  deployer.deploy(SafeMath, { from: owner })
  deployer.link(SafeMath, TKRToken)
  return deployer.deploy(TKRToken, { from: owner }).then(() => {
    return deployer.deploy(Crowdsale, TKRToken.address, owner, { from: owner }).then(() => {
      TKRToken.at(TKRToken.address).transfer(Crowdsale.address, 58500000)
    })
  })
}
