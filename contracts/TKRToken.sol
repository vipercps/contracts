pragma solidity ^0.4.11;


import "./StandardToken.sol";


/**
 * @title TKRToken
 * @dev Very simple ERC20 Token example, where all tokens are pre-assigned to the creator. 
 * Note they can later distribute these tokens as they wish using `transfer` and other
 * `StandardToken` functions.
 */
contract TKRToken is StandardToken {
    event Destroy(address indexed _from, address indexed _to, uint256 _value);

    string public name = "TKRToken";
    string public symbol = "TKR";
    uint256 public decimals = 18;
    uint256 public initialSupply = 65000000;

    /**
    * @dev Contructor that gives the sender all tokens
    */
    function TKRToken() {
        totalSupply = initialSupply;
        balances[msg.sender] = initialSupply;
    }

    /**
    * @dev Destroys tokens, this process is irrecoverable.
    * @param _value The amount to destroy.
    */
    function destroy(uint256 _value) onlyOwner returns (bool) {
        balances[msg.sender] = balances[msg.sender].sub(_value);
        totalSupply = totalSupply.sub(_value);
        Destroy(msg.sender, 0x0, _value);
    }
}
