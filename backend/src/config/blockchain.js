const Web3 = require('web3');
const contract = require('@truffle/contract');
require('dotenv').config();

// Contract artifacts (will be populated after compilation)
const EcoXChangeTokenArtifact = require('../../build/contracts/EcoXChangeToken.json');
const EcoXChangeMarketArtifact = require('../../build/contracts/EcoXChangeMarket.json');
const ValidatorRegistryArtifact = require('../../build/contracts/ValidatorRegistry.json');
const CompanyArtifact = require('../../build/contracts/Company.json');

class BlockchainService {
  constructor() {
    this.web3 = null;
    this.contracts = {};
    this.account = null;
    this.networkId = null;
  }

  async initialize() {
    try {
      // Initialize Web3
      const rpcUrl = process.env.ETHEREUM_RPC_URL || 'http://127.0.0.1:8545';
      this.web3 = new Web3(new Web3.providers.HttpProvider(rpcUrl));
      
      // Get network ID
      this.networkId = await this.web3.eth.net.getId();
      console.log(`🔗 Connected to Ethereum network (ID: ${this.networkId})`);

      // Set up account if private key is provided
      if (process.env.PRIVATE_KEY) {
        const account = this.web3.eth.accounts.privateKeyToAccount(process.env.PRIVATE_KEY);
        this.web3.eth.accounts.wallet.add(account);
        this.account = account.address;
        console.log(`👤 Using account: ${this.account}`);
      }

      // Initialize contracts
      await this.initializeContracts();
      
      console.log('✅ Blockchain service initialized successfully');
    } catch (error) {
      console.error('❌ Blockchain initialization failed:', error);
      throw error;
    }
  }

  async initializeContracts() {
    try {
      // EcoXChangeToken
      const EcoXChangeToken = contract(EcoXChangeTokenArtifact);
      EcoXChangeToken.setProvider(this.web3.currentProvider);
      
      if (process.env.ECOXCHANGE_TOKEN_ADDRESS) {
        this.contracts.ecoXChangeToken = await EcoXChangeToken.at(process.env.ECOXCHANGE_TOKEN_ADDRESS);
      } else {
        // Deploy if address not provided (development only)
        if (process.env.NODE_ENV === 'development') {
          this.contracts.ecoXChangeToken = await EcoXChangeToken.new({ from: this.account });
          console.log(`📄 EcoXChangeToken deployed at: ${this.contracts.ecoXChangeToken.address}`);
        }
      }

      // EcoXChangeMarket
      const EcoXChangeMarket = contract(EcoXChangeMarketArtifact);
      EcoXChangeMarket.setProvider(this.web3.currentProvider);
      
      if (process.env.ECOXCHANGE_MARKET_ADDRESS) {
        this.contracts.ecoXChangeMarket = await EcoXChangeMarket.at(process.env.ECOXCHANGE_MARKET_ADDRESS);
      }

      // ValidatorRegistry
      const ValidatorRegistry = contract(ValidatorRegistryArtifact);
      ValidatorRegistry.setProvider(this.web3.currentProvider);
      
      if (process.env.VALIDATOR_REGISTRY_ADDRESS) {
        this.contracts.validatorRegistry = await ValidatorRegistry.at(process.env.VALIDATOR_REGISTRY_ADDRESS);
      }

      // Company
      const Company = contract(CompanyArtifact);
      Company.setProvider(this.web3.currentProvider);
      
      if (process.env.COMPANY_ADDRESS) {
        this.contracts.company = await Company.at(process.env.COMPANY_ADDRESS);
      }

      console.log('📄 Smart contracts initialized');
    } catch (error) {
      console.error('❌ Contract initialization failed:', error);
      throw error;
    }
  }

  // Utility methods
  toWei(amount) {
    return this.web3.utils.toWei(amount.toString(), 'ether');
  }

  fromWei(amount) {
    return this.web3.utils.fromWei(amount.toString(), 'ether');
  }

  isValidAddress(address) {
    return this.web3.utils.isAddress(address);
  }

  async getBalance(address) {
    return await this.web3.eth.getBalance(address);
  }

  async getBlockNumber() {
    return await this.web3.eth.getBlockNumber();
  }

  // Contract interaction methods
  async getTokenBalance(address) {
    if (!this.contracts.ecoXChangeToken) {
      throw new Error('EcoXChangeToken contract not initialized');
    }
    return await this.contracts.ecoXChangeToken.checkEXC(address);
  }

  async transferTokens(from, to, amount) {
    if (!this.contracts.ecoXChangeToken) {
      throw new Error('EcoXChangeToken contract not initialized');
    }
    return await this.contracts.ecoXChangeToken.transferEXC(to, amount, { from });
  }
}

// Create singleton instance
const blockchainService = new BlockchainService();

module.exports = blockchainService;
