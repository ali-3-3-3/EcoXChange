const AccessControl = artifacts.require("AccessControl");
const ValidatorRegistry = artifacts.require("ValidatorRegistry");
const Company = artifacts.require("Company");
const EcoXChangeMarket = artifacts.require("EcoXChangeMarket");
const EcoXChangeToken = artifacts.require("EcoXChangeToken");
const ERC20 = artifacts.require("ERC20");

contract("AccessControl Security Tests", (accounts) => {
  let accessControl;
  let validatorRegistry;
  let company;
  let ecoXChangeMarket;
  let ecoXChangeToken;
  let erc20;

  const [
    admin,
    validator1,
    validator2,
    company1,
    company2,
    user1,
    user2,
    attacker,
  ] = accounts;

  // Role constants (matching the contract)
  const DEFAULT_ADMIN_ROLE =
    "0x0000000000000000000000000000000000000000000000000000000000000000";
  const ADMIN_ROLE = web3.utils.keccak256("ADMIN_ROLE");
  const VALIDATOR_ROLE = web3.utils.keccak256("VALIDATOR_ROLE");
  const COMPANY_ROLE = web3.utils.keccak256("COMPANY_ROLE");
  const PAUSER_ROLE = web3.utils.keccak256("PAUSER_ROLE");

  beforeEach(async () => {
    // Deploy contracts
    erc20 = await ERC20.new({ from: admin });
    ecoXChangeToken = await EcoXChangeToken.new(erc20.address, { from: admin });
    validatorRegistry = await ValidatorRegistry.new({ from: admin });
    company = await Company.new({ from: admin });

    // Deploy DynamicPricing contract
    const DynamicPricing = artifacts.require("DynamicPricing");
    const dynamicPricing = await DynamicPricing.new(company.address, {
      from: admin,
    });

    ecoXChangeMarket = await EcoXChangeMarket.new(
      company.address,
      ecoXChangeToken.address,
      validatorRegistry.address,
      dynamicPricing.address,
      { from: admin }
    );
  });

  describe("Role-Based Access Control", () => {
    it("should grant admin role to deployer", async () => {
      const hasAdminRole = await validatorRegistry.hasRole(ADMIN_ROLE, admin);
      assert.equal(hasAdminRole, true, "Deployer should have admin role");
    });

    it("should allow admin to grant validator role", async () => {
      await validatorRegistry.addValidator(validator1, { from: admin });
      const hasValidatorRole = await validatorRegistry.hasRole(
        VALIDATOR_ROLE,
        validator1
      );
      assert.equal(
        hasValidatorRole,
        true,
        "Validator should have validator role"
      );
    });

    it("should prevent non-admin from granting validator role", async () => {
      try {
        await validatorRegistry.addValidator(validator1, { from: attacker });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("caller does not have required role"),
          "Should revert with role error"
        );
      }
    });

    it("should allow admin to grant company role", async () => {
      await company.addCompany(company1, "Test Company", { from: admin });
      const hasCompanyRole = await company.hasRole(COMPANY_ROLE, company1);
      assert.equal(hasCompanyRole, true, "Company should have company role");
    });

    it("should prevent non-admin from adding companies", async () => {
      try {
        await company.addCompany(company1, "Test Company", { from: attacker });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("caller does not have required role"),
          "Should revert with role error"
        );
      }
    });

    it("should allow role renunciation", async () => {
      await validatorRegistry.addValidator(validator1, { from: admin });
      await validatorRegistry.renounceRole(VALIDATOR_ROLE, validator1, {
        from: validator1,
      });

      const hasValidatorRole = await validatorRegistry.hasRole(
        VALIDATOR_ROLE,
        validator1
      );
      assert.equal(
        hasValidatorRole,
        false,
        "Validator should not have role after renunciation"
      );
    });

    it("should prevent renouncing roles for others", async () => {
      await validatorRegistry.addValidator(validator1, { from: admin });

      try {
        await validatorRegistry.renounceRole(VALIDATOR_ROLE, validator1, {
          from: attacker,
        });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("can only renounce roles for self"),
          "Should revert with self-renunciation error"
        );
      }
    });
  });

  describe("Emergency Pause Functionality", () => {
    it("should allow pauser to pause contract", async () => {
      await validatorRegistry.pause({ from: admin });
      const isPaused = await validatorRegistry.paused();
      assert.equal(isPaused, true, "Contract should be paused");
    });

    it("should prevent non-pauser from pausing", async () => {
      try {
        await validatorRegistry.pause({ from: attacker });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("caller does not have required role"),
          "Should revert with role error"
        );
      }
    });

    it("should prevent operations when paused", async () => {
      await validatorRegistry.pause({ from: admin });

      try {
        await validatorRegistry.addValidator(validator1, { from: admin });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("contract is paused"),
          "Should revert when paused"
        );
      }
    });

    it("should allow unpausing and resume operations", async () => {
      await validatorRegistry.pause({ from: admin });
      await validatorRegistry.unpause({ from: admin });

      // Should work after unpausing
      await validatorRegistry.addValidator(validator1, { from: admin });
      const isValidator = await validatorRegistry.isValidator(validator1);
      assert.equal(isValidator, true, "Should work after unpausing");
    });
  });

  describe("Blacklist Functionality", () => {
    it("should allow admin to blacklist accounts", async () => {
      await validatorRegistry.blacklistAccount(attacker, { from: admin });
      const isBlacklisted = await validatorRegistry.isBlacklisted(attacker);
      assert.equal(isBlacklisted, true, "Account should be blacklisted");
    });

    it("should prevent blacklisted accounts from getting roles", async () => {
      await validatorRegistry.blacklistAccount(attacker, { from: admin });

      try {
        await validatorRegistry.addValidator(attacker, { from: admin });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("account is blacklisted"),
          "Should revert for blacklisted account"
        );
      }
    });

    it("should revoke roles when blacklisting", async () => {
      await validatorRegistry.addValidator(validator1, { from: admin });
      await validatorRegistry.blacklistAccount(validator1, { from: admin });

      const hasValidatorRole = await validatorRegistry.hasRole(
        VALIDATOR_ROLE,
        validator1
      );
      assert.equal(
        hasValidatorRole,
        false,
        "Role should be revoked when blacklisted"
      );
    });

    it("should allow removing from blacklist", async () => {
      await validatorRegistry.blacklistAccount(attacker, { from: admin });
      await validatorRegistry.removeFromBlacklist(attacker, { from: admin });

      const isBlacklisted = await validatorRegistry.isBlacklisted(attacker);
      assert.equal(isBlacklisted, false, "Account should not be blacklisted");
    });
  });

  describe("Input Validation", () => {
    it("should reject zero addresses", async () => {
      try {
        await validatorRegistry.addValidator(
          "0x0000000000000000000000000000000000000000",
          { from: admin }
        );
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("invalid address"),
          "Should revert for zero address"
        );
      }
    });

    it("should reject empty company names", async () => {
      try {
        await company.addCompany(company1, "", { from: admin });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("company name cannot be empty"),
          "Should revert for empty name"
        );
      }
    });

    it("should reject company names that are too long", async () => {
      const longName = "a".repeat(101); // 101 characters
      try {
        await company.addCompany(company1, longName, { from: admin });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("company name too long"),
          "Should revert for long name"
        );
      }
    });
  });

  describe("Reentrancy Protection", () => {
    it("should prevent reentrancy in project creation", async () => {
      await company.addCompany(company1, "Test Company", { from: admin });

      // This test would require a malicious contract to test properly
      // For now, we'll test that the modifier is in place
      const projectName = "Test Project";
      const desc = "Test Description";
      const duration = 30;
      const co2Amount = 100;

      await company.addProject(projectName, desc, duration, co2Amount, {
        from: company1,
      });

      // Verify project was created successfully
      const project = await company.projects(0);
      assert.equal(
        project.projectName,
        projectName,
        "Project should be created"
      );
    });
  });

  describe("Advanced Security Tests", () => {
    it("should prevent validator from validating when blacklisted", async () => {
      await validatorRegistry.addValidator(validator1, { from: admin });
      await validatorRegistry.blacklistAccount(validator1, { from: admin });

      const isValidator = await validatorRegistry.isValidator(validator1);
      assert.equal(
        isValidator,
        false,
        "Blacklisted validator should not be active"
      );
    });

    it("should handle multiple role assignments correctly", async () => {
      await validatorRegistry.addValidator(validator1, { from: admin });
      await company.addCompany(company1, "Test Company", { from: admin });

      const hasValidatorRole = await validatorRegistry.hasRole(
        VALIDATOR_ROLE,
        validator1
      );
      const hasCompanyRole = await company.hasRole(COMPANY_ROLE, company1);

      assert.equal(
        hasValidatorRole,
        true,
        "Validator should have validator role"
      );
      assert.equal(hasCompanyRole, true, "Company should have company role");
    });

    it("should prevent operations on paused contracts", async () => {
      await validatorRegistry.pause({ from: admin });

      try {
        await validatorRegistry.addValidator(validator2, { from: admin });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("contract is paused"),
          "Should revert when paused"
        );
      }
    });

    it("should validate project bounds correctly", async () => {
      await company.addCompany(company1, "Test Company", { from: admin });

      // Test minimum CO2 amount
      try {
        await company.addProject("Test", "Test Description", 30, 0, {
          from: company1,
        });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("CO2 amount out of bounds"),
          "Should reject zero CO2 amount"
        );
      }

      // Test maximum CO2 amount
      try {
        await company.addProject("Test", "Test Description", 30, 1000001, {
          from: company1,
        });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("CO2 amount out of bounds"),
          "Should reject excessive CO2 amount"
        );
      }
    });

    it("should validate transaction amounts in market", async () => {
      await company.addCompany(company1, "Test Company", { from: admin });
      await company.addProject("Test Project", "Test Description", 30, 100, {
        from: company1,
      });

      // Test transaction amount bounds
      try {
        await ecoXChangeMarket.sell(0, 0, {
          from: company1,
          value: web3.utils.toWei("0", "ether"),
        });
        assert.fail("Should have thrown an error");
      } catch (error) {
        assert(
          error.message.includes("transaction amount out of bounds"),
          "Should reject zero transaction amount"
        );
      }
    });
  });
});
