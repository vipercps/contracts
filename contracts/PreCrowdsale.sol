pragma solidity ^0.4.11;


import "./TKRPToken.sol";
import "./Ownable.sol";


/**
 * @title PreCrowdsale
 * @dev Smart contract which collects ETH and in return transfers the TKRPToken to the contributors
 * Log events are emitted for each transaction 
 */
contract PreCrowdsale is Ownable {
    using SafeMath for uint256;

    /* 
    * Stores the contribution in wei
    * Stores the amount received in TKRP
    */
    struct Contributor {
        uint256 contributed;
        uint256 received;
    }

    /* Backers are keyed by their address containing a Contributor struct */
    mapping(address => Contributor) public contributors;

    /* Events to emit when a contribution has successfully processed */
    event TokensSent(address indexed to, uint256 value);
    event ContributionReceived(address indexed to, uint256 value);

    /* Constants */
    uint256 public constant TOKEN_CAP = 500000;
    uint256 public constant MINIMUM_CONTRIBUTION = 10 finney;
    uint256 public constant TOKENS_PER_ETHER = 10000;
    uint256 public constant PRE_CROWDSALE_DURATION = 5 days;

    /* Public Variables */
    TKRPToken public token;
    address public preCrowdsaleOwner;
    uint256 public etherReceived;
    uint256 public tokensSent;
    uint256 public preCrowdsaleStartTime;
    uint256 public preCrowdsaleEndTime;

    /* Modifier to check whether the preCrowdsale is running */
    modifier preCrowdsaleRunning() {
        if (now > preCrowdsaleEndTime || now < preCrowdsaleStartTime) throw;
        _;
    }

    /**
    * @dev Fallback function which invokes the processContribution function
    * @param _tokenAddress TKRP Token address
    * @param _to preCrowdsale owner address
    */
    function PreCrowdsale(address _tokenAddress, address _to) {
        token = TKRPToken(_tokenAddress);
        preCrowdsaleOwner = _to;
    }

    /**
    * @dev Fallback function which invokes the processContribution function
    */
    function() preCrowdsaleRunning payable {
        processContribution(msg.sender);
    }

    /**
    * @dev Starts the preCrowdsale
    */
    function start() onlyOwner {
        if (preCrowdsaleStartTime != 0) throw;

        preCrowdsaleStartTime = now;            
        preCrowdsaleEndTime = now + PRE_CROWDSALE_DURATION;    
    }

    /**
    * @dev A backup fail-safe drain if required
    */
    function drain() onlyOwner {
        if (!preCrowdsaleOwner.send(this.balance)) throw;
    }

    /**
    * @dev Finalizes the preCrowdsale and sends funds
    */
    function finalize() onlyOwner {
        if ((preCrowdsaleStartTime == 0 || now < preCrowdsaleEndTime) && tokensSent != TOKEN_CAP) {
            throw;
        }

        if (!preCrowdsaleOwner.send(this.balance)) throw;
    }

    /**
    * @dev Processes the contribution given, sends the tokens and emits events
    * @param sender The address of the contributor
    */
    function processContribution(address sender) internal {
        if (msg.value < MINIMUM_CONTRIBUTION) throw;

        uint256 contributionInTokens = msg.value.mul(TOKENS_PER_ETHER).div(1 ether);
        if (contributionInTokens.add(tokensSent) > TOKEN_CAP) throw; 

        /* Send the tokens */
        token.transfer(sender, contributionInTokens);

        /* Create a contributor struct and store the contributed/received values */
        Contributor contributor = contributors[sender];
        contributor.received = contributor.received.add(contributionInTokens);
        contributor.contributed = contributor.contributed.add(msg.value);

        // /* Update the total amount of tokens sent and ether received */
        etherReceived = etherReceived.add(msg.value);
        tokensSent = tokensSent.add(contributionInTokens);

        // /* Emit log events */
        TokensSent(sender, contributionInTokens);
        ContributionReceived(sender, msg.value);
    }
}
