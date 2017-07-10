pragma solidity ^0.4.11;


import "./TKRToken.sol";
import "./TKRPToken.sol";
import "./Ownable.sol";


/**
 * @title Crowdsale
 * @dev Smart contract which collects ETH and in return transfers the TKRToken to the contributors
 * Log events are emitted for each transaction 
 */
contract Crowdsale is Ownable {
    using SafeMath for uint256;

    /* 
    * Stores the contribution in wei
    * Stores the amount received in TKR
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
    event MigratedTokens(address indexed _address, uint256 value);

    /* Constants */
    uint256 public constant TOKEN_CAP = 58500000;
    uint256 public constant MINIMUM_CONTRIBUTION = 10 finney;
    uint256 public constant TOKENS_PER_ETHER = 5000;
    uint256 public constant CROWDSALE_DURATION = 30 days;

    /* Public Variables */
    TKRToken public token;
    TKRPToken public preToken;
    address public crowdsaleOwner;
    uint256 public etherReceived;
    uint256 public tokensSent;
    uint256 public crowdsaleStartTime;
    uint256 public crowdsaleEndTime;

    /* Modifier to check whether the crowdsale is running */
    modifier crowdsaleRunning() {
        if (now > crowdsaleEndTime || now < crowdsaleStartTime) throw;
        _;
    }

    /**
    * @dev Fallback function which invokes the processContribution function
    * @param _tokenAddress TKR Token address
    * @param _to crowdsale owner address
    */
    function Crowdsale(address _tokenAddress, address _preTokenAddress, address _to) {
        token = TKRToken(_tokenAddress);
        preToken = TKRPToken(_preTokenAddress);
        crowdsaleOwner = _to;
    }

    /**
    * @dev Fallback function which invokes the processContribution function
    */
    function() crowdsaleRunning payable {
        processContribution(msg.sender);
    }

    /**
    * @dev Starts the crowdsale
    */
    function start() onlyOwner {
        if (crowdsaleStartTime != 0) throw;

        crowdsaleStartTime = now;            
        crowdsaleEndTime = now + CROWDSALE_DURATION;    
    }

    /**
    * @dev A backup fail-safe drain if required
    */
    function drain() onlyOwner {
        if (!crowdsaleOwner.send(this.balance)) throw;
    }

    /**
    * @dev Finalizes the crowdsale and sends funds
    */
    function finalize() onlyOwner {
        if ((crowdsaleStartTime == 0 || now < crowdsaleEndTime) && tokensSent != TOKEN_CAP) {
            throw;
        }

        uint256 remainingBalance = token.balanceOf(this);
        if (remainingBalance > 0) token.destroy(remainingBalance);

        if (!crowdsaleOwner.send(this.balance)) throw;
    }

    /**
    * @dev Migrates TKRP tokens to TKR token at a rate of 1:1 during the Crowdsale.
    */
    function migrate() crowdsaleRunning {
        uint256 preTokenBalance = preToken.balanceOf(msg.sender);
        if (preTokenBalance == 0) throw;

        preToken.destroyFrom(msg.sender);
        token.transfer(msg.sender, preTokenBalance);

        MigratedTokens(msg.sender, preTokenBalance);
    }

    /**
    * @dev Processes the contribution given, sends the tokens and emits events
    * @param sender The address of the contributor
    */
    function processContribution(address sender) internal {
        if (msg.value < MINIMUM_CONTRIBUTION) throw;

        // // /* Calculate total (+bonus) amount to send, throw if it exceeds cap*/
        uint256 contributionInTokens = bonus(msg.value.mul(TOKENS_PER_ETHER).div(1 ether));
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

    /**
    * @dev Calculates the bonus amount based on the contribution date
    * @param amount The contribution amount given
    */
    function bonus(uint256 amount) internal constant returns (uint256) {
        /* This adds a bonus 20% such as 100 + 100/5 = 120 */
        if (now < crowdsaleStartTime.add(2 days)) return amount.add(amount.div(5));

        /* This adds a bonus 10% such as 100 + 100/10 = 110 */
        if (now < crowdsaleStartTime.add(14 days)) return amount.add(amount.div(10));

        /* This adds a bonus 5% such as 100 + 100/20 = 105 */
        if (now < crowdsaleStartTime.add(21 days)) return amount.add(amount.div(20));

        /* No bonus is given */
        return amount;
    }
}
