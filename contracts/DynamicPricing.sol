pragma solidity ^0.5.0;

import "./AccessControl.sol";
import "./Company.sol";

/**
 * @title DynamicPricing
 * @dev Advanced dynamic pricing engine for carbon credits with multiple pricing models
 * @notice This contract implements sophisticated pricing algorithms based on supply/demand, project quality, and market conditions
 */
contract DynamicPricing is AccessControl {
    // Events
    event PriceUpdated(
        uint256 indexed projectId,
        uint256 oldPrice,
        uint256 newPrice,
        string reason
    );
    event MarketConditionChanged(
        uint256 indexed factor,
        uint256 oldValue,
        uint256 newValue
    );
    event PricingModelChanged(
        uint256 indexed projectId,
        PricingModel oldModel,
        PricingModel newModel
    );
    event VolatilityAlert(
        uint256 indexed projectId,
        uint256 volatilityPercentage
    );

    // Pricing Models
    enum PricingModel {
        FIXED, // Fixed price (legacy)
        SUPPLY_DEMAND, // Supply and demand based
        BONDING_CURVE, // Bonding curve pricing
        AUCTION, // Auction-based pricing
        TWAP, // Time-weighted average price
        QUALITY_ADJUSTED // Quality-adjusted pricing
    }

    // Market Condition Factors
    struct MarketConditions {
        uint256 globalDemandMultiplier; // 1000 = 100% (normal), 1200 = 120% (high demand)
        uint256 globalSupplyMultiplier; // 1000 = 100% (normal), 800 = 80% (low supply)
        uint256 volatilityIndex; // 0-1000, higher = more volatile
        uint256 marketSentiment; // 0-2000, 1000 = neutral, >1000 = bullish
        uint256 lastUpdateTime;
    }

    // Project Pricing Data
    struct ProjectPricing {
        uint256 basePrice; // Base price in wei per EXC
        uint256 currentPrice; // Current market price in wei per EXC
        uint256 minPrice; // Minimum allowed price
        uint256 maxPrice; // Maximum allowed price
        PricingModel model; // Active pricing model
        uint256 totalVolume; // Total trading volume
        uint256 lastTradeTime; // Last trade timestamp
        uint256 priceHistory; // Simple price history (last 5 prices encoded)
        uint256 qualityScore; // Project quality score (0-1000)
        uint256 demandScore; // Current demand score (0-1000)
        uint256 supplyScore; // Current supply score (0-1000)
    }

    // Bonding Curve Parameters
    struct BondingCurve {
        uint256 reserveRatio; // Reserve ratio for bonding curve (0-1000000)
        uint256 slope; // Curve slope parameter
        uint256 intercept; // Curve intercept parameter
    }

    // State variables
    Company public companyInstance;
    MarketConditions public marketConditions;

    mapping(uint256 => ProjectPricing) public projectPricing;
    mapping(uint256 => BondingCurve) public bondingCurves;
    mapping(uint256 => mapping(uint256 => uint256)) public priceHistoryDetailed; // projectId => timestamp => price
    mapping(address => uint256) public userTradingVolume;
    mapping(uint256 => uint256) public dailyVolume; // day => volume

    // Constants
    uint256 public constant BASE_PRICE = 1 ether; // 1 ETH base price
    uint256 public constant MIN_PRICE = 0.1 ether; // Minimum 0.1 ETH
    uint256 public constant MAX_PRICE = 10 ether; // Maximum 10 ETH
    uint256 public constant PRICE_PRECISION = 1000000; // 6 decimal precision
    uint256 public constant MAX_VOLATILITY = 1000; // Maximum volatility index
    uint256 public constant QUALITY_WEIGHT = 200; // Quality factor weight
    uint256 public constant DEMAND_WEIGHT = 300; // Demand factor weight
    uint256 public constant SUPPLY_WEIGHT = 300; // Supply factor weight
    uint256 public constant TIME_DECAY_FACTOR = 200; // Time decay weight

    // Time constants
    uint256 public constant HOUR = 3600;
    uint256 public constant DAY = 86400;
    uint256 public constant WEEK = 604800;

    /**
     * @dev Constructor initializes the pricing engine
     */
    constructor(address _companyAddress) public {
        companyInstance = Company(_companyAddress);

        // Initialize market conditions
        marketConditions = MarketConditions({
            globalDemandMultiplier: 1000,
            globalSupplyMultiplier: 1000,
            volatilityIndex: 100,
            marketSentiment: 1000,
            lastUpdateTime: block.timestamp
        });
    }

    /**
     * @dev Initialize pricing for a new project
     */
    function initializeProjectPricing(
        uint256 projectId,
        PricingModel model,
        uint256 qualityScore
    ) public onlyRole(ADMIN_ROLE) whenNotPaused validAmount(qualityScore) {
        require(
            qualityScore <= 1000,
            "DynamicPricing: quality score must be <= 1000"
        );
        require(
            projectPricing[projectId].basePrice == 0,
            "DynamicPricing: project already initialized"
        );

        uint256 adjustedBasePrice = calculateQualityAdjustedPrice(
            BASE_PRICE,
            qualityScore
        );

        projectPricing[projectId] = ProjectPricing({
            basePrice: adjustedBasePrice,
            currentPrice: adjustedBasePrice,
            minPrice: MIN_PRICE,
            maxPrice: MAX_PRICE,
            model: model,
            totalVolume: 0,
            lastTradeTime: block.timestamp,
            priceHistory: 0,
            qualityScore: qualityScore,
            demandScore: 500, // Start neutral
            supplyScore: 500 // Start neutral
        });

        if (model == PricingModel.BONDING_CURVE) {
            initializeBondingCurve(projectId);
        }

        emit PricingModelChanged(projectId, PricingModel.FIXED, model);
        emit PriceUpdated(
            projectId,
            0,
            adjustedBasePrice,
            "Project initialized"
        );
    }

    /**
     * @dev Calculate current price for a project based on its pricing model
     */
    function getCurrentPrice(uint256 projectId) public view returns (uint256) {
        ProjectPricing storage pricing = projectPricing[projectId];

        if (pricing.basePrice == 0) {
            return BASE_PRICE; // Fallback to base price
        }

        if (pricing.model == PricingModel.FIXED) {
            return pricing.currentPrice;
        } else if (pricing.model == PricingModel.SUPPLY_DEMAND) {
            // Use stored current price if it has been updated by trades
            // Otherwise fall back to calculated price
            if (pricing.totalVolume > 0) {
                return pricing.currentPrice;
            } else {
                return calculateSupplyDemandPrice(projectId);
            }
        } else if (pricing.model == PricingModel.BONDING_CURVE) {
            return calculateBondingCurvePrice(projectId);
        } else if (pricing.model == PricingModel.QUALITY_ADJUSTED) {
            return
                calculateQualityAdjustedPrice(
                    pricing.basePrice,
                    pricing.qualityScore
                );
        } else if (pricing.model == PricingModel.TWAP) {
            return calculateTWAP(projectId);
        }

        return pricing.currentPrice;
    }

    /**
     * @dev Calculate supply and demand based price
     */
    function calculateSupplyDemandPrice(
        uint256 projectId
    ) public view returns (uint256) {
        ProjectPricing storage pricing = projectPricing[projectId];

        // Get project data
        uint256 totalSupply = companyInstance.getProjectexcAmount(projectId);
        uint256 soldAmount = companyInstance.getEXCSold(projectId);
        uint256 availableSupply = totalSupply > soldAmount
            ? totalSupply - soldAmount
            : 0;

        if (totalSupply == 0) return pricing.basePrice;

        // Calculate supply ratio (0-1000)
        uint256 supplyRatio = (availableSupply * 1000) / totalSupply;

        // Calculate demand pressure (inverse of supply ratio)
        uint256 demandPressure = 1000 - supplyRatio;

        // Apply market conditions
        uint256 adjustedDemand = (demandPressure *
            marketConditions.globalDemandMultiplier) / 1000;
        // Note: adjustedSupply calculation for future use in more complex pricing models

        // Calculate price multiplier (500-2000, representing 50%-200%)
        uint256 priceMultiplier = 500 + (adjustedDemand * 1500) / 1000;

        // Apply quality and time decay
        uint256 qualityMultiplier = 800 + (pricing.qualityScore * 400) / 1000; // 80%-120%
        uint256 timeDecay = calculateTimeDecay(pricing.lastTradeTime);

        uint256 finalPrice = (pricing.basePrice *
            priceMultiplier *
            qualityMultiplier *
            timeDecay) / (1000 * 1000 * 1000);

        // Ensure price is within bounds
        if (finalPrice < pricing.minPrice) return pricing.minPrice;
        if (finalPrice > pricing.maxPrice) return pricing.maxPrice;

        return finalPrice;
    }

    /**
     * @dev Calculate quality-adjusted price
     */
    function calculateQualityAdjustedPrice(
        uint256 basePrice,
        uint256 qualityScore
    ) public pure returns (uint256) {
        // Quality score 0-1000 maps to 50%-150% price multiplier
        uint256 qualityMultiplier = 500 + (qualityScore * 1000) / 1000;
        return (basePrice * qualityMultiplier) / 1000;
    }

    /**
     * @dev Calculate time decay factor for pricing
     */
    function calculateTimeDecay(
        uint256 lastTradeTime
    ) public view returns (uint256) {
        if (lastTradeTime == 0) return 1000;

        uint256 timeSinceLastTrade = block.timestamp - lastTradeTime;

        if (timeSinceLastTrade < HOUR) {
            return 1000; // No decay within an hour
        } else if (timeSinceLastTrade < DAY) {
            // Linear decay from 100% to 95% over 24 hours
            return 1000 - ((timeSinceLastTrade - HOUR) * 50) / (DAY - HOUR);
        } else if (timeSinceLastTrade < WEEK) {
            // Slower decay from 95% to 90% over a week
            return 950 - ((timeSinceLastTrade - DAY) * 50) / (WEEK - DAY);
        } else {
            return 900; // Minimum 90% after a week
        }
    }

    /**
     * @dev Initialize bonding curve for a project
     */
    function initializeBondingCurve(uint256 projectId) internal {
        bondingCurves[projectId] = BondingCurve({
            reserveRatio: 500000, // 50% reserve ratio
            slope: 1000,
            intercept: BASE_PRICE
        });
    }

    /**
     * @dev Calculate bonding curve price
     */
    function calculateBondingCurvePrice(
        uint256 projectId
    ) public view returns (uint256) {
        BondingCurve storage curve = bondingCurves[projectId];
        uint256 soldAmount = companyInstance.getEXCSold(projectId);

        // Bonding curve formula: price = intercept + (slope * soldAmount^2) / 1000000
        uint256 curvePrice = curve.intercept +
            (curve.slope * soldAmount * soldAmount) /
            1000000;

        ProjectPricing storage pricing = projectPricing[projectId];
        if (curvePrice < pricing.minPrice) return pricing.minPrice;
        if (curvePrice > pricing.maxPrice) return pricing.maxPrice;

        return curvePrice;
    }

    /**
     * @dev Calculate Time-Weighted Average Price (TWAP)
     */
    function calculateTWAP(uint256 projectId) public view returns (uint256) {
        // Simplified TWAP calculation using recent price history
        ProjectPricing storage pricing = projectPricing[projectId];

        // For now, return current price with slight smoothing
        // In a full implementation, this would use detailed price history
        uint256 currentMarketPrice = calculateSupplyDemandPrice(projectId);
        uint256 smoothedPrice = (pricing.currentPrice *
            7 +
            currentMarketPrice *
            3) / 10;

        return smoothedPrice;
    }

    /**
     * @dev Update price after a trade
     */
    function updatePriceAfterTrade(
        uint256 projectId,
        uint256 tradeAmount,
        bool isBuy
    ) public onlyRole(ADMIN_ROLE) whenNotPaused validAmount(tradeAmount) {
        ProjectPricing storage pricing = projectPricing[projectId];
        require(
            pricing.basePrice > 0,
            "DynamicPricing: project not initialized"
        );

        uint256 oldPrice = pricing.currentPrice;

        // Calculate new price based on supply/demand model
        uint256 newPrice;
        if (pricing.model == PricingModel.SUPPLY_DEMAND) {
            newPrice = calculateSupplyDemandPrice(projectId);
        } else {
            newPrice = getCurrentPrice(projectId);
        }

        // Update pricing data
        pricing.currentPrice = newPrice;
        pricing.totalVolume += tradeAmount;
        pricing.lastTradeTime = block.timestamp;

        // Update demand/supply scores based on trade direction
        if (isBuy) {
            pricing.demandScore = pricing.demandScore < 950
                ? pricing.demandScore + 50
                : 1000;
            pricing.supplyScore = pricing.supplyScore > 50
                ? pricing.supplyScore - 25
                : 0;
        } else {
            pricing.demandScore = pricing.demandScore > 50
                ? pricing.demandScore - 25
                : 0;
            pricing.supplyScore = pricing.supplyScore < 950
                ? pricing.supplyScore + 50
                : 1000;
        }

        // Store price in history
        uint256 currentDay = block.timestamp / DAY;
        priceHistoryDetailed[projectId][currentDay] = newPrice;
        dailyVolume[currentDay] += tradeAmount;

        // Check for volatility alert
        if (oldPrice > 0) {
            uint256 priceChange = oldPrice > newPrice
                ? oldPrice - newPrice
                : newPrice - oldPrice;
            uint256 volatilityPercentage = (priceChange * 1000) / oldPrice;

            if (volatilityPercentage > 100) {
                // More than 10% change
                emit VolatilityAlert(projectId, volatilityPercentage);
            }
        }

        emit PriceUpdated(
            projectId,
            oldPrice,
            newPrice,
            isBuy ? "Buy trade" : "Sell trade"
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
        require(
            demandMultiplier >= 500 && demandMultiplier <= 2000,
            "DynamicPricing: invalid demand multiplier"
        );
        require(
            supplyMultiplier >= 500 && supplyMultiplier <= 2000,
            "DynamicPricing: invalid supply multiplier"
        );
        require(
            volatilityIndex <= MAX_VOLATILITY,
            "DynamicPricing: invalid volatility index"
        );
        require(sentiment <= 2000, "DynamicPricing: invalid sentiment");

        MarketConditions storage conditions = marketConditions;

        emit MarketConditionChanged(
            0,
            conditions.globalDemandMultiplier,
            demandMultiplier
        );
        emit MarketConditionChanged(
            1,
            conditions.globalSupplyMultiplier,
            supplyMultiplier
        );
        emit MarketConditionChanged(
            2,
            conditions.volatilityIndex,
            volatilityIndex
        );
        emit MarketConditionChanged(3, conditions.marketSentiment, sentiment);

        conditions.globalDemandMultiplier = demandMultiplier;
        conditions.globalSupplyMultiplier = supplyMultiplier;
        conditions.volatilityIndex = volatilityIndex;
        conditions.marketSentiment = sentiment;
        conditions.lastUpdateTime = block.timestamp;
    }

    /**
     * @dev Change pricing model for a project
     */
    function changePricingModel(
        uint256 projectId,
        PricingModel newModel
    ) public onlyRole(ADMIN_ROLE) whenNotPaused {
        ProjectPricing storage pricing = projectPricing[projectId];
        require(
            pricing.basePrice > 0,
            "DynamicPricing: project not initialized"
        );

        PricingModel oldModel = pricing.model;
        pricing.model = newModel;

        if (
            newModel == PricingModel.BONDING_CURVE &&
            oldModel != PricingModel.BONDING_CURVE
        ) {
            initializeBondingCurve(projectId);
        }

        // Update current price based on new model
        uint256 newPrice = getCurrentPrice(projectId);
        uint256 oldPrice = pricing.currentPrice;
        pricing.currentPrice = newPrice;

        emit PricingModelChanged(projectId, oldModel, newModel);
        emit PriceUpdated(projectId, oldPrice, newPrice, "Model changed");
    }

    /**
     * @dev Update project quality score
     */
    function updateProjectQuality(
        uint256 projectId,
        uint256 newQualityScore
    ) public onlyRole(ADMIN_ROLE) whenNotPaused validAmount(newQualityScore) {
        require(
            newQualityScore <= 1000,
            "DynamicPricing: quality score must be <= 1000"
        );

        ProjectPricing storage pricing = projectPricing[projectId];
        require(
            pricing.basePrice > 0,
            "DynamicPricing: project not initialized"
        );

        pricing.qualityScore = newQualityScore;

        // Recalculate price if using quality-adjusted model
        if (pricing.model == PricingModel.QUALITY_ADJUSTED) {
            uint256 oldPrice = pricing.currentPrice;
            uint256 newPrice = calculateQualityAdjustedPrice(
                pricing.basePrice,
                newQualityScore
            );
            pricing.currentPrice = newPrice;

            emit PriceUpdated(projectId, oldPrice, newPrice, "Quality updated");
        }
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
            PricingModel model,
            uint256 totalVolume,
            uint256 qualityScore,
            uint256 demandScore,
            uint256 supplyScore
        )
    {
        ProjectPricing storage pricing = projectPricing[projectId];

        return (
            getCurrentPrice(projectId),
            pricing.basePrice,
            pricing.minPrice,
            pricing.maxPrice,
            pricing.model,
            pricing.totalVolume,
            pricing.qualityScore,
            pricing.demandScore,
            pricing.supplyScore
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
        MarketConditions storage conditions = marketConditions;
        return (
            conditions.globalDemandMultiplier,
            conditions.globalSupplyMultiplier,
            conditions.volatilityIndex,
            conditions.marketSentiment,
            conditions.lastUpdateTime
        );
    }

    /**
     * @dev Calculate price impact for a potential trade
     */
    function calculatePriceImpact(
        uint256 projectId,
        uint256 tradeAmount,
        bool isBuy
    ) public view returns (uint256 priceImpact, uint256 newPrice) {
        uint256 currentPrice = getCurrentPrice(projectId);

        // Simulate the trade impact
        uint256 totalSupply = companyInstance.getProjectexcAmount(projectId);
        uint256 soldAmount = companyInstance.getEXCSold(projectId);

        if (totalSupply == 0) return (0, currentPrice);

        uint256 impactPercentage;
        if (isBuy) {
            // Buying increases price
            impactPercentage =
                (tradeAmount * 1000) /
                (totalSupply - soldAmount + 1);
        } else {
            // Selling decreases price
            impactPercentage = (tradeAmount * 1000) / (soldAmount + 1);
        }

        // Cap impact at 50%
        if (impactPercentage > 500) impactPercentage = 500;

        if (isBuy) {
            newPrice = currentPrice + (currentPrice * impactPercentage) / 1000;
        } else {
            newPrice = currentPrice - (currentPrice * impactPercentage) / 1000;
        }

        // Ensure within bounds
        ProjectPricing storage pricing = projectPricing[projectId];
        if (newPrice < pricing.minPrice) newPrice = pricing.minPrice;
        if (newPrice > pricing.maxPrice) newPrice = pricing.maxPrice;

        priceImpact = newPrice > currentPrice
            ? newPrice - currentPrice
            : currentPrice - newPrice;

        return (priceImpact, newPrice);
    }

    /**
     * @dev Get price history for a project
     */
    function getPriceHistory(
        uint256 projectId,
        uint256 numDays
    )
        public
        view
        returns (uint256[] memory prices, uint256[] memory timestamps)
    {
        prices = new uint256[](numDays);
        timestamps = new uint256[](numDays);

        uint256 currentDay = block.timestamp / DAY;

        for (uint256 i = 0; i < numDays; i++) {
            uint256 day = currentDay - i;
            prices[i] = priceHistoryDetailed[projectId][day];
            timestamps[i] = day * DAY;
        }

        return (prices, timestamps);
    }
}
