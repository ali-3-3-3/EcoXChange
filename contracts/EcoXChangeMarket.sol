pragma solidity ^0.5.0;

import "./ValidatorRegistry.sol";
import "./EcoXChangeToken.sol";
import "./Company.sol";
import "./AccessControl.sol";
import "./DynamicPricing.sol";

/**
 * @title EcoXChangeMarket
 * @dev This contract represents a carbon credit market where users can buy and sell carbon credits with enhanced security.
 */
contract EcoXChangeMarket is AccessControl {
    // Events
    event BuyCredit(
        address buyer,
        uint256 amount,
        uint256 price,
        uint256 totalCost
    );
    event ReturnCredits(
        address seller,
        uint256 amount,
        uint256 price,
        uint256 totalRevenue
    );
    event ProjectValidated(
        address companyAddress,
        uint256 projectId,
        bool isValid
    );
    event Penalty(address companyAddress, uint256 projectId);
    event PriceDiscovery(
        uint256 indexed projectId,
        uint256 oldPrice,
        uint256 newPrice
    );
    event MarketMaking(
        uint256 indexed projectId,
        uint256 bidPrice,
        uint256 askPrice
    );

    // State variables
    EcoXChangeToken ecoXChangeTokenInstance;
    ValidatorRegistry validatorRegistryInstance;
    Company companyInstance;
    DynamicPricing dynamicPricingInstance;
    uint256 excBank = 0;
    mapping(address => bool) public isSeller;
    mapping(address => uint256[]) public companyProjects; // Mapping of company address to list of projects
    mapping(uint256 => address[]) public projectBuyers; // Mapping of project id to list of buyers
    mapping(address => mapping(uint256 => uint256)) public projectStakes; //mapping of buyer address to project id to amount
    mapping(address => mapping(uint256 => uint256)) public relisted; // Mapping of company address to projectId to their excs sold, due to listing project that have been validated

    // Enhanced security mappings
    mapping(uint256 => bool) public projectValidated; // Track validated projects
    mapping(address => uint256) public userTransactionCount; // Track user activity
    mapping(uint256 => uint256) public projectCreationTime; // Track project creation time

    // Constants for validation
    uint256 public constant MIN_TRANSACTION_AMOUNT = 1;
    uint256 public constant MAX_TRANSACTION_AMOUNT = 10000;
    uint256 public constant STAKE_PERCENTAGE = 130; // 130% staking requirement

    // Constructor
    constructor(
        Company companyAddress,
        EcoXChangeToken ecoXChangeTokenAddress,
        ValidatorRegistry validatorRegistryAddress,
        DynamicPricing dynamicPricingAddress
    ) public {
        ecoXChangeTokenInstance = ecoXChangeTokenAddress;
        validatorRegistryInstance = validatorRegistryAddress;
        companyInstance = companyAddress;
        dynamicPricingInstance = dynamicPricingAddress;
    }

    /**
     * @dev Modifier that restricts the execution of a function to only be called by a registered validator.
     */
    modifier onlyActiveValidator() {
        require(
            validatorRegistryInstance.isValidator(msg.sender),
            "EcoXChangeMarket: caller is not an active validator"
        );
        _;
    }

    /**
     * @dev Modifier to validate project exists and is not completed
     */
    modifier validProject(uint256 projectId) {
        require(
            projectId < companyInstance.numProjects(),
            "EcoXChangeMarket: project does not exist"
        );
        require(
            companyInstance.getProjectState(projectId) !=
                Company.ProjectState.completed,
            "EcoXChangeMarket: project already completed"
        );
        _;
    }

    /**
     * @dev Modifier to validate transaction amounts
     */
    modifier validTransactionAmount(uint256 amount) {
        require(
            amount >= MIN_TRANSACTION_AMOUNT &&
                amount <= MAX_TRANSACTION_AMOUNT,
            "EcoXChangeMarket: transaction amount out of bounds"
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
    )
        public
        onlyActiveValidator
        validAddress(companyAddress)
        validAmount(amount)
    {
        require(
            amount <= address(this).balance,
            "Insufficient contract balance"
        );
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
    )
        public
        onlyActiveValidator
        whenNotPaused
        validAddress(companyAddress)
        validProject(projectId)
        validAmount(actualEXC)
        nonReentrant
    {
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
                if (buyerStake > 0) {
                    ecoXChangeTokenInstance.getEXC(buyer, buyerStake); // Mint EXC to buyer
                }
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

    function sell(
        uint256 _excAmount,
        uint256 projectId
    )
        public
        payable
        whenNotPaused
        notBlacklisted(msg.sender)
        validTransactionAmount(_excAmount)
        nonReentrant
    {
        // Enhanced validation - check if sender is a registered company
        require(
            companyInstance.registeredCompanies(msg.sender),
            "EcoXChangeMarket: caller must be a registered company"
        );
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

        // Get current dynamic price
        uint256 currentPrice = dynamicPricingInstance.getCurrentPrice(
            projectId
        );
        uint256 totalRevenue = _excAmount * currentPrice;

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

        // Update pricing after trade
        dynamicPricingInstance.updatePriceAfterTrade(
            projectId,
            _excAmount,
            false
        );

        emit ReturnCredits(msg.sender, _excAmount, currentPrice, totalRevenue);
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
    )
        public
        payable
        whenNotPaused
        notBlacklisted(msg.sender)
        validAddress(companyAddress)
        validTransactionAmount(_excAmount)
        nonReentrant
    {
        // Get current dynamic price
        uint256 currentPrice = dynamicPricingInstance.getCurrentPrice(
            projectId
        );
        uint256 totalCost = _excAmount * currentPrice;

        // Enhanced validation
        require(
            msg.value >= totalCost,
            "EcoXChangeMarket: insufficient ether for current price"
        );
        require(
            companyInstance.registeredCompanies(companyAddress),
            "EcoXChangeMarket: company address is not registered"
        );
        require(
            companyInstance.checkSufficientEXC(
                companyAddress,
                projectId,
                _excAmount
            ),
            "Insufficient EXC in project to buy"
        ); // Check if buyer has enough exc to buy in project

        companyInstance.sellEXC(companyAddress, projectId, _excAmount); // increase excSold in project by _excAmount

        // Calculate refund if overpaid
        uint256 refund = msg.value - totalCost;

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
            companyAddress.transfer(totalCost); // transfer exact cost to company
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

        // Update dynamic pricing after trade
        dynamicPricingInstance.updatePriceAfterTrade(
            projectId,
            _excAmount,
            true
        );

        // Refund overpayment
        if (refund > 0) {
            msg.sender.transfer(refund);
        }

        emit BuyCredit(msg.sender, _excAmount, currentPrice, totalCost);
    }

    function getProjectBuyers(
        uint256 projectId
    ) public view returns (address[] memory) {
        return projectBuyers[projectId];
    }

    /**
     * @dev Get current price for a project
     */
    function getCurrentPrice(uint256 projectId) public view returns (uint256) {
        return dynamicPricingInstance.getCurrentPrice(projectId);
    }

    /**
     * @dev Get comprehensive pricing information for a project
     */
    function getProjectPricingInfo(
        uint256 projectId
    )
        public
        view
        returns (
            uint256 currentPrice,
            uint256 basePrice,
            uint256 minPrice,
            uint256 maxPrice,
            DynamicPricing.PricingModel model,
            uint256 totalVolume,
            uint256 qualityScore,
            uint256 demandScore,
            uint256 supplyScore
        )
    {
        return dynamicPricingInstance.getProjectPricingInfo(projectId);
    }

    /**
     * @dev Calculate price impact for a potential trade
     */
    function calculatePriceImpact(
        uint256 projectId,
        uint256 tradeAmount,
        bool isBuy
    ) public view returns (uint256 priceImpact, uint256 newPrice) {
        return
            dynamicPricingInstance.calculatePriceImpact(
                projectId,
                tradeAmount,
                isBuy
            );
    }

    /**
     * @dev Get market conditions
     */
    function getMarketConditions()
        public
        view
        returns (
            uint256 demandMultiplier,
            uint256 supplyMultiplier,
            uint256 volatilityIndex,
            uint256 sentiment,
            uint256 lastUpdate
        )
    {
        return dynamicPricingInstance.getMarketConditions();
    }

    /**
     * @dev Initialize pricing for a new project (admin only)
     */
    function initializeProjectPricing(
        uint256 projectId,
        DynamicPricing.PricingModel model,
        uint256 qualityScore
    ) public onlyRole(ADMIN_ROLE) whenNotPaused {
        dynamicPricingInstance.initializeProjectPricing(
            projectId,
            model,
            qualityScore
        );
    }

    /**
     * @dev Update market conditions (admin only)
     */
    function updateMarketConditions(
        uint256 demandMultiplier,
        uint256 supplyMultiplier,
        uint256 volatilityIndex,
        uint256 sentiment
    ) public onlyRole(ADMIN_ROLE) whenNotPaused {
        dynamicPricingInstance.updateMarketConditions(
            demandMultiplier,
            supplyMultiplier,
            volatilityIndex,
            sentiment
        );
    }
}
