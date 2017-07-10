const TKRToken = artifacts.require("./TKRToken.sol")
const TKRPToken = artifacts.require("./TKRPToken.sol")
const Crowdsale = artifacts.require("./Crowdsale.sol")

const weiToEther = wei => web3.fromWei(wei).toNumber()
const getBalanceOf = address => web3.eth.getBalance(address)

contract('Crowdsale', accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let token
  let preToken
  let crowdsale

  beforeEach(async () => {
    token = await TKRToken.new()
    preToken = await TKRPToken.new()
    crowdsale = await Crowdsale.new(token.address, preToken.address, owner)

    await token.transfer(crowdsale.address, 58500000)
    await token.transferOwnership(crowdsale.address)
    await preToken.transferOwnership(crowdsale.address)
  })

  describe('constructor', () => {
    it('returns the expected constants', async () => {
      const tokenCap = await crowdsale.TOKEN_CAP()
      const minimumContribution = await crowdsale.MINIMUM_CONTRIBUTION()
      const tokensPerEther = await crowdsale.TOKENS_PER_ETHER()
      const crowdsaleDuration = await crowdsale.CROWDSALE_DURATION()

      assert.equal(tokenCap.toNumber(), 58500000)
      assert.equal(tokensPerEther.toNumber(), 5000)

      // We expect to receive 0.01 Ether which equals 10 Finney
      assert.equal(weiToEther(minimumContribution), 0.01)

      // 30 days = 2592000 seconds = 60 * 60 * 24 * 30
      assert.equal(crowdsaleDuration.toNumber(), 2592000)
    })

    it('sets the owner address and token address', async () => {
      const crowdsaleToken = await crowdsale.token()
      const preCrowdsaleToken = await crowdsale.preToken()
      const crowdsaleOwner = await crowdsale.crowdsaleOwner()

      assert.equal(crowdsaleToken, token.address)
      assert.equal(preCrowdsaleToken, preToken.address)
      assert.equal(crowdsaleOwner, owner)
    })

    it('sets the owner of the contract', async () => {
      const contractOwner = await crowdsale.owner()
      assert.equal(contractOwner, owner)
    })

    it('has all other public variables as empty (0) or false', async () => {
      const etherReceived = await crowdsale.etherReceived()
      const tokensSent = await crowdsale.tokensSent()
      const crowdsaleStartTime = await crowdsale.crowdsaleStartTime()
      const crowdsaleEndTime = await crowdsale.crowdsaleEndTime()

      assert.equal(etherReceived.toNumber(), 0)
      assert.equal(tokensSent.toNumber(), 0)
      assert.equal(crowdsaleStartTime.toNumber(), 0)
      assert.equal(crowdsaleEndTime.toNumber(), 0)
    })
  })

  describe('start', () => {
    it('starts the crowdsale', async () => {
      let crowdsaleStartTime = await crowdsale.crowdsaleStartTime()
      assert.equal(crowdsaleStartTime.toNumber(), 0)

      await crowdsale.start()

      crowdsaleStartTime = await crowdsale.crowdsaleStartTime()
      assert.notEqual(crowdsaleStartTime.toNumber(), 0)
    })

    it('sets the start and endtime', async () => {
      await crowdsale.start()
      const crowdsaleStartTime = await crowdsale.crowdsaleStartTime()
      const crowdsaleEndTime = await crowdsale.crowdsaleEndTime()
      const secondsIn30Days = 60 * 60 * 24 * 30

      assert.isAbove(crowdsaleStartTime.toNumber(), 0)
      assert.equal(
        crowdsaleEndTime.toNumber(),
        crowdsaleStartTime.toNumber() + secondsIn30Days
      )
    })

    it('throws if already started', async () => {
      await crowdsale.start()

      try {
        await crowdsale.start()
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('throws if not called by owner', async () => {
      try {
        await crowdsale.start({ from: user })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })
  })

  describe('drain', () => {
    beforeEach(async () => {
      await crowdsale.start()
    })

    it('drains all the funds to the owner as a fail-safe', async () => {
      await crowdsale.sendTransaction({
        value: web3.toWei(1, 'ether')
      })

      const preDrainCrowdsaleBalance = weiToEther(getBalanceOf(crowdsale.address))
      const preDrainOwnerBalance = weiToEther(getBalanceOf(owner))

      await crowdsale.drain()

      const postDrainCrowdsaleBalance = weiToEther(getBalanceOf(crowdsale.address))
      const postDrainOwnerBalance = weiToEther(getBalanceOf(owner))

      assert.isAbove(postDrainOwnerBalance, preDrainOwnerBalance)
      assert.isBelow(postDrainCrowdsaleBalance, preDrainCrowdsaleBalance)
      assert.equal(postDrainCrowdsaleBalance, 0)
    })

    it('throws if other than owner attempts to drain', async () => {
      try {
        await crowdsale.drain({ from: user })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })
  })

  describe('finalize', () => {
    it('throws if crowdsale has not started', async () => {
      try {
        await crowdsale.finalize()
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('throws if not called by owner', async () => {
      try {
        await crowdsale.finalize({ from: user })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('throw if token cap has not reached and has not finished yet', async () => {
      await crowdsale.start()

      try {
        await crowdsale.finalize()
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('finalizes if cap has reached before crowdsaleEnd', async () => {
      await crowdsale.start()

      await crowdsale.sendTransaction({
        value: web3.toWei(9750, 'ether')
      })

      const crowdsalePreFinalizeOwnerBalance = weiToEther(getBalanceOf(owner))
      const crowdsalePreFinalizeBalance = weiToEther(getBalanceOf(crowdsale.address))

      await crowdsale.finalize()

      const crowdsalePostFinalizeOwnerBalance = weiToEther(getBalanceOf(owner))
      const crowdsalePostFinalizeBalance = weiToEther(getBalanceOf(crowdsale.address))

      assert.equal(crowdsalePreFinalizeBalance, 9750)
      assert.equal(crowdsalePostFinalizeBalance, 0)

      assert.isAbove(crowdsalePostFinalizeOwnerBalance, crowdsalePreFinalizeOwnerBalance)
    })
  })

 describe('migrate', () => {
    it('migrates TKRP tokens to TKR', async () => {
      const initialPreTokenBalance = await preToken.balanceOf(owner)
      const initialTokenBalance = await token.balanceOf(owner)

      assert.equal(initialPreTokenBalance, 500000)
      assert.equal(initialTokenBalance, 6500000)

      await crowdsale.start()
      await crowdsale.migrate()

      const postPreTokenBalance = await preToken.balanceOf(owner)
      const postTokenBalance = await token.balanceOf(owner)

      assert.equal(postPreTokenBalance, 0)
      assert.equal(postTokenBalance, 7000000)
    })

    it('throws when trying to migrate with no balance', async () => {
      await crowdsale.start()
      await crowdsale.migrate()

      try {
        await crowdsale.migrate()
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('emits events when migrating', async () => {
      const migratedTokens = await crowdsale.MigratedTokens()
      const destroy = await preToken.Destroy()

      await crowdsale.start()
      await crowdsale.migrate()

      const migratedTokensEvent = migratedTokens.get()[0].args
      const destroyEvent = destroy.get()[0].args

      assert.equal(migratedTokensEvent._address, owner)
      assert.equal(migratedTokensEvent.value.toNumber(), 500000)
      assert.equal(destroyEvent._from, owner)
    })

    it('does not affect the token cap or tokens sent', async () => {
      let tokensSent = await crowdsale.tokensSent()
      let tokenCap = await crowdsale.TOKEN_CAP()

      assert.equal(tokensSent, 0)
      assert.equal(tokenCap, 58500000)

      await crowdsale.start()
      await crowdsale.migrate()

      tokensSent = await crowdsale.tokensSent()
      tokenCap = await crowdsale.TOKEN_CAP()

      assert.equal(tokensSent, 0)
      assert.equal(tokenCap, 58500000)
    })
  })

  describe('fallback', () => {
    it('throws if crowdsale has not started', async () => {
      try {
        await crowdsale.sendTransaction({
          value: web3.toWei(1, 'ether')
        })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('throws if contribution is below the minimum threshold', async () => {
      await crowdsale.start()

      try {
        await crowdsale.sendTransaction({
          value: web3.toWei(9, 'finney')
        })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('transfers funds if contribution is valid', async () => {
      await crowdsale.start()

      const preCrowdsaleBalance = weiToEther(getBalanceOf(crowdsale.address))
      const preOwnerBalance = weiToEther(getBalanceOf(owner))

      await crowdsale.sendTransaction({
        value: web3.toWei(10, 'finney')
      })

      const postCrowdsaleBalance = weiToEther(getBalanceOf(crowdsale.address))
      const postOwnerBalance = weiToEther(getBalanceOf(owner))

      assert.isBelow(postOwnerBalance, preOwnerBalance)
      assert.isAbove(postCrowdsaleBalance, preCrowdsaleBalance)
    })

    it('transfers the tokens, taking into account bonus modifier', async () => {
      await crowdsale.start()

      const preUserBalance = await token.balanceOf(user)

      await crowdsale.sendTransaction({
        from: user,
        value: web3.toWei(1, 'ether')
      })

      const postUserBalance = await token.balanceOf(user)

      assert.equal(preUserBalance, 0)
      assert.equal(postUserBalance, 6000)
    })

    it('emits token transfer events', async () => {
      await crowdsale.start()
      const tokensSent = await crowdsale.TokensSent()
      const contributionReceived = await crowdsale.ContributionReceived()

      await crowdsale.sendTransaction({
        from: user,
        value: web3.toWei(1, 'ether')
      })

      const tokensSentEvent = tokensSent.get()[0].args.value
      const contributionReceivedEvent = contributionReceived.get()[0].args.value

      assert.equal(tokensSentEvent.toNumber(), 6000)
      assert.equal(weiToEther(contributionReceivedEvent), 1)
    })

    it('updates the total amount of received and sent', async () => {
      await crowdsale.start()

      await crowdsale.sendTransaction({
        from: user,
        value: web3.toWei(5, 'ether')
      })

      let tokensSent = await crowdsale.tokensSent()
      let etherReceived = await crowdsale.etherReceived()

      assert.equal(tokensSent.toNumber(), 30000)
      assert.equal(weiToEther(etherReceived), 5)

      await crowdsale.sendTransaction({
        from: user,
        value: web3.toWei(3, 'ether')
      })

      tokensSent = await crowdsale.tokensSent()
      etherReceived = await crowdsale.etherReceived()

      assert.equal(tokensSent.toNumber(), 48000)
      assert.equal(weiToEther(etherReceived), 8)
    })

    it('updates the contributors', async () => {
      await crowdsale.start()

      // Same user contributes twice
      await crowdsale.sendTransaction({
        from: user,
        value: web3.toWei(1, 'ether')
      })

      let contributor = await crowdsale.contributors(user)
      let contributorContributed = contributor[0]
      let contributorReceived = contributor[1]

      assert.equal(weiToEther(contributorContributed), 1)
      assert.equal(contributorReceived.toNumber(), 6000)

      await crowdsale.sendTransaction({
        from: user,
        value: web3.toWei(1, 'ether')
      })

      contributor = await crowdsale.contributors(user)
      contributorContributed = contributor[0]
      contributorReceived = contributor[1]

      assert.equal(weiToEther(contributorContributed), 2)
      assert.equal(contributorReceived.toNumber(), 12000)

      // Different contributor (the owner is now contributing)
      await crowdsale.sendTransaction({
        value: web3.toWei(10, 'finney')
      })

      contributor = await crowdsale.contributors(owner)
      contributorContributed = contributor[0]
      contributorReceived = contributor[1]

      assert.equal(weiToEther(contributorContributed), 0.01)
      assert.equal(contributorReceived.toNumber(), 60)
    })

    it('throws if more than cap has been contributed', async () => {
      await crowdsale.start()

      try {
        await crowdsale.sendTransaction({
          value: web3.toWei(9751, 'ether')
        })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('accepts exactly the cap (with bonus factored in)', async () => {
      await crowdsale.start()

      await crowdsale.sendTransaction({
        value: web3.toWei(9750, 'ether')
      })

      let tokensSent = await crowdsale.tokensSent()
      let etherReceived = await crowdsale.etherReceived()

      assert.equal(tokensSent.toNumber(), 58500000)
      assert.equal(weiToEther(etherReceived), 9750)
    })
  })
})
