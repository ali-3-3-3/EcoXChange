const _deploy_contracts = require("../migrations/5_deploy_contracts");

var EcoXChangeMarket = artifacts.require("EcoXChangeMarket");
var Company = artifacts.require("Company");
var ValidatorRegistry = artifacts.require("ValidatorRegistry");
var EcoXChangeToken = artifacts.require("EcoXChangeToken");
var DynamicPricing = artifacts.require("DynamicPricing");

contract("EcoXChangeMarket for Completed Projects", function (accounts) {
  let companyInstance = null;
  const owner = accounts[0]; // contract owner
  const companyAddress = accounts[1]; // company address

  before(async () => {
    validatorRegistryInstance = await ValidatorRegistry.deployed();
    companyInstance = await Company.deployed();
    ecoXChangeMarketInstance = await EcoXChangeMarket.deployed();
    ecoXChangeTokenInstance = await EcoXChangeToken.deployed();
    dynamicPricingInstance = await DynamicPricing.deployed();

    // Grant admin role to owner for pricing initialization
    // In deployed contracts, the deployer should already have admin role
    const ADMIN_ROLE = await ecoXChangeMarketInstance.ADMIN_ROLE();
    const hasAdminRole = await ecoXChangeMarketInstance.hasRole(
      ADMIN_ROLE,
      owner
    );
    console.log("Owner has ADMIN_ROLE:", hasAdminRole);

    // If owner doesn't have admin role, grant it using the DEFAULT_ADMIN_ROLE
    if (!hasAdminRole) {
      const DEFAULT_ADMIN_ROLE =
        await ecoXChangeMarketInstance.DEFAULT_ADMIN_ROLE();
      const hasDefaultAdminRole = await ecoXChangeMarketInstance.hasRole(
        DEFAULT_ADMIN_ROLE,
        owner
      );
      console.log("Owner has DEFAULT_ADMIN_ROLE:", hasDefaultAdminRole);

      if (hasDefaultAdminRole) {
        await ecoXChangeMarketInstance.grantRole(ADMIN_ROLE, owner, {
          from: owner,
        });
        console.log("Successfully granted ADMIN_ROLE to owner");
      } else {
        console.log(
          "Owner doesn't have DEFAULT_ADMIN_ROLE, cannot grant ADMIN_ROLE"
        );
      }
    }

    // Grant admin role to market contract in DynamicPricing so it can call pricing functions
    const PRICING_ADMIN_ROLE = await dynamicPricingInstance.ADMIN_ROLE();
    const marketHasAdminRole = await dynamicPricingInstance.hasRole(
      PRICING_ADMIN_ROLE,
      ecoXChangeMarketInstance.address
    );
    console.log("Market has ADMIN_ROLE in DynamicPricing:", marketHasAdminRole);

    if (!marketHasAdminRole) {
      await dynamicPricingInstance.grantRole(
        PRICING_ADMIN_ROLE,
        ecoXChangeMarketInstance.address,
        { from: owner }
      );
      console.log(
        "Successfully granted ADMIN_ROLE to market contract in DynamicPricing"
      );
    }
  });
  console.log("Testing EcoXChangeMarket contract");

  it("Should add a company", async () => {
    await companyInstance.addCompany(companyAddress, "Test Company", {
      from: owner,
    });
    const companyInstanceData = await companyInstance.getCompanyName(
      companyAddress
    );
    assert(companyInstanceData === "Test Company");
  });

  it("Should not add a company if not owner", async () => {
    try {
      await companyInstance.addCompany(companyAddress, "Test Company", {
        from: companyAddress,
      });
      assert.fail("Should have thrown an error");
    } catch (e) {
      assert(
        e.message.includes("caller does not have required role"),
        "Should revert with role error"
      );
    }
  });

  it("Should add a project", async () => {
    await companyInstance.addProject(
      "Test Project",
      "Test Description",
      30, // Use valid duration (within 1-365 days range)
      3,
      { from: companyAddress }
    );
    const projectData = await companyInstance.projects(0);
    assert(projectData.projectName === "Test Project");
    assert(projectData.excAmount.toNumber() === 3);
  });

  it("Selling EXC from Completed Project", async () => {
    // Initialize pricing for the project first (before setting it as completed)
    await ecoXChangeMarketInstance.initializeProjectPricing(0, 1, 500, {
      from: owner,
    });

    await companyInstance.setProjectStateComplete(0); // set project to be completed
    await ecoXChangeTokenInstance.getEXC(companyAddress, 3); // give 3 EXC to the company (since its a completed project)
    let initialSellerEXC = await ecoXChangeTokenInstance.checkEXC(
      companyAddress
    );
    assert(initialSellerEXC.toNumber() === 3, "EXC not added to company");

    // Check if company has the required role
    const COMPANY_ROLE = await companyInstance.COMPANY_ROLE();
    const hasCompanyRole = await companyInstance.hasRole(
      COMPANY_ROLE,
      companyAddress
    );
    console.log("Company has COMPANY_ROLE:", hasCompanyRole);

    await ecoXChangeMarketInstance.sell(3, 0, {
      from: companyAddress,
    });

    const projectData = await companyInstance.projects(0);
    assert(projectData.excListed.toNumber() === 3, "EXC not listed");

    let afterSellerEXC = await ecoXChangeTokenInstance.checkEXC(companyAddress);
    assert(afterSellerEXC.toNumber() === 0, "EXC not deducted from company");
  });
});
