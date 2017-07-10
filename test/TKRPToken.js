const TKRPToken = artifacts.require("./TKRPToken.sol")

contract('TKRPToken', accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let token

  beforeEach(async () => {
    token = await TKRPToken.new()
  })

  describe('constructor', () => {
    it('returns the expected public variables', async () => {
      const tokenName = await token.name()
      const tokenSymbol = await token.symbol()
      const tokenDecimals = await token.decimals()
      const tokenSupply = await token.initialSupply()

      assert.equal(tokenName, 'TKRPToken')
      assert.equal(tokenSymbol, 'TKRP')
      assert.equal(tokenDecimals.toNumber(), 18)
      assert.equal(tokenSupply.toNumber(), 500000)
    })

    it('returns the totalSupply', async () => {
      const initialSupply = await token.initialSupply()
      const totalSupply = await token.totalSupply()

      assert.equal(totalSupply.toNumber(), initialSupply.toNumber())
      assert.equal(totalSupply.toNumber(), 500000)
    })

    it('sets the correct owner of the contrct', async () => {
      assert.equal(await token.owner(), owner)
    })

    it('stores the entire initial balance in the owner account', async () => {
      const ownerBalance = await token.balanceOf(owner)
      assert.equal(ownerBalance.toNumber(), 500000)
    })
  })

  describe('destroyFrom', () => {
    it('destroys the tokens from the given accounts', async () => {
      await token.transfer(user, 100)
      await token.destroyFrom(owner)

      let ownerBalance = await token.balanceOf(owner)
      assert.equal(ownerBalance.toNumber(), 0)

      ownerBalance = await token.balanceOf(user)
      assert.equal(ownerBalance.toNumber(), 100)

      await token.destroyFrom(user)

      ownerBalance = await token.balanceOf(user)
      assert.equal(ownerBalance.toNumber(), 0)
    })

    it('updates the totalSupply accordingly', async () => {
      await token.transfer(user, 300000)
      await token.destroyFrom(owner)

      const totalSupply = await token.totalSupply()
      assert.equal(totalSupply.toNumber(), 300000)
    })

    it('throws if you attempt to transfer when your tokens have been destroyed', async () => {
      await token.transfer(user, 1)
      await token.destroyFrom(owner)

      try {
        await token.transfer(user, 1)
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('throws if you attempt to destroy twice', async () => {
      await token.destroyFrom(owner)

      try {
        await token.destroyFrom(owner)
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })

    it('allows to destroy new tokens if user receives new tokens', async () => {
      await token.transfer(user, 1)
      await token.destroyFrom(owner)

      await token.transfer(owner, 1, { from: user })
      await token.destroyFrom(owner)
    })

    it('emits a Destroy event', async () => {
      const event = await token.Destroy()

      await token.destroyFrom(owner)

      // The event is in the first available entry in the event
      // We could look into the token.destroy(...) response as well
      const eventEntry = event.get()[0]
      const eventArgs = eventEntry.args

      assert.equal(eventEntry.event, 'Destroy')
      assert.equal(eventArgs._from, owner)
    })

    it('throws if not owner', async () => {
      try {
        await token.destroyFrom((owner), { from: user })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })
  })
})
