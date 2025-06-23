pragma solidity ^0.5.0;

import "./ERC20.sol";

/**
 * @title EcoXChangeToken
 * @dev A token contract representing EcoXChange Tokens.
 */
contract EcoXChangeToken {
    // Events
    event EXCMinted(address recipient, uint256 amt);

    // State variables
    ERC20 erc20Contract;
    address owner = msg.sender;

    constructor(address _erc20TokenAddress) public {
        ERC20 e = new ERC20();
        erc20Contract = e;
        owner = msg.sender;
    }

    /**
     * @dev Function to mint EcoXChange Tokens (EXC) to the recipient.
     * @param recipient Address of the recipient that will receive the EXC.
     * @param amtOfEXC Amount of EXC to mint.
     * @return The amount of EXC minted.
     */
    function getEXC(
        address recipient,
        uint256 amtOfEXC
    ) public payable returns (uint256) {
        require(amtOfEXC > 0, "Amount must be greater than zero");
        //1 ether = 1 EXC, no need to convert weiAmt to EXC
        erc20Contract.mint(recipient, amtOfEXC);
        emit EXCMinted(recipient, amtOfEXC);
        return amtOfEXC;
    }

    /**
     * @dev Function to check the credit of the owner
     * @param ad address of the owner
     * @return uint256 credit of the owner
     */
    function checkEXC(address ad) public view returns (uint256) {
        uint256 credit = erc20Contract.balanceOf(ad);
        return credit;
    }

    /**
     * @dev Function to transfer EXC from the owner to the recipient
     * @param recipient address of the recipient
     * @param amt amount of EXC to transfer
     */
    function transferEXC(address recipient, uint256 amt) public {
        // Transfers from tx.origin to receipient
        erc20Contract.transfer(recipient, amt);
    }

    /**
     * @dev Function to transfer EXC from the owner to the recipient
     * @param sender address of the sender
     * @param recipient address of the recipient
     * @param amt amount of EXC to transfer
     */
    function transferEXCFrom(
        address sender,
        address recipient,
        uint256 amt
    ) public {
        // Transfers from tx.origin to receipient
        erc20Contract.transferFrom(sender, recipient, amt);
    }

    /**
     * @dev Function to destroy EXC
     * @param tokenOwner address of the owner
     * @param tokenAmount amount of EXC to destroy
     * @return uint256 amount of EXC destroyed
     */
    function destroyEXC(
        address tokenOwner,
        uint256 tokenAmount
    ) public returns (uint256) {
        require(
            checkEXC(tokenOwner) >= tokenAmount,
            "Insufficient EXC to burn"
        );
        erc20Contract.burn(tokenOwner, tokenAmount);
        return tokenAmount;
    }
}
