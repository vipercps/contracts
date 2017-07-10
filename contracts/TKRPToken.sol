pragma solidity ^0.4.11;


import "./StandardToken.sol";


/**
 * @title TKRPToken
 * @dev Very simple ERC20 Token example, where all tokens are pre-assigned to the creator. 
 * Note they can later distribute these tokens as they wish using `transfer` and other
 * `StandardToken` functions.
 */
contract TKRPToken is StandardToken {
    event Destroy(address indexed _from);

    string public name = "TKRPToken";
    string public symbol = "TKRP";
    uint256 public decimals = 18;
    uint256 public initialSupply = 500000;

    /**
    * @dev Contructor that gives the sender all tokens
    */
    function TKRPToken() {
        totalSupply = initialSupply;
        balances[msg.sender] = initialSupply;
    }

    /**
    * @dev Destroys tokens from an address, this process is irrecoverable.
    * @param _from The address to destroy the tokens from.
    */
    function destroyFrom(address _from) onlyOwner returns (bool) {
        uint256 balance = balanceOf(_from);
        if (balance == 0) throw;

        balances[_from] = 0;
        totalSupply = totalSupply.sub(balance);

        Destroy(_from);
    }
}
