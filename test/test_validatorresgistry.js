const ValidatorRegistry = artifacts.require("ValidatorRegistry");

contract("ValidatorRegistry", (accounts) => {
  let validatorRegistry = null;
  const owner = accounts[0];
  const validator = accounts[1];

  console.log("Testing ValidatorRegistry contract");

  before(async () => {
    validatorRegistry = await ValidatorRegistry.deployed();
  });

  it("Should add a validator", async () => {
    await validatorRegistry.addValidator(validator, { from: owner });
    const isValid = await validatorRegistry.validators(validator);
    assert(isValid === true);
  });

  it("Should not add a validator if not owner", async () => {
    try {
      await validatorRegistry.addValidator(accounts[2], { from: validator });
      assert.fail("Should have thrown an error");
    } catch (e) {
      assert(
        e.message.includes("caller does not have required role"),
        "Should revert with role error"
      );
    }
  });

  it("Should remove a validator", async () => {
    await validatorRegistry.removeValidator(validator, { from: owner });
    const isValid = await validatorRegistry.validators(validator);
    assert(isValid === false);
  });

  it("Should not remove a validator if not owner", async () => {
    try {
      await validatorRegistry.removeValidator(validator, { from: validator });
      assert.fail("Should have thrown an error");
    } catch (e) {
      assert(
        e.message.includes("caller does not have required role"),
        "Should revert with role error"
      );
    }
  });
});
