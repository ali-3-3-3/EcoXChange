const _deploy_contracts = require("../migrations/5_deploy_contracts");

var EcoXChangeMarket = artifacts.require("EcoXChangeMarket");
var Company = artifacts.require("Company");
var ValidatorRegistry = artifacts.require("ValidatorRegistry");
var EcoXChangeToken = artifacts.require("EcoXChangeToken");

contract("EcoXChangeMarket for Completed Projects", function (accounts) {
  let companyInstance = null;
  const owner = accounts[0]; // contract owner
  const companyAddress = accounts[1]; // company address

  before(async () => {
    validatorRegistryInstance = await ValidatorRegistry.deployed();
    companyInstance = await Company.deployed();
    ecoXChangeMarketInstance = await EcoXChangeMarket.deployed();
    ecoXChangeTokenInstance = await EcoXChangeToken.deployed();
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
    } catch (e) {
      assert(
        e.message.includes("Only contract owner can execute this function")
      );
      return;
    }
    assert(false);
  });

  it("Should add a project", async () => {
    await companyInstance.addProject(
      "Test Project",
      "Test Description",
      1000,
      3,
      { from: companyAddress }
    );
    const projectData = await companyInstance.projects(0);
    assert(projectData.projectName === "Test Project");
    assert(projectData.excAmount.toNumber() === 3);
  });

  it("Selling EXC from Completed Project", async () => {
    await companyInstance.setProjectStateComplete(0); // set project to be completed
    await ecoXChangeTokenInstance.getEXC(companyAddress, 3); // give 3 EXC to the company (since its a completed project)
    let initialSellerEXC = await ecoXChangeTokenInstance.checkEXC(
      companyAddress
    );
    assert(initialSellerEXC.toNumber() === 3, "EXC not added to company");

    await ecoXChangeMarketInstance.sell(3, 0, {
      from: companyAddress,
    });

    const projectData = await companyInstance.projects(0);
    assert(projectData.excListed.toNumber() === 3, "EXC not listed");

    let afterSellerEXC = await ecoXChangeTokenInstance.checkEXC(companyAddress);
    assert(afterSellerEXC.toNumber() === 0, "EXC not deducted from company");
  });
});
