/**
 * @title Deploy Contracts
 * @dev Truffle migration script to deploy multiple contracts with dependencies.
 */

const ERC20 = artifacts.require("ERC20");
const EcoXChangeToken = artifacts.require("EcoXChangeToken");
const Company = artifacts.require("Company");
const ValidatorRegistry = artifacts.require("ValidatorRegistry");
const EcoXChangeMarket = artifacts.require("EcoXChangeMarket");

module.exports = function (deployer) {
  /**
   * @dev Deploy ERC20 token contract.
   */
  deployer
    .deploy(ERC20)
    .then(() => {
      /**
       * @dev Deploy EcoXChangeToken contract, which depends on ERC20 token contract.
       */
      return deployer.deploy(EcoXChangeToken, ERC20.address);
    })
    .then(() => {
      /**
       * @dev Deploy Company contract.
       */
      return deployer.deploy(Company);
    })
    .then(() => {
      /**
       * @dev Deploy ValidatorRegistry contract.
       */
      return deployer.deploy(ValidatorRegistry);
    })
    .then(() => {
      /**
       * @dev Deploy EcoXChangeMarket contract, which depends on ValidatorRegistry,
       * Company, ERC20, and EcoXChangeToken contracts.
       */
      return deployer.deploy(
        EcoXChangeMarket,
        Company.address,
        EcoXChangeToken.address,
        ValidatorRegistry.address
      );
    });
};
