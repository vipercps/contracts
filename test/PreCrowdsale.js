const TKRPToken = artifacts.require("./TKRPToken.sol")
const PreCrowdsale = artifacts.require("./PreCrowdsale.sol")

const weiToEther = wei => web3.fromWei(wei).toNumber()
const getBalanceOf = address => web3.eth.getBalance(address)

contract('PreCrowdsale', accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let token
  let preCrowdsale

  beforeEach(async () => {
    token = await TKRPToken.new()
    preCrowdsale = await PreCrowdsale.new(token.address, owner)

    await token.transfer(preCrowdsale.address, 500000)
  })

  describe('constructor', () => {
    it('returns the expected constants', async () => {
      const tokenCap = await preCrowdsale.TOKEN_CAP()
      const minimumContribution = await preCrowdsale.MINIMUM_CONTRIBUTION()
      const tokensPerEther = await preCrowdsale.TOKENS_PER_ETHER()
      const preCrowdsaleDuration = await preCrowdsale.PRE_CROWDSALE_DURATION()

      assert.equal(tokenCap.toNumber(), 500000)
      assert.equal(tokensPerEther.toNumber(), 10000)

      // We expect to receive 0.01 Ether which equals 10 Finney
      assert.equal(weiToEther(minimumContribution), 0.01)

      // 5 days = 432000 seconds = 60 * 60 * 24 * 5
      assert.equal(preCrowdsaleDuration.toNumber(), 432000)
    })

    it('sets the owner address and token address', async () => {
      const preCrowdsaleToken = await preCrowdsale.token()
      const preCrowdsaleOwner = await preCrowdsale.preCrowdsaleOwner()

      assert.equal(preCrowdsaleToken, token.address)
      assert.equal(preCrowdsaleOwner, owner)
    })

    it('sets the owner of the contract', async () => {
      const contractOwner = await preCrowdsale.owner()
      assert.equal(contractOwner, owner)
    })

    it('has all other public variables as empty (0) or false', async () => {
      const etherReceived = await preCrowdsale.etherReceived()
      const tokensSent = await preCrowdsale.tokensSent()
      const preCrowdsaleStartTime = await preCrowdsale.preCrowdsaleStartTime()
      const preCrowdsaleEndTime = await preCrowdsale.preCrowdsaleEndTime()

      assert.equal(etherReceived.toNumber(), 0)
      assert.equal(tokensSent.toNumber(), 0)
      assert.equal(preCrowdsaleStartTime.toNumber(), 0)
      assert.equal(preCrowdsaleEndTime.toNumber(), 0)
    })
  })

  describe('start', () => {
    it('starts the preCrowdsale', async () => {
      let preCrowdsaleStartTime = await preCrowdsale.preCrowdsaleStartTime()
      assert.equal(preCrowdsaleStartTime.toNumber(), 0)

      await preCrowdsale.start()

      preCrowdsaleStartTime = await preCrowdsale.preCrowdsaleStartTime()
      assert.notEqual(preCrowdsaleStartTime.toNumber(), 0)
    })

    it('sets the start and endtime', async () => {
      await preCrowdsale.start()
      const preCrowdsaleStartTime = await preCrowdsale.preCrowdsaleStartTime()
      const preCrowdsaleEndTime = await preCrowdsale.preCrowdsaleEndTime()
      const secondsIn5Days = 60 * 60 * 24 * 5

      assert.isAbove(preCrowdsaleStartTime.toNumber(), 0)
      assert.equal(
        preCrowdsaleEndTime.toNumber(),
        preCrowdsaleStartTime.toNumber() + secondsIn5Days
      )
    })

    it('throws if already started', async () => {
      await preCrowdsale.start()

      try {
        await preCrowdsale.start()
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('throws if not called by owner', async () => {
      try {
        await preCrowdsale.start({ from: user })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })
  })

  describe('drain', () => {
    beforeEach(async () => {
      await preCrowdsale.start()
    })

    it('drains all the funds to the owner as a fail-safe', async () => {
      await preCrowdsale.sendTransaction({
        value: web3.toWei(1, 'ether')
      })

      const preDrainCrowdsaleBalance = weiToEther(getBalanceOf(preCrowdsale.address))
      const preDrainOwnerBalance = weiToEther(getBalanceOf(owner))

      await preCrowdsale.drain()

      const postDrainCrowdsaleBalance = weiToEther(getBalanceOf(preCrowdsale.address))
      const postDrainOwnerBalance = weiToEther(getBalanceOf(owner))

      assert.isAbove(postDrainOwnerBalance, preDrainOwnerBalance)
      assert.isBelow(postDrainCrowdsaleBalance, preDrainCrowdsaleBalance)
      assert.equal(postDrainCrowdsaleBalance, 0)
    })

    it('throws if other than owner attempts to drain', async () => {
      try {
        await preCrowdsale.drain({ from: user })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })
  })

  describe('finalize', () => {
    it('throws if preCrowdsale has not started', async () => {
      try {
        await preCrowdsale.finalize()
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('throws if not called by owner', async () => {
      try {
        await preCrowdsale.finalize({ from: user })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('throw if token cap has not reached and has not finished yet', async () => {
      await preCrowdsale.start()

      try {
        await preCrowdsale.finalize()
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('finalizes if cap has reached before preCrowdsaleEnd', async () => {
      await preCrowdsale.start()

      await preCrowdsale.sendTransaction({
        value: web3.toWei(50, 'ether')
      })

      const preCrowdsalePreFinalizeOwnerBalance = weiToEther(getBalanceOf(owner))
      const preCrowdsalePreFinalizeBalance = weiToEther(getBalanceOf(preCrowdsale.address))

      await preCrowdsale.finalize()

      const preCrowdsalePostFinalizeOwnerBalance = weiToEther(getBalanceOf(owner))
      const preCrowdsalePostFinalizeBalance = weiToEther(getBalanceOf(preCrowdsale.address))

      assert.equal(preCrowdsalePreFinalizeBalance, 50)
      assert.equal(preCrowdsalePostFinalizeBalance, 0)

      assert.isAbove(preCrowdsalePostFinalizeOwnerBalance, preCrowdsalePreFinalizeOwnerBalance)
    })
  })

  describe('fallback', () => {
    it('throws if preCrowdsale has not started', async () => {
      try {
        await preCrowdsale.sendTransaction({
          value: web3.toWei(1, 'ether')
        })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('throws if contribution is below the minimum threshold', async () => {
      await preCrowdsale.start()

      try {
        await preCrowdsale.sendTransaction({
          value: web3.toWei(9, 'finney')
        })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('transfers funds if contribution is valid', async () => {
      await preCrowdsale.start()

      const preCrowdsaleBalance = weiToEther(getBalanceOf(preCrowdsale.address))
      const preOwnerBalance = weiToEther(getBalanceOf(owner))

      await preCrowdsale.sendTransaction({
        value: web3.toWei(10, 'finney')
      })

      const postCrowdsaleBalance = weiToEther(getBalanceOf(preCrowdsale.address))
      const postOwnerBalance = weiToEther(getBalanceOf(owner))

      assert.isBelow(postOwnerBalance, preOwnerBalance)
      assert.isAbove(postCrowdsaleBalance, preCrowdsaleBalance)
    })

    it('transfers the tokens, taking into account bonus modifier', async () => {
      await preCrowdsale.start()

      const preUserBalance = await token.balanceOf(user)

      await preCrowdsale.sendTransaction({
        from: user,
        value: web3.toWei(1, 'ether')
      })

      const postUserBalance = await token.balanceOf(user)

      assert.equal(preUserBalance, 0)
      assert.equal(postUserBalance, 10000)
    })

    it('emits token transfer events', async () => {
      await preCrowdsale.start()
      const tokensSent = await preCrowdsale.TokensSent()
      const contributionReceived = await preCrowdsale.ContributionReceived()

      await preCrowdsale.sendTransaction({
        from: user,
        value: web3.toWei(1, 'ether')
      })

      const tokensSentEvent = tokensSent.get()[0].args.value
      const contributionReceivedEvent = contributionReceived.get()[0].args.value

      assert.equal(tokensSentEvent.toNumber(), 10000)
      assert.equal(weiToEther(contributionReceivedEvent), 1)
    })

    it('updates the total amount of received and sent', async () => {
      await preCrowdsale.start()

      await preCrowdsale.sendTransaction({
        from: user,
        value: web3.toWei(5, 'ether')
      })

      let tokensSent = await preCrowdsale.tokensSent()
      let etherReceived = await preCrowdsale.etherReceived()

      assert.equal(tokensSent.toNumber(), 50000)
      assert.equal(weiToEther(etherReceived), 5)

      await preCrowdsale.sendTransaction({
        from: user,
        value: web3.toWei(3, 'ether')
      })

      tokensSent = await preCrowdsale.tokensSent()
      etherReceived = await preCrowdsale.etherReceived()

      assert.equal(tokensSent.toNumber(), 80000)
      assert.equal(weiToEther(etherReceived), 8)
    })

    it('updates the contributors', async () => {
      await preCrowdsale.start()

      // Same user contributes twice
      await preCrowdsale.sendTransaction({
        from: user,
        value: web3.toWei(1, 'ether')
      })

      let contributor = await preCrowdsale.contributors(user)
      let contributorContributed = contributor[0]
      let contributorReceived = contributor[1]

      assert.equal(weiToEther(contributorContributed), 1)
      assert.equal(contributorReceived.toNumber(), 10000)

      await preCrowdsale.sendTransaction({
        from: user,
        value: web3.toWei(1, 'ether')
      })

      contributor = await preCrowdsale.contributors(user)
      contributorContributed = contributor[0]
      contributorReceived = contributor[1]

      assert.equal(weiToEther(contributorContributed), 2)
      assert.equal(contributorReceived.toNumber(), 20000)

      // Different contributor (the owner is now contributing)
      await preCrowdsale.sendTransaction({
        value: web3.toWei(10, 'finney')
      })

      contributor = await preCrowdsale.contributors(owner)
      contributorContributed = contributor[0]
      contributorReceived = contributor[1]

      assert.equal(weiToEther(contributorContributed), 0.01)
      assert.equal(contributorReceived.toNumber(), 100)
    })

    it('throws if more than cap has been contributed', async () => {
      await preCrowdsale.start()

      try {
        await preCrowdsale.sendTransaction({
          value: web3.toWei(51, 'ether')
        })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('accepts exactly the cap (with bonus factored in)', async () => {
      await preCrowdsale.start()

      await preCrowdsale.sendTransaction({
        value: web3.toWei(50, 'ether')
      })

      let tokensSent = await preCrowdsale.tokensSent()
      let etherReceived = await preCrowdsale.etherReceived()

      assert.equal(tokensSent.toNumber(), 500000)
      assert.equal(weiToEther(etherReceived), 50)
    })
  })
})
