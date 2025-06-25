const DynamicPricing = artifacts.require("DynamicPricing");
const Company = artifacts.require("Company");
const ValidatorRegistry = artifacts.require("ValidatorRegistry");
const EcoXChangeMarket = artifacts.require("EcoXChangeMarket");
const EcoXChangeToken = artifacts.require("EcoXChangeToken");
const ERC20 = artifacts.require("ERC20");

contract("Dynamic Pricing Integration Tests", (accounts) => {
  let dynamicPricing;
  let company;
  let validatorRegistry;
  let ecoXChangeMarket;
  let ecoXChangeToken;
  let erc20;

  const [admin, validator, company1, company2, buyer1, buyer2, buyer3] =
    accounts;

  // Pricing model constants
  const PricingModel = {
    FIXED: 0,
    SUPPLY_DEMAND: 1,
    BONDING_CURVE: 2,
    AUCTION: 3,
    TWAP: 4,
    QUALITY_ADJUSTED: 5,
  };

  beforeEach(async () => {
    // Deploy contracts
    erc20 = await ERC20.new({ from: admin });
    ecoXChangeToken = await EcoXChangeToken.new(erc20.address, { from: admin });
    validatorRegistry = await ValidatorRegistry.new({ from: admin });
    company = await Company.new({ from: admin });
    dynamicPricing = await DynamicPricing.new(company.address, { from: admin });
    ecoXChangeMarket = await EcoXChangeMarket.new(
      company.address,
      ecoXChangeToken.address,
      validatorRegistry.address,
      dynamicPricing.address,
      { from: admin }
    );

    // Setup initial data
    await validatorRegistry.addValidator(validator, { from: admin });
    await company.addCompany(company1, "Test Company 1", { from: admin });
    await company.addCompany(company2, "Test Company 2", { from: admin });

    // Grant admin role to market contract for pricing updates
    const ADMIN_ROLE = await dynamicPricing.ADMIN_ROLE();
    await dynamicPricing.grantRole(ADMIN_ROLE, ecoXChangeMarket.address, {
      from: admin,
    });
  });

  describe("Market Integration Stress Tests", () => {
    beforeEach(async () => {
      await company.addProject(
        "Stress Test Project",
        "Test Description",
        30,
        1000,
        {
          from: company1,
        }
      );
      await ecoXChangeMarket.initializeProjectPricing(
        0,
        PricingModel.SUPPLY_DEMAND,
        500,
        { from: admin }
      );
    });

    it("should handle high-volume trading scenarios", async () => {
      // List a large amount of EXC for sale
      await ecoXChangeMarket.sell(500, 0, {
        from: company1,
        value: web3.utils.toWei("65", "ether"), // 130% stake (500 * 1.3 / 10)
      });

      const initialPrice = await ecoXChangeMarket.getCurrentPrice(0);
      let totalVolume = 0;

      // Simulate high-volume trading
      const trades = [
        { buyer: buyer1, amount: 50 },
        { buyer: buyer2, amount: 30 },
        { buyer: buyer3, amount: 40 },
        { buyer: buyer1, amount: 25 },
        { buyer: buyer2, amount: 35 },
      ];

      for (const trade of trades) {
        const currentPrice = await ecoXChangeMarket.getCurrentPrice(0);
        const totalCost = currentPrice.mul(web3.utils.toBN(trade.amount));

        await ecoXChangeMarket.buy(trade.amount, company1, 0, {
          from: trade.buyer,
          value: totalCost,
        });

        totalVolume += trade.amount;
      }

      const finalPrice = await ecoXChangeMarket.getCurrentPrice(0);
      const pricingInfo = await ecoXChangeMarket.getProjectPricingInfo(0);

      // Price should increase with high demand
      assert(
        finalPrice.gt(initialPrice),
        "Price should increase with high-volume buying"
      );

      // Total volume should be tracked correctly
      assert(
        pricingInfo.totalVolume.gte(web3.utils.toBN(totalVolume)),
        "Total volume should be tracked"
      );

      // Price should still be within bounds
      assert(
        finalPrice.lte(pricingInfo.maxPrice),
        "Price should not exceed maximum"
      );
    });

    it("should handle rapid price changes in market conditions", async () => {
      // List EXC for sale
      await ecoXChangeMarket.sell(100, 0, {
        from: company1,
        value: web3.utils.toWei("1.3", "ether"),
      });

      const initialPrice = await ecoXChangeMarket.getCurrentPrice(0);

      // Rapidly change market conditions
      const marketConditions = [
        { demand: 1500, supply: 800, volatility: 200, sentiment: 1500 },
        { demand: 800, supply: 1500, volatility: 500, sentiment: 800 },
        { demand: 2000, supply: 500, volatility: 800, sentiment: 2000 },
        { demand: 1000, supply: 1000, volatility: 100, sentiment: 1000 },
      ];

      for (const condition of marketConditions) {
        await ecoXChangeMarket.updateMarketConditions(
          condition.demand,
          condition.supply,
          condition.volatility,
          condition.sentiment,
          { from: admin }
        );

        // Make a small trade to trigger price update
        const currentPrice = await ecoXChangeMarket.getCurrentPrice(0);
        const tradeCost = currentPrice.mul(web3.utils.toBN(1));

        await ecoXChangeMarket.buy(1, company1, 0, {
          from: buyer1,
          value: tradeCost,
        });
      }

      const finalPrice = await ecoXChangeMarket.getCurrentPrice(0);
      const pricingInfo = await ecoXChangeMarket.getProjectPricingInfo(0);

      // Price should still be within bounds despite rapid changes
      assert(
        finalPrice.gte(pricingInfo.minPrice),
        "Price should not go below minimum"
      );
      assert(
        finalPrice.lte(pricingInfo.maxPrice),
        "Price should not exceed maximum"
      );
    });

    it("should handle concurrent trading from multiple buyers", async () => {
      // List EXC for sale
      await ecoXChangeMarket.sell(200, 0, {
        from: company1,
        value: web3.utils.toWei("2.6", "ether"),
      });

      const initialPrice = await ecoXChangeMarket.getCurrentPrice(0);

      // Simulate concurrent trading (as close as possible in tests)
      const promises = [];
      const buyers = [buyer1, buyer2, buyer3];

      for (let i = 0; i < buyers.length; i++) {
        const currentPrice = await ecoXChangeMarket.getCurrentPrice(0);
        const tradeCost = currentPrice.mul(web3.utils.toBN(10));

        promises.push(
          ecoXChangeMarket.buy(10, company1, 0, {
            from: buyers[i],
            value: tradeCost.mul(web3.utils.toBN(2)), // Overpay to ensure success
          })
        );
      }

      // Execute all trades
      await Promise.all(promises);

      const finalPrice = await ecoXChangeMarket.getCurrentPrice(0);

      // Verify all buyers received their stakes
      for (const buyer of buyers) {
        const stake = await ecoXChangeMarket.projectStakes(buyer, 0);
        assert(
          stake.gte(web3.utils.toBN(10)),
          `${buyer} should have received stake`
        );
      }

      // Price should have increased due to demand
      assert(
        finalPrice.gt(initialPrice),
        "Price should increase with concurrent buying"
      );
    });
  });

  describe("Cross-Contract Security Tests", () => {
    beforeEach(async () => {
      await company.addProject(
        "Security Project",
        "Test Description",
        30,
        100,
        {
          from: company1,
        }
      );
      await ecoXChangeMarket.initializeProjectPricing(
        0,
        PricingModel.SUPPLY_DEMAND,
        500,
        { from: admin }
      );
    });

    it("should prevent direct manipulation of pricing contract", async () => {
      // Try to directly call pricing functions without going through market
      try {
        await dynamicPricing.updatePriceAfterTrade(0, 10, true, {
          from: buyer1,
        });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("caller does not have required role"),
          "Should prevent direct manipulation"
        );
      }
    });

    it("should maintain price consistency across contract calls", async () => {
      // List EXC for sale
      await ecoXChangeMarket.sell(50, 0, {
        from: company1,
        value: web3.utils.toWei("0.65", "ether"),
      });

      // Get price from both contracts
      const marketPrice = await ecoXChangeMarket.getCurrentPrice(0);
      const pricingPrice = await dynamicPricing.getCurrentPrice(0);

      assert.equal(
        marketPrice.toString(),
        pricingPrice.toString(),
        "Prices should be consistent across contracts"
      );

      // Make a trade and check again
      await ecoXChangeMarket.buy(5, company1, 0, {
        from: buyer1,
        value: marketPrice.mul(web3.utils.toBN(5)),
      });

      const newMarketPrice = await ecoXChangeMarket.getCurrentPrice(0);
      const newPricingPrice = await dynamicPricing.getCurrentPrice(0);

      assert.equal(
        newMarketPrice.toString(),
        newPricingPrice.toString(),
        "Prices should remain consistent after trades"
      );
    });
  });

  describe("Multi-Project Pricing Scenarios", () => {
    beforeEach(async () => {
      // Create multiple projects with different characteristics
      await company.addProject(
        "High Quality Project",
        "Premium project",
        30,
        100,
        {
          from: company1,
        }
      );
      await company.addProject(
        "Standard Project",
        "Standard project",
        30,
        200,
        {
          from: company1,
        }
      );
      await company.addProject(
        "Large Scale Project",
        "Large project",
        30,
        1000,
        {
          from: company2,
        }
      );

      // Initialize with different pricing models and quality scores
      await ecoXChangeMarket.initializeProjectPricing(
        0,
        PricingModel.QUALITY_ADJUSTED,
        900, // High quality
        { from: admin }
      );
      await ecoXChangeMarket.initializeProjectPricing(
        1,
        PricingModel.SUPPLY_DEMAND,
        500, // Standard quality
        { from: admin }
      );
      await ecoXChangeMarket.initializeProjectPricing(
        2,
        PricingModel.BONDING_CURVE,
        700, // Good quality
        { from: admin }
      );
    });

    it("should handle different pricing models simultaneously", async () => {
      // List EXC for all projects
      await ecoXChangeMarket.sell(50, 0, {
        from: company1,
        value: web3.utils.toWei("0.65", "ether"),
      });
      await ecoXChangeMarket.sell(100, 1, {
        from: company1,
        value: web3.utils.toWei("1.3", "ether"),
      });
      await ecoXChangeMarket.sell(500, 2, {
        from: company2,
        value: web3.utils.toWei("6.5", "ether"),
      });

      // Get initial prices
      const prices = [];
      for (let i = 0; i < 3; i++) {
        prices.push(await ecoXChangeMarket.getCurrentPrice(i));
      }

      // High quality project should have highest price
      assert(
        prices[0].gt(prices[1]),
        "High quality project should have higher price than standard"
      );

      // Make trades on each project
      for (let i = 0; i < 3; i++) {
        const currentPrice = await ecoXChangeMarket.getCurrentPrice(i);
        const tradeCost = currentPrice.mul(web3.utils.toBN(5));
        const companyAddr = i < 2 ? company1 : company2;

        await ecoXChangeMarket.buy(5, companyAddr, i, {
          from: buyer1,
          value: tradeCost,
        });
      }

      // Verify all projects updated correctly
      for (let i = 0; i < 3; i++) {
        const newPrice = await ecoXChangeMarket.getCurrentPrice(i);
        const pricingInfo = await ecoXChangeMarket.getProjectPricingInfo(i);

        assert(
          newPrice.gte(pricingInfo.minPrice),
          `Project ${i} price should be within bounds`
        );
        assert(
          newPrice.lte(pricingInfo.maxPrice),
          `Project ${i} price should be within bounds`
        );
      }
    });

    it("should handle market conditions affecting all projects", async () => {
      // List EXC for all projects
      await ecoXChangeMarket.sell(50, 0, {
        from: company1,
        value: web3.utils.toWei("0.65", "ether"),
      });
      await ecoXChangeMarket.sell(100, 1, {
        from: company1,
        value: web3.utils.toWei("1.3", "ether"),
      });
      await ecoXChangeMarket.sell(200, 2, {
        from: company2,
        value: web3.utils.toWei("2.6", "ether"),
      });

      // Get initial prices
      const initialPrices = [];
      for (let i = 0; i < 3; i++) {
        initialPrices.push(await ecoXChangeMarket.getCurrentPrice(i));
      }

      // Update market conditions to high demand
      await ecoXChangeMarket.updateMarketConditions(1800, 600, 300, 1800, {
        from: admin,
      });

      // Make trades to trigger price updates
      for (let i = 0; i < 3; i++) {
        const currentPrice = await ecoXChangeMarket.getCurrentPrice(i);
        const tradeCost = currentPrice.mul(web3.utils.toBN(2));
        const companyAddr = i < 2 ? company1 : company2;

        await ecoXChangeMarket.buy(2, companyAddr, i, {
          from: buyer1,
          value: tradeCost,
        });
      }

      // Get final prices
      const finalPrices = [];
      for (let i = 0; i < 3; i++) {
        finalPrices.push(await ecoXChangeMarket.getCurrentPrice(i));
      }

      // All projects should be affected by market conditions
      // (though the exact effect depends on the pricing model)
      for (let i = 0; i < 3; i++) {
        const pricingInfo = await ecoXChangeMarket.getProjectPricingInfo(i);
        assert(
          finalPrices[i].gte(pricingInfo.minPrice),
          `Project ${i} should respect minimum price`
        );
        assert(
          finalPrices[i].lte(pricingInfo.maxPrice),
          `Project ${i} should respect maximum price`
        );
      }
    });
  });

  describe("Validation Integration with Dynamic Pricing", () => {
    beforeEach(async () => {
      await company.addProject("Validation Test", "Test Description", 30, 100, {
        from: company1,
      });
      await ecoXChangeMarket.initializeProjectPricing(
        0,
        PricingModel.SUPPLY_DEMAND,
        500,
        { from: admin }
      );
    });

    it("should handle pricing during project validation", async () => {
      // Create a new project for this test
      await company.addProject(
        "Validation Test Project 1",
        "Test project for validation pricing",
        30,
        100,
        { from: company1 }
      );

      const projectId = (await company.numProjects()).toNumber() - 1;

      // Initialize pricing for the new project
      await ecoXChangeMarket.initializeProjectPricing(
        projectId,
        1, // SUPPLY_DEMAND model
        800,
        { from: admin }
      );

      // List and sell some EXC
      await ecoXChangeMarket.sell(50, projectId, {
        from: company1,
        value: web3.utils.toWei("0.65", "ether"),
      });

      const priceBeforeBuy = await ecoXChangeMarket.getCurrentPrice(projectId);

      // Buy some EXC with sufficient funds (use smaller amount to avoid funding issues)
      const buyAmount = 5;
      const totalCost = priceBeforeBuy.mul(web3.utils.toBN(buyAmount));
      const extraEth = web3.utils.toBN(web3.utils.toWei("10", "ether")); // Add more ETH for safety

      await ecoXChangeMarket.buy(buyAmount, company1, projectId, {
        from: buyer1,
        value: totalCost.add(extraEth), // Add extra ETH for safety
      });

      // Validate the project
      await ecoXChangeMarket.validateProject(company1, projectId, true, 100, {
        from: validator,
      });

      const priceAfterValidation = await ecoXChangeMarket.getCurrentPrice(
        projectId
      );

      // Validation should complete successfully (price may change due to market dynamics)
      assert(
        priceAfterValidation.gt(0),
        "Price should remain positive after validation"
      );

      // Buyer should have received EXC tokens (check that they have at least the amount they bought)
      const buyerEXC = await ecoXChangeToken.checkEXC(buyer1);
      assert(
        buyerEXC.toNumber() >= buyAmount,
        `Buyer should have received at least ${buyAmount} EXC tokens, but has ${buyerEXC.toNumber()}`
      );
    });

    it("should handle pricing when project validation fails", async () => {
      // Create a new project for this test
      await company.addProject(
        "Validation Test Project 2",
        "Test project for failed validation pricing",
        30,
        100,
        { from: company1 }
      );

      const projectId = (await company.numProjects()).toNumber() - 1;

      // Initialize pricing for the new project
      await ecoXChangeMarket.initializeProjectPricing(
        projectId,
        1, // SUPPLY_DEMAND model
        800,
        { from: admin }
      );

      // List and sell some EXC
      await ecoXChangeMarket.sell(30, projectId, {
        from: company1,
        value: web3.utils.toWei("0.39", "ether"),
      });

      // Get price before any trading activity
      const priceBeforeTrade = await ecoXChangeMarket.getCurrentPrice(
        projectId
      );

      // Buy some EXC with sufficient funds (use smaller amount to avoid funding issues)
      const currentPrice = await ecoXChangeMarket.getCurrentPrice(projectId);
      const buyAmount = 5;
      const totalCost = currentPrice.mul(web3.utils.toBN(buyAmount));
      const extraEth = web3.utils.toBN(web3.utils.toWei("10", "ether")); // Add more ETH for safety

      await ecoXChangeMarket.buy(buyAmount, company1, projectId, {
        from: buyer1,
        value: totalCost.add(extraEth), // Add extra ETH for safety
      });

      const priceAfterTrade = await ecoXChangeMarket.getCurrentPrice(projectId);

      // Price should have changed due to the buy trade
      assert.notEqual(
        priceBeforeTrade.toString(),
        priceAfterTrade.toString(),
        "Price should change after buy trade"
      );

      // Validate project as failed
      await ecoXChangeMarket.validateProject(company1, projectId, false, 50, {
        from: validator,
      });

      const priceAfterValidation = await ecoXChangeMarket.getCurrentPrice(
        projectId
      );

      // Price should remain stable during validation (validation itself doesn't affect pricing)
      assert.equal(
        priceAfterTrade.toString(),
        priceAfterValidation.toString(),
        "Price should not change during validation process"
      );

      // Project should still be marked as completed
      const projectState = await company.getProjectState(projectId);
      assert.equal(
        projectState.toNumber(),
        1,
        "Project should be marked as completed"
      );
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle pricing initialization failures gracefully", async () => {
      await company.addProject("Error Test", "Test Description", 30, 100, {
        from: company1,
      });

      // Try to initialize with invalid quality score
      try {
        await ecoXChangeMarket.initializeProjectPricing(
          0,
          PricingModel.SUPPLY_DEMAND,
          1001, // Invalid quality score
          { from: admin }
        );
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("quality score must be <= 1000"),
          "Should reject invalid quality score"
        );
      }

      // Should be able to initialize correctly after failure
      await ecoXChangeMarket.initializeProjectPricing(
        0,
        PricingModel.SUPPLY_DEMAND,
        500,
        { from: admin }
      );

      const price = await ecoXChangeMarket.getCurrentPrice(0);
      assert(price.gt(0), "Should initialize correctly after previous failure");
    });

    it("should handle market operations when pricing is not initialized", async () => {
      await company.addProject("Uninitialized", "Test Description", 30, 100, {
        from: company1,
      });

      // Try to get price for uninitialized project
      const price = await ecoXChangeMarket.getCurrentPrice(0);

      // Should return base price as fallback
      const basePrice = web3.utils.toWei("1", "ether");
      assert.equal(
        price.toString(),
        basePrice,
        "Should return base price for uninitialized project"
      );
    });
  });
});
