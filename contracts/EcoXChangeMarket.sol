pragma solidity ^0.5.0;

import "./ValidatorRegistry.sol";
import "./EcoXChangeToken.sol";
import "./Company.sol";

/**
 * @title EcoXChangeMarket
 * @dev This contract represents a carbon credit market where users can buy and sell carbon credits.
 */
contract EcoXChangeMarket {
    // Events
    event BuyCredit(address buyer, uint256 amount);
    event ReturnCredits(address seller, uint256 amount);
    event ProjectValidated(
        address companyAddress,
        uint256 projectId,
        bool isValid
    );
    event Penalty(address companyAddress, uint256 projectId);

    // State variables
    EcoXChangeToken ecoXChangeTokenInstance;
    ValidatorRegistry validatorRegistryInstance;
    Company companyInstance;
    uint256 excBank = 0;
    address _owner = msg.sender;
    mapping(address => bool) public isSeller;
    mapping(address => uint256[]) public companyProjects; // Mapping of company address to list of projects
    mapping(uint256 => address[]) public projectBuyers; // Mapping of project id to list of buyers
    mapping(address => mapping(uint256 => uint256)) public projectStakes; //mapping of buyer address to project id to amount
    mapping(address => mapping(uint256 => uint256)) public relisted; // Mapping of company address to projectId to their excs sold, due to listing project that have been validated

    // Constructor
    constructor(
        Company companyAddress,
        EcoXChangeToken ecoXChangeTokenAddress,
        ValidatorRegistry validatorRegistryAddress
    ) public {
        ecoXChangeTokenInstance = ecoXChangeTokenAddress;
        validatorRegistryInstance = validatorRegistryAddress;
        companyInstance = companyAddress;
    }

    /**
     * @dev Modifier that allows only the contract owner to call the function.
     */
    modifier onlyOwner() {
        require(
            msg.sender == _owner,
            "Only contract owner can call this function"
        );
        _;
    }

    /**
     * @dev Modifier that restricts the execution of a function to only be called by a registered validator.
     */
    modifier onlyValidator() {
        require(
            validatorRegistryInstance.isValidator(msg.sender),
            "Only validator can call this function"
        );
        _;
    }

    /**
     * @dev Allows the contract owner to withdraw a specified amount of Ether from the contract balance and transfer it to a specified company address.
     * @param companyAddress The address of the company to which the Ether will be transferred.
     * @param amount The amount of Ether to be withdrawn and transferred.
     * @notice Only the contract owner can call this function.
     * @dev Throws an error if the specified amount is greater than the contract balance.
     */
    function withdrawEther(
        address payable companyAddress,
        uint256 amount
    ) public onlyValidator {
        require(
            amount <= address(this).balance,
            "Insufficient contract balance"
        );
        amount = amount * 1 ether; //convert to wei before transfer
        companyAddress.transfer(amount);
    }

    /**
     * @dev Check whether or not a company has provided enough Ether to stake for a project (for penalty purposes).
     * @param _excAmount The amount of exc they wish to sell from the project.
     * @param etherAmount The amount of Ether supplied.
     */
    function checkSufficientStake(
        uint256 _excAmount,
        uint256 etherAmount
    ) public pure returns (bool) {
        uint256 stakedAmount = (_excAmount * 13) / 10;
        return etherAmount >= stakedAmount;
    }

    /**
     * @dev Validate a project by a validator, and handle penalty if project is invalid, otherwise transfer EXC to buyers.
     * @param companyAddress The address of the company.
     * @param projectId The ID of the project.
     * @param isValid A boolean indicating whether the project is valid or not.
     * @param actualEXC The actual EXC (EcoXChange Token) amount for the project.
     * @notice This function can only be called by a validator.
     */
    function validateProject(
        address payable companyAddress,
        uint256 projectId,
        bool isValid,
        uint256 actualEXC
    ) public onlyValidator {
        // Validate a project by a validator, and handle penalty if project is invalid, otherwise transfer EXC to buyers
        require(
            companyInstance.getProjectState(projectId) !=
                Company.ProjectState.completed,
            "Project completed, cannot be validated again"
        ); // Check if project is completed, cannot be validated again
        companyInstance.setProjectStateComplete(projectId); // Set project state to completed
        emit ProjectValidated(companyAddress, projectId, isValid); // Emit event for project validation
        if (!isValid) {
            // Project is invalid
            handlePenalty(companyAddress, projectId, actualEXC);
        } else {
            // Project is valid
            //Transfer EXC to buyers
            address[] storage buyers = projectBuyers[projectId];
            for (uint256 i = 0; i < buyers.length; i++) {
                // Loop through buyers of the project
                address buyer = buyers[i];
                uint256 buyerStake = projectStakes[buyer][projectId]; // Get buyer's stake for the project
                ecoXChangeTokenInstance.getEXC(buyer, buyerStake); // Mint EXC to buyer
                projectStakes[buyer][projectId] = 0; // Reset buyer's stake to 0
            }
            // Project's EXCAmount left is returned to project
            uint256 excAmountUnsold = actualEXC -
                companyInstance.getEXCSold(projectId);
            companyInstance.setProjectexcAmount(projectId, excAmountUnsold); // Update project's EXC amount, project can be resold with remaining EXC by seller
            // Return penalty + profit to seller
            uint256 stakedCredits = companyInstance.getStakedCredits( // Get staked credits (sellers stake 130% (of ether)) for the project
                    companyAddress,
                    projectId
                );
            uint256 returnPenalty = (stakedCredits * 3) / 1000; // Calculate penalty amount to return to seller
            withdrawEther(
                companyAddress,
                returnPenalty + companyInstance.getEXCSold(projectId)
            ); // Return penalty amount and profit back to seller
        }

        companyInstance.setEXCListed(projectId, 0);
        companyInstance.setEXCSold(projectId, 0);
    }

    /**
     * @dev Handles penalty for a project that fails validation.
     * @param companyAddress The address of the company associated with the project.
     * @param projectId The ID of the project.
     * @param actualEXC The actual EcoXChange Tokens (EXC) generated by the project.
     *
     * Emits a `Penalty` event for the failed project.
     * Loops through the buyers of the project and performs the following actions:
     * - If the actual EXC is greater than or equal to the EXC sold, mints the actual EXC to the buyer.
     * - If the actual EXC is less than the EXC sold, calculates the actual EXC received by the buyer,
     *   mints the actual EXC to the buyer, and transfers the compensation amount to the buyer.
     * Transfers the profits to the company and keeps the penalty amount.
     * Resets the buyer's stake to 0.
     */
    function handlePenalty(
        address payable companyAddress,
        uint256 projectId,
        uint256 actualEXC // Actual EXC generated by the project
    ) internal {
        // Handle penalty for a project that fails validation
        emit Penalty(companyAddress, projectId);
        for (uint256 i = 0; i < projectBuyers[projectId].length; i++) {
            // Loop through buyers of the project
            address buyer = projectBuyers[projectId][i]; // Get buyer address
            address payable buyerPayable;
            assembly {
                buyerPayable := buyer
            } //make buyer payable
            uint256 buyerStake = projectStakes[buyer][projectId]; // Get buyer's stake for the project
            if (actualEXC >= companyInstance.getEXCSold(projectId)) {
                // If actual EXC is greater than or equal to EXC sold
                ecoXChangeTokenInstance.getEXC(buyer, buyerStake); // Mint actual EXC to buyer, penalty and profits kept by market
            } else {
                // If actual EXC is less than EXC sold
                uint256 actualBuyerEXC = (buyerStake * actualEXC) /
                    companyInstance.getEXCSold(projectId); // Calculate actual EXC received by the buyer, based on proportion
                ecoXChangeTokenInstance.getEXC(buyer, actualBuyerEXC); // Mint actual EXC to buyer
                uint256 buyerCompensation = buyerStake - actualBuyerEXC; // Calculate compensation amount to buyer
                withdrawEther(buyerPayable, buyerCompensation); // Transfer compensation amount to buyer
            }
            projectStakes[buyer][projectId] = 0; // Reset buyer's stake to 0
        }

        if (actualEXC >= companyInstance.getEXCSold(projectId)) {
            // sellers have more exc to be resold
            uint256 excAmountUnsold = actualEXC -
                companyInstance.getEXCSold(projectId); // Calculate EXC amount unsold
            companyInstance.setProjectexcAmount(projectId, excAmountUnsold); // Update project's EXC amount, project can be resold with remaining EXC by seller
            ecoXChangeTokenInstance.getEXC(companyAddress, excAmountUnsold); // Mint actual EXC to company

            withdrawEther(
                companyAddress,
                companyInstance.getEXCSold(projectId)
            ); // Transfer profits to company, penalty kept by market
        } else {
            companyInstance.setProjectexcAmount(projectId, 0); // Update project's EXC amount to 0 as all EXC sold
            withdrawEther(companyAddress, actualEXC); // Transfer profits to company (only got profits from the actual exc sold), penalty kept by market
        }
    }

    /**
     * @dev Allows a seller to list and sell EcoXChange tokens (EXC) for a specific project.
     * @param _excAmount The amount of EXC to be sold.
     * @param projectId The ID of the project for which the EXC is being sold.
     *  The seller must have enough EXC listed for the project and sufficient EXC balance to sell.
     *  If the project is completed, the EXC is transferred to the market and the seller receives ether.
     *  If the project is ongoing, the seller must stake 130% of the EXC amount in ether.
     *  The seller's ether is transferred to the contract for staking, with 30% being a penalty.
     *  The EXC is listed and the project is added to the seller's list of projects.
     *  Emits a `ReturnCredits` event with the seller's address and the amount of EXC sold.
     */

    function sell(uint256 _excAmount, uint256 projectId) public payable {
        //seller lists exc for sale anytime during project
        require(_excAmount > 0, "Invalid amount");
        require(
            companyInstance.checkEXCListed(msg.sender, projectId, _excAmount),
            "EXC for project overexceeded"
        ); // Check if excListed is <= to excAmount, must have enuf excAmount in project to sell
        require(
            companyInstance.checkSufficientEXC(
                msg.sender,
                projectId,
                _excAmount
            ),
            "Insufficient EXC to sell"
        ); // Check if seller has enough exc to sell in project, especially after sold excs from this project before

        if (
            companyInstance.getProjectState(projectId) ==
            Company.ProjectState.completed
        ) {
            // if project is completed
            excBank += _excAmount; // add EXC to bank
            relisted[msg.sender][projectId] += _excAmount; // add exc from company to relisted
            companyInstance.listEXC(msg.sender, projectId, _excAmount); //update excListed in project
            ecoXChangeTokenInstance.transferEXC(address(this), _excAmount); // transfer EXC to market, from seller
        } else {
            //check if company has enough ether to stake only if project is ongoing
            require(
                checkSufficientStake(_excAmount, msg.value),
                "Insufficient ether to stake"
            ); // Seller has to transfer 130% ether to contract for staking, 30% is penalty. Ether is transferred as msg.value is called.
            uint256 stakedAmount = (_excAmount * 13) / 10; // sellers stake 130% (of ether), 30% is penalty
            companyInstance.stakeCredits(msg.sender, projectId, stakedAmount); //stake credits
            companyInstance.listEXC(msg.sender, projectId, _excAmount); //update excListed in project

            //Check if project has been listed by company (if company has sold tokens from project before)
            uint256[] storage projectList = companyProjects[msg.sender];
            bool projectAdded = false;
            for (uint256 i = 0; i < projectList.length; i++) {
                if (projectList[i] == projectId) {
                    projectAdded = true; // project already added
                }
            }
            if (!projectAdded) {
                companyProjects[msg.sender].push(projectId); // add project to list of projects
            }
            isSeller[msg.sender] = true; // add address of seller to list of sellers
        }
        emit ReturnCredits(msg.sender, _excAmount);
    }

    /**
     * @dev Allows a buyer to purchase carbon credits from a project.
     * @param _excAmount The amount of carbon credits to purchase.
     * @param companyAddress The address of the company selling the carbon credits.
     * @param projectId The ID of the project from which to purchase the carbon credits.
     */
    function buy(
        uint256 _excAmount,
        address payable companyAddress,
        uint256 projectId
    ) public payable {
        // UI: has to click on a project to buy -- hence project has to be listed for this function to be called; no checks needed
        require(_excAmount > 0, "Invalid amount");
        require(msg.value == _excAmount * 1 ether, "Invalid amount"); //ensure buyer gave correct amount of ether to contract for buying
        require(
            companyInstance.checkSufficientEXC(
                companyAddress,
                projectId,
                _excAmount
            ),
            "Insufficient EXC in project to buy"
        ); // Check if buyer has enough exc to buy in project

        companyInstance.sellEXC(companyAddress, projectId, _excAmount); // increase excSold in project by _excAmount

        if (
            companyInstance.getProjectState(projectId) ==
            Company.ProjectState.completed
        ) {
            require(
                _excAmount <= relisted[companyAddress][projectId],
                "Insuffucient EXC to buy"
            );
            excBank -= _excAmount; // deduct EXC from bank
            relisted[companyAddress][projectId] -= _excAmount; // deduct EXC from company's relisted EXC
            ecoXChangeTokenInstance.transferEXC(msg.sender, _excAmount); // transfer EXC to buyer from market
            companyAddress.transfer(msg.value); // transfer ether to company
        } else {
            projectStakes[msg.sender][projectId] += _excAmount; // add "share" of the project's EXC bought to the buyer

            // check if buyer has bought from project before
            address[] storage buyerList = projectBuyers[projectId];
            bool buyerAdded = false;
            for (uint256 i = 0; i < buyerList.length; i++) {
                if (buyerList[i] == msg.sender) {
                    buyerAdded = true;
                }
            }
            if (!buyerAdded) {
                projectBuyers[projectId].push(msg.sender);
            }
        }
        emit BuyCredit(msg.sender, _excAmount);
    }

    function getProjectBuyers(
        uint256 projectId
    ) public view returns (address[] memory) {
        return projectBuyers[projectId];
    }
}
