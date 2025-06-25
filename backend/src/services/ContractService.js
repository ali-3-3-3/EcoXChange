const { blockchainService } = require('../config/blockchain');
const { User, Company, Project, Transaction, Validator } = require('../models');

class ContractService {
  constructor() {
    this.blockchain = blockchainService;
  }

  async initialize() {
    try {
      await this.blockchain.initialize();
      await this.blockchain.initializeContracts();
      console.log('✅ Contract service initialized');
    } catch (error) {
      console.error('❌ Contract service initialization failed:', error);
      throw error;
    }
  }

  // Company-related contract interactions
  async registerCompany(companyData) {
    try {
      const { name, walletAddress, ownerId } = companyData;
      
      // Call smart contract to register company
      const contracts = this.blockchain.getContracts();
      if (!contracts.company) {
        throw new Error('Company contract not initialized');
      }

      const tx = await contracts.company.addCompany(
        name,
        walletAddress,
        { from: this.blockchain.account }
      );

      return {
        success: true,
        txHash: tx.tx,
        blockNumber: tx.receipt.blockNumber,
        gasUsed: tx.receipt.gasUsed
      };
    } catch (error) {
      console.error('Error registering company:', error);
      throw error;
    }
  }

  async addProject(projectData) {
    try {
      const { title, description, daysTillCompletion, carbonDioxideSaved, companyAddress } = projectData;
      
      const contracts = this.blockchain.getContracts();
      if (!contracts.company) {
        throw new Error('Company contract not initialized');
      }

      const tx = await contracts.company.addProject(
        title,
        description,
        daysTillCompletion,
        carbonDioxideSaved,
        { from: companyAddress }
      );

      return {
        success: true,
        txHash: tx.tx,
        blockNumber: tx.receipt.blockNumber,
        gasUsed: tx.receipt.gasUsed,
        projectId: tx.logs[0].args.projectId.toString() // Extract project ID from event
      };
    } catch (error) {
      console.error('Error adding project:', error);
      throw error;
    }
  }

  // Trading-related contract interactions
  async buyCredits(buyData) {
    try {
      const { amount, companyAddress, projectId, buyerAddress, ethAmount } = buyData;
      
      const contracts = this.blockchain.getContracts();
      if (!contracts.ecoXChangeMarket) {
        throw new Error('EcoXChangeMarket contract not initialized');
      }

      const tx = await contracts.ecoXChangeMarket.buy(
        amount,
        companyAddress,
        projectId,
        {
          from: buyerAddress,
          value: this.blockchain.toWei(ethAmount)
        }
      );

      return {
        success: true,
        txHash: tx.tx,
        blockNumber: tx.receipt.blockNumber,
        gasUsed: tx.receipt.gasUsed
      };
    } catch (error) {
      console.error('Error buying credits:', error);
      throw error;
    }
  }

  async sellCredits(sellData) {
    try {
      const { amount, projectId, sellerAddress, ethAmount } = sellData;
      
      const contracts = this.blockchain.getContracts();
      if (!contracts.ecoXChangeMarket) {
        throw new Error('EcoXChangeMarket contract not initialized');
      }

      const tx = await contracts.ecoXChangeMarket.sell(
        amount,
        projectId,
        {
          from: sellerAddress,
          value: this.blockchain.toWei(ethAmount) // Staking amount
        }
      );

      return {
        success: true,
        txHash: tx.tx,
        blockNumber: tx.receipt.blockNumber,
        gasUsed: tx.receipt.gasUsed
      };
    } catch (error) {
      console.error('Error selling credits:', error);
      throw error;
    }
  }

  // Validator-related contract interactions
  async registerValidator(validatorData) {
    try {
      const { walletAddress } = validatorData;
      
      const contracts = this.blockchain.getContracts();
      if (!contracts.validatorRegistry) {
        throw new Error('ValidatorRegistry contract not initialized');
      }

      const tx = await contracts.validatorRegistry.addValidator(
        walletAddress,
        { from: this.blockchain.account } // Admin account
      );

      return {
        success: true,
        txHash: tx.tx,
        blockNumber: tx.receipt.blockNumber,
        gasUsed: tx.receipt.gasUsed
      };
    } catch (error) {
      console.error('Error registering validator:', error);
      throw error;
    }
  }

  async validateProject(validationData) {
    try {
      const { companyAddress, projectId, isValid, actualEXC, validatorAddress } = validationData;
      
      const contracts = this.blockchain.getContracts();
      if (!contracts.ecoXChangeMarket) {
        throw new Error('EcoXChangeMarket contract not initialized');
      }

      const tx = await contracts.ecoXChangeMarket.validateProject(
        companyAddress,
        projectId,
        isValid,
        actualEXC,
        { from: validatorAddress }
      );

      return {
        success: true,
        txHash: tx.tx,
        blockNumber: tx.receipt.blockNumber,
        gasUsed: tx.receipt.gasUsed
      };
    } catch (error) {
      console.error('Error validating project:', error);
      throw error;
    }
  }

  // Query methods
  async getTokenBalance(address) {
    try {
      return await this.blockchain.getTokenBalance(address);
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw error;
    }
  }

  async getProjectDetails(projectId) {
    try {
      return await this.blockchain.getProjectDetails(projectId);
    } catch (error) {
      console.error('Error getting project details:', error);
      throw error;
    }
  }

  async getCurrentPrice(projectId) {
    try {
      return await this.blockchain.getCurrentPrice(projectId);
    } catch (error) {
      console.error('Error getting current price:', error);
      throw error;
    }
  }

  async isValidator(address) {
    try {
      return await this.blockchain.isValidator(address);
    } catch (error) {
      console.error('Error checking validator status:', error);
      throw error;
    }
  }

  // Utility methods
  toWei(amount) {
    return this.blockchain.toWei(amount);
  }

  fromWei(amount) {
    return this.blockchain.fromWei(amount);
  }

  isValidAddress(address) {
    return this.blockchain.isValidAddress(address);
  }
}

// Create singleton instance
const contractService = new ContractService();

module.exports = {
  ContractService,
  contractService
};
