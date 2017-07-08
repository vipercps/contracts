const TKRToken = artifacts.require("./TKRToken.sol")

contract('TKRToken', accounts => {
  const owner = accounts[0]
  const user = accounts[1]
  let token

  beforeEach(async () => {
    token = await TKRToken.new()
  })

  describe('constructor', () => {
    it('returns the expected public variables', async () => {
      const tokenName = await token.name()
      const tokenSymbol = await token.symbol()
      const tokenDecimals = await token.decimals()
      const tokenSupply = await token.initialSupply()

      assert.equal(tokenName, 'TKRToken')
      assert.equal(tokenSymbol, 'TKR')
      assert.equal(tokenDecimals.toNumber(), 18)
      assert.equal(tokenSupply.toNumber(), 65000000)
    })

    it('returns the totalSupply', async () => {
      const initialSupply = await token.initialSupply()
      const totalSupply = await token.totalSupply()

      assert.equal(totalSupply.toNumber(), initialSupply.toNumber())
      assert.equal(totalSupply.toNumber(), 65000000)
    })

    it('sets the correct owner of the contrct', async () => {
      assert.equal(await token.owner(), owner)
    })

    it('stores the entire initial balance in the owner account', async () => {
      const ownerBalance = await token.balanceOf(owner)
      assert.equal(ownerBalance.toNumber(), 65000000)
    })
  })

  describe('destroy', () => {
    it('destroys the specified amount of tokens', async () => {
      await token.destroy(1000000)

      const ownerBalance = await token.balanceOf(owner)
      assert.equal(ownerBalance.toNumber(), 64000000)
    })

    it('updates the total supply', async () => {
      await token.destroy(1000000)

      const totalSupply = await token.totalSupply()
      assert.equal(totalSupply.toNumber(), 64000000)
    })

    it('emits a Destroy event', async () => {
      const amountToSend = 1000000
      const event = await token.Destroy()

      await token.destroy(amountToSend)

      // The event is in the first available entry in the event
      // We could look into the token.destroy(...) response as well
      const eventEntry = event.get()[0]
      const eventArgs = eventEntry.args

      assert.equal(eventEntry.event, 'Destroy')
      assert.equal(eventArgs._from, owner)

      assert.equal(eventArgs._to, 0x0)
      assert.equal(eventArgs._value.toNumber(), amountToSend)
    })

    it('throws if not owner', async () => {
      try {
        await token.destroy(1000000, { from: user })
      } catch (e) {
        assert.include(e.message, 'invalid opcode')
      }
    })
  })
})
