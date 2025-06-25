import Web3 from 'web3';
import { Contract } from 'web3-eth-contract';

// Import contract ABIs (these would be generated from your compiled contracts)
import EcoXChangeTokenABI from '../../../build/contracts/EcoXChangeToken.json';
import EcoXChangeMarketABI from '../../../build/contracts/EcoXChangeMarket.json';
import ValidatorRegistryABI from '../../../build/contracts/ValidatorRegistry.json';
import CompanyABI from '../../../build/contracts/Company.json';
import DynamicPricingABI from '../../../build/contracts/DynamicPricing.json';

interface ContractAddresses {
  ecoXChangeToken: string;
  ecoXChangeMarket: string;
  validatorRegistry: string;
  company: string;
  dynamicPricing: string;
}

interface TransactionResult {
  success: boolean;
  txHash?: string;
  error?: string;
  receipt?: any;
}

class ContractService {
  private web3: Web3 | null = null;
  private contracts: { [key: string]: Contract } = {};
  private account: string | null = null;

  constructor() {
    this.initializeWeb3();
  }

  private async initializeWeb3() {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.web3 = new Web3(window.ethereum);
    } else {
      console.warn('MetaMask not detected');
    }
  }

  async connect(account: string): Promise<void> {
    this.account = account;
    await this.initializeContracts();
  }

  private async initializeContracts(): Promise<void> {
    if (!this.web3) {
      throw new Error('Web3 not initialized');
    }

    const addresses: ContractAddresses = {
      ecoXChangeToken: process.env.NEXT_PUBLIC_ECOXCHANGE_TOKEN_ADDRESS || '',
      ecoXChangeMarket: process.env.NEXT_PUBLIC_ECOXCHANGE_MARKET_ADDRESS || '',
      validatorRegistry: process.env.NEXT_PUBLIC_VALIDATOR_REGISTRY_ADDRESS || '',
      company: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '',
      dynamicPricing: process.env.NEXT_PUBLIC_DYNAMIC_PRICING_ADDRESS || ''
    };

    try {
      if (addresses.ecoXChangeToken) {
        this.contracts.ecoXChangeToken = new this.web3.eth.Contract(
          EcoXChangeTokenABI.abi as any,
          addresses.ecoXChangeToken
        );
      }

      if (addresses.ecoXChangeMarket) {
        this.contracts.ecoXChangeMarket = new this.web3.eth.Contract(
          EcoXChangeMarketABI.abi as any,
          addresses.ecoXChangeMarket
        );
      }

      if (addresses.validatorRegistry) {
        this.contracts.validatorRegistry = new this.web3.eth.Contract(
          ValidatorRegistryABI.abi as any,
          addresses.validatorRegistry
        );
      }

      if (addresses.company) {
        this.contracts.company = new this.web3.eth.Contract(
          CompanyABI.abi as any,
          addresses.company
        );
      }

      if (addresses.dynamicPricing) {
        this.contracts.dynamicPricing = new this.web3.eth.Contract(
          DynamicPricingABI.abi as any,
          addresses.dynamicPricing
        );
      }

      console.log('✅ Contracts initialized');
    } catch (error) {
      console.error('❌ Contract initialization failed:', error);
      throw error;
    }
  }

  // Token-related methods
  async getTokenBalance(address: string): Promise<string> {
    if (!this.contracts.ecoXChangeToken) {
      throw new Error('EcoXChangeToken contract not initialized');
    }

    try {
      const balance = await this.contracts.ecoXChangeToken.methods.checkEXC(address).call();
      return this.web3!.utils.fromWei(balance, 'ether');
    } catch (error) {
      console.error('Error getting token balance:', error);
      throw error;
    }
  }

  async mintTokens(recipient: string, amount: string): Promise<TransactionResult> {
    if (!this.contracts.ecoXChangeToken || !this.account) {
      throw new Error('Contract not initialized or account not connected');
    }

    try {
      const amountWei = this.web3!.utils.toWei(amount, 'ether');
      
      const tx = await this.contracts.ecoXChangeToken.methods
        .getEXC(recipient, amountWei)
        .send({ 
          from: this.account,
          value: amountWei // 1 ETH = 1 EXC
        });

      return {
        success: true,
        txHash: tx.transactionHash,
        receipt: tx
      };
    } catch (error: any) {
      console.error('Error minting tokens:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Company-related methods
  async registerCompany(name: string, walletAddress: string): Promise<TransactionResult> {
    if (!this.contracts.company || !this.account) {
      throw new Error('Contract not initialized or account not connected');
    }

    try {
      const tx = await this.contracts.company.methods
        .addCompany(name, walletAddress)
        .send({ from: this.account });

      return {
        success: true,
        txHash: tx.transactionHash,
        receipt: tx
      };
    } catch (error: any) {
      console.error('Error registering company:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addProject(
    title: string,
    description: string,
    daysTillCompletion: number,
    carbonDioxideSaved: string
  ): Promise<TransactionResult> {
    if (!this.contracts.company || !this.account) {
      throw new Error('Contract not initialized or account not connected');
    }

    try {
      const carbonAmount = this.web3!.utils.toWei(carbonDioxideSaved, 'ether');
      
      const tx = await this.contracts.company.methods
        .addProject(title, description, daysTillCompletion, carbonAmount)
        .send({ from: this.account });

      return {
        success: true,
        txHash: tx.transactionHash,
        receipt: tx
      };
    } catch (error: any) {
      console.error('Error adding project:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getProject(projectId: number): Promise<any> {
    if (!this.contracts.company) {
      throw new Error('Company contract not initialized');
    }

    try {
      const project = await this.contracts.company.methods.getProject(projectId).call();
      return project;
    } catch (error) {
      console.error('Error getting project:', error);
      throw error;
    }
  }

  // Trading-related methods
  async buyCredits(
    amount: string,
    companyAddress: string,
    projectId: number,
    ethAmount: string
  ): Promise<TransactionResult> {
    if (!this.contracts.ecoXChangeMarket || !this.account) {
      throw new Error('Contract not initialized or account not connected');
    }

    try {
      const amountWei = this.web3!.utils.toWei(amount, 'ether');
      const ethAmountWei = this.web3!.utils.toWei(ethAmount, 'ether');

      const tx = await this.contracts.ecoXChangeMarket.methods
        .buy(amountWei, companyAddress, projectId)
        .send({ 
          from: this.account,
          value: ethAmountWei
        });

      return {
        success: true,
        txHash: tx.transactionHash,
        receipt: tx
      };
    } catch (error: any) {
      console.error('Error buying credits:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async sellCredits(amount: string, projectId: number, stakeAmount: string): Promise<TransactionResult> {
    if (!this.contracts.ecoXChangeMarket || !this.account) {
      throw new Error('Contract not initialized or account not connected');
    }

    try {
      const amountWei = this.web3!.utils.toWei(amount, 'ether');
      const stakeAmountWei = this.web3!.utils.toWei(stakeAmount, 'ether');

      const tx = await this.contracts.ecoXChangeMarket.methods
        .sell(amountWei, projectId)
        .send({ 
          from: this.account,
          value: stakeAmountWei
        });

      return {
        success: true,
        txHash: tx.transactionHash,
        receipt: tx
      };
    } catch (error: any) {
      console.error('Error selling credits:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Pricing-related methods
  async getCurrentPrice(projectId: number): Promise<string> {
    if (!this.contracts.dynamicPricing) {
      throw new Error('DynamicPricing contract not initialized');
    }

    try {
      const price = await this.contracts.dynamicPricing.methods.getCurrentPrice(projectId).call();
      return this.web3!.utils.fromWei(price, 'ether');
    } catch (error) {
      console.error('Error getting current price:', error);
      throw error;
    }
  }

  async getMarketConditions(): Promise<any> {
    if (!this.contracts.ecoXChangeMarket) {
      throw new Error('EcoXChangeMarket contract not initialized');
    }

    try {
      const conditions = await this.contracts.ecoXChangeMarket.methods.getMarketConditions().call();
      return conditions;
    } catch (error) {
      console.error('Error getting market conditions:', error);
      throw error;
    }
  }

  // Validator-related methods
  async isValidator(address: string): Promise<boolean> {
    if (!this.contracts.validatorRegistry) {
      throw new Error('ValidatorRegistry contract not initialized');
    }

    try {
      const isValidator = await this.contracts.validatorRegistry.methods.isValidator(address).call();
      return isValidator;
    } catch (error) {
      console.error('Error checking validator status:', error);
      throw error;
    }
  }

  async validateProject(
    companyAddress: string,
    projectId: number,
    isValid: boolean,
    actualEXC: string
  ): Promise<TransactionResult> {
    if (!this.contracts.ecoXChangeMarket || !this.account) {
      throw new Error('Contract not initialized or account not connected');
    }

    try {
      const actualEXCWei = this.web3!.utils.toWei(actualEXC, 'ether');

      const tx = await this.contracts.ecoXChangeMarket.methods
        .validateProject(companyAddress, projectId, isValid, actualEXCWei)
        .send({ from: this.account });

      return {
        success: true,
        txHash: tx.transactionHash,
        receipt: tx
      };
    } catch (error: any) {
      console.error('Error validating project:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility methods
  toWei(amount: string): string {
    return this.web3!.utils.toWei(amount, 'ether');
  }

  fromWei(amount: string): string {
    return this.web3!.utils.fromWei(amount, 'ether');
  }

  isValidAddress(address: string): boolean {
    return this.web3!.utils.isAddress(address);
  }

  getWeb3(): Web3 | null {
    return this.web3;
  }

  getAccount(): string | null {
    return this.account;
  }

  isConnected(): boolean {
    return this.web3 !== null && this.account !== null;
  }
}

// Create singleton instance
export const contractService = new ContractService();
export default contractService;
