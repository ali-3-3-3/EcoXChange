const EcoXChangeMarket = artifacts.require("EcoXChangeMarket");
const Company = artifacts.require("Company");
const ValidatorRegistry = artifacts.require("ValidatorRegistry");
const EcoXChangeToken = artifacts.require("EcoXChangeToken"); // Make sure this line is here
const ERC20 = artifacts.require("ERC20");
const DynamicPricing = artifacts.require("DynamicPricing");

contract("EcoXChangeMarket", function (accounts) {
  let companyInstance;
  let validatorRegistryInstance;
  let ecoXChangeMarketInstance;
  let ecoXChangeTokenInstance; // Declare the token instance variable
  let erc20Instance;
  let dynamicPricingInstance;

  const [admin, validator, companyAddress, buyer1, buyer2] = accounts;

  beforeEach(async () => {
    companyInstance = await Company.deployed();
    validatorRegistryInstance = await ValidatorRegistry.deployed();
    ecoXChangeMarketInstance = await EcoXChangeMarket.deployed();
    ecoXChangeTokenInstance = await EcoXChangeToken.deployed(); // Deploy the token instance
    erc20Instance = await ERC20.deployed();
    dynamicPricingInstance = await DynamicPricing.deployed();

    // Grant admin role to admin account for pricing initialization
    const ADMIN_ROLE = await ecoXChangeMarketInstance.ADMIN_ROLE();
    const hasAdminRole = await ecoXChangeMarketInstance.hasRole(
      ADMIN_ROLE,
      admin
    );
    if (!hasAdminRole) {
      await ecoXChangeMarketInstance.grantRole(ADMIN_ROLE, admin, {
        from: admin,
      });
    }

    // Register validator only if not already registered
    const isValidatorRegistered = await validatorRegistryInstance.validators(
      validator
    );
    if (!isValidatorRegistered) {
      await validatorRegistryInstance.addValidator(validator, {
        from: admin,
      });
    }

    // Add company only if not already registered
    const isCompanyRegistered = await companyInstance.registeredCompanies(
      companyAddress
    );
    if (!isCompanyRegistered) {
      await companyInstance.addCompany(companyAddress, "Test Company", {
        from: admin,
      });
    }

    // Grant ADMIN_ROLE to market contract in DynamicPricing for price updates
    const PRICING_ADMIN_ROLE = await dynamicPricingInstance.ADMIN_ROLE();
    const marketHasPricingRole = await dynamicPricingInstance.hasRole(
      PRICING_ADMIN_ROLE,
      ecoXChangeMarketInstance.address
    );
    if (!marketHasPricingRole) {
      await dynamicPricingInstance.grantRole(
        PRICING_ADMIN_ROLE,
        ecoXChangeMarketInstance.address,
        { from: admin }
      );
    }
  });

  it("should allow a company to create a project", async () => {
    // Create a project
    const projectName = "Test Project";
    const desc = "Test Description";
    const tonCO2Saved = 10;
    const daystillCompletion = 30;

    await companyInstance.addProject(
      projectName,
      desc,
      daystillCompletion,
      tonCO2Saved,
      { from: companyAddress }
    );

    // Check if project was created by verifying the project exists
    const companyProjectIds = await companyInstance.companyProjects(
      companyAddress,
      0
    );
    assert.equal(
      companyProjectIds.toNumber(),
      0,
      "First project ID should be 0"
    );

    // Check project details
    const project = await companyInstance.projects(0);
    assert.equal(
      project.companyAddress,
      companyAddress,
      "Project company address should match"
    );
    assert.equal(project.projectName, projectName, "Project name should match");
    assert.equal(project.desc, desc, "Project description should match");
    assert.equal(
      project.excAmount.toNumber(),
      tonCO2Saved,
      "Project EXC amount should match"
    );
    assert.equal(
      project.daystillCompletion.toNumber(),
      daystillCompletion,
      "Project days till completion should match"
    );
  });

  it("should allow a company to sell EXC", async () => {
    // Create a project
    const projectName = "Test Project";
    const desc = "Test Description";
    const tonCO2Saved = 10;
    const daystillCompletion = 30;

    await companyInstance.addProject(
      projectName,
      desc,
      daystillCompletion,
      tonCO2Saved,
      { from: companyAddress }
    );

    // Initialize pricing for the project
    const projectId = (await companyInstance.numProjects()).toNumber() - 1;
    await ecoXChangeMarketInstance.initializeProjectPricing(
      projectId,
      1, // SUPPLY_DEMAND model
      500, // quality score
      { from: admin }
    );

    // Initialize pricing for the project
    await ecoXChangeMarketInstance.initializeProjectPricing(0, 1, 500, {
      from: admin,
    });

    // Sell EXC
    await ecoXChangeMarketInstance.sell(3, 0, {
      from: companyAddress,
      value: web3.utils.toWei("3.9", "ether"),
    });

    // Check if EXC was listed
    const excListed = await companyInstance.projects(0);
    assert.equal(
      excListed.excListed.toNumber(),
      3,
      "Project EXC listed should be 3"
    );

    // Check if project was added to company projects
    const project = await ecoXChangeMarketInstance.companyProjects(
      companyAddress,
      0
    );
    assert.equal(project.toNumber(), 0, "Project ID should be 0");
  });

  it("should allow a buyer to buy EXC", async () => {
    // Create a project
    const projectName = "Test Project";
    const desc = "Test Description";
    const tonCO2Saved = 10;
    const daystillCompletion = 30;

    await companyInstance.addProject(
      projectName,
      desc,
      daystillCompletion,
      tonCO2Saved,
      { from: companyAddress }
    );

    // Initialize pricing for the project
    const projectId = (await companyInstance.numProjects()).toNumber() - 1;
    await ecoXChangeMarketInstance.initializeProjectPricing(
      projectId,
      1, // SUPPLY_DEMAND model
      500, // quality score
      { from: admin }
    );

    // Sell EXC
    await ecoXChangeMarketInstance.sell(3, 0, {
      from: companyAddress,
      value: web3.utils.toWei("3.9", "ether"),
    });

    // Buy EXC
    let buy1 = await ecoXChangeMarketInstance.buy(1, companyAddress, 0, {
      from: buyer1,
      value: web3.utils.toWei("1", "ether"),
    });

    // Check if EXC was sold
    const excSold = await companyInstance.projects(0);
    assert.equal(excSold.excSold.toNumber(), 1, "Project EXC sold should be 1");

    // Check if buyer was added to project buyers
    const buyersAddresses = await ecoXChangeMarketInstance.getProjectBuyers(0);
    assert.equal(
      buyersAddresses[0],
      buyer1,
      "Buyer address should be added to project buyers"
    );
  });

  it("should allow a validator to validate a project", async () => {
    // Create a project
    const projectName = "Test Project";
    const desc = "Test Description";
    const tonCO2Saved = 10;
    const daystillCompletion = 30;

    // Get current project count to determine the next project ID
    const currentProjectCount = await companyInstance.numProjects();
    const projectId = currentProjectCount.toNumber();

    await companyInstance.addProject(
      projectName,
      desc,
      daystillCompletion,
      tonCO2Saved,
      { from: companyAddress }
    );

    // Initialize pricing for the project
    await ecoXChangeMarketInstance.initializeProjectPricing(projectId, 1, 500, {
      from: admin,
    });

    // Sell EXC
    await ecoXChangeMarketInstance.sell(3, projectId, {
      from: companyAddress,
      value: web3.utils.toWei("3.9", "ether"),
    });

    // Buy EXC
    let buy1 = await ecoXChangeMarketInstance.buy(
      1,
      companyAddress,
      projectId,
      {
        from: buyer1,
        value: web3.utils.toWei("1", "ether"),
      }
    );

    // Get buyer's initial EXC balance
    const buyerData = async (buyer) => {
      return {
        buyer,
        initialEXC: await ecoXChangeTokenInstance.checkEXC(buyer),
      };
    };

    const buyerBefore = await buyerData(buyer1);

    // Validate project
    let validate = await ecoXChangeMarketInstance.validateProject(
      companyAddress,
      projectId,
      true,
      tonCO2Saved, // Use the actual project EXC amount
      { from: validator }
    );

    // Check if project state was updated
    const projectState = await companyInstance.getProjectState(projectId);
    assert.equal(
      projectState.toNumber(),
      1,
      "Project state should be completed"
    );

    // Check if buyer received EXC
    const newEXC = await ecoXChangeTokenInstance.checkEXC(buyer1);
    assert.equal(
      newEXC.toNumber(),
      buyerBefore.initialEXC.toNumber() + 1,
      "Buyer should have received 1 EXC"
    );
  });

  it("should handle penalty for invalid project", async () => {
    // Create a project
    const projectName = "Test Project";
    const desc = "Test Description";
    const tonCO2Saved = 10;
    const daystillCompletion = 30;

    // Get current project count to determine the next project ID
    const currentProjectCount = await companyInstance.numProjects();
    const projectId = currentProjectCount.toNumber();

    await companyInstance.addProject(
      projectName,
      desc,
      daystillCompletion,
      tonCO2Saved,
      { from: companyAddress }
    );

    // Initialize pricing for the project
    await ecoXChangeMarketInstance.initializeProjectPricing(projectId, 1, 500, {
      from: admin,
    });

    // Sell EXC
    await ecoXChangeMarketInstance.sell(3, projectId, {
      from: companyAddress,
      value: web3.utils.toWei("3.9", "ether"),
    });

    // Buy EXC
    await ecoXChangeMarketInstance.buy(1, companyAddress, projectId, {
      from: buyer1,
      value: web3.utils.toWei("1", "ether"),
    });

    // Validate project as invalid
    let validate = await ecoXChangeMarketInstance.validateProject(
      companyAddress,
      projectId,
      false,
      tonCO2Saved, // Use the same actualEXC as the project's capacity
      { from: validator }
    );

    // Check if project state was updated
    const projectState = await companyInstance.getProjectState(projectId);
    assert.equal(
      projectState.toNumber(),
      1,
      "Project state should be completed"
    );
  });

  it("should prevent non-validator from validating project", async () => {
    // Create a project
    const projectName = "Test Project";
    const desc = "Test Description";
    const tonCO2Saved = 10;
    const daystillCompletion = 30;

    await companyInstance.addProject(
      projectName,
      desc,
      daystillCompletion,
      tonCO2Saved,
      { from: companyAddress }
    );

    try {
      await ecoXChangeMarketInstance.validateProject(
        companyAddress,
        0,
        true,
        3,
        { from: admin }
      );
      assert.fail("Should have thrown an error");
    } catch (error) {
      assert(
        error.message.includes("caller is not an active validator"),
        "Error message should contain validator error"
      );
    }
  });

  it("should handle project validation with multiple buyers", async () => {
    // Create a project
    const projectId = 1;
    const projectName = "Test Project 2";
    const desc = "Test Description 2";
    const tonCO2Saved = 10;
    const daystillCompletion = 30;
    const listedEXC = 5;
    const soldEXC = 3;

    await companyInstance.addProject(
      projectName,
      desc,
      daystillCompletion,
      tonCO2Saved,
      { from: companyAddress }
    );

    // Get the actual project ID that was just created
    const actualProjectId =
      (await companyInstance.numProjects()).toNumber() - 1;

    // Initialize pricing for the project
    await ecoXChangeMarketInstance.initializeProjectPricing(
      actualProjectId,
      1,
      500,
      {
        from: admin,
      }
    );

    // Sell EXC
    await ecoXChangeMarketInstance.sell(listedEXC, actualProjectId, {
      from: companyAddress,
      value: web3.utils.toWei((listedEXC * 1.3).toString(), "ether"),
    });

    // Buy EXC
    await ecoXChangeMarketInstance.buy(
      soldEXC,
      companyAddress,
      actualProjectId,
      {
        from: buyer1,
        value: web3.utils.toWei(soldEXC.toString(), "ether"),
      }
    );

    // Validate project
    let validate = await ecoXChangeMarketInstance.validateProject(
      companyAddress,
      actualProjectId,
      true,
      tonCO2Saved,
      { from: validator }
    );

    // Check if project state was updated
    const projectState = await companyInstance.getProjectState(actualProjectId);
    assert.equal(
      projectState.toNumber(),
      1,
      "Project state should be completed"
    );
  });
});
