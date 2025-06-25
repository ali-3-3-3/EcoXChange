const { blockchainService } = require('../config/blockchain');
const { Transaction, Project } = require('../models');

class TransactionMonitor {
  constructor() {
    this.blockchain = blockchainService;
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('Transaction monitoring already running');
      return;
    }

    this.isMonitoring = true;
    console.log('🔍 Starting transaction monitoring...');

    // Monitor every 30 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkPendingTransactions();
      } catch (error) {
        console.error('Error in transaction monitoring:', error);
      }
    }, 30000);

    // Also check immediately
    await this.checkPendingTransactions();
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('⏹️ Transaction monitoring stopped');
  }

  async checkPendingTransactions() {
    try {
      // Get all pending transactions
      const pendingTransactions = await Transaction.findAll({
        where: { status: 'pending' },
        include: [{ model: Project, as: 'project' }]
      });

      if (pendingTransactions.length === 0) {
        return;
      }

      console.log(`🔍 Checking ${pendingTransactions.length} pending transactions...`);

      for (const transaction of pendingTransactions) {
        await this.checkTransactionStatus(transaction);
      }
    } catch (error) {
      console.error('Error checking pending transactions:', error);
    }
  }

  async checkTransactionStatus(transaction) {
    try {
      if (!transaction.tx_hash) {
        // Transaction doesn't have a hash yet, skip
        return;
      }

      const web3 = this.blockchain.getWeb3();
      const receipt = await web3.eth.getTransactionReceipt(transaction.tx_hash);

      if (receipt) {
        // Transaction is mined
        if (receipt.status) {
          // Transaction successful
          await this.handleSuccessfulTransaction(transaction, receipt);
        } else {
          // Transaction failed
          await this.handleFailedTransaction(transaction, receipt);
        }
      } else {
        // Check if transaction is still pending or dropped
        const tx = await web3.eth.getTransaction(transaction.tx_hash);
        if (!tx) {
          // Transaction was dropped
          await this.handleDroppedTransaction(transaction);
        }
        // If tx exists but no receipt, it's still pending
      }
    } catch (error) {
      console.error(`Error checking transaction ${transaction.id}:`, error);
    }
  }

  async handleSuccessfulTransaction(transaction, receipt) {
    try {
      console.log(`✅ Transaction confirmed: ${transaction.tx_hash}`);

      // Update transaction status
      await transaction.update({
        status: 'confirmed',
        block_number: receipt.blockNumber,
        gas_used: receipt.gasUsed,
        confirmed_at: new Date()
      });

      // Update project statistics if it's a buy/sell transaction
      if (transaction.type === 'buy' || transaction.type === 'sell') {
        await this.updateProjectStats(transaction);
      }

      // Emit event for real-time updates (if using WebSocket)
      this.emitTransactionUpdate(transaction, 'confirmed');

    } catch (error) {
      console.error('Error handling successful transaction:', error);
    }
  }

  async handleFailedTransaction(transaction, receipt) {
    try {
      console.log(`❌ Transaction failed: ${transaction.tx_hash}`);

      await transaction.update({
        status: 'failed',
        block_number: receipt.blockNumber,
        gas_used: receipt.gasUsed,
        failed_reason: 'Transaction reverted',
        confirmed_at: new Date()
      });

      this.emitTransactionUpdate(transaction, 'failed');

    } catch (error) {
      console.error('Error handling failed transaction:', error);
    }
  }

  async handleDroppedTransaction(transaction) {
    try {
      console.log(`🗑️ Transaction dropped: ${transaction.tx_hash}`);

      await transaction.update({
        status: 'cancelled',
        failed_reason: 'Transaction dropped from mempool'
      });

      this.emitTransactionUpdate(transaction, 'cancelled');

    } catch (error) {
      console.error('Error handling dropped transaction:', error);
    }
  }

  async updateProjectStats(transaction) {
    try {
      const project = await Project.findByPk(transaction.project_id);
      if (!project) return;

      if (transaction.type === 'buy') {
        // Update exc_sold
        const newExcSold = parseFloat(project.exc_sold) + parseFloat(transaction.amount);
        await project.update({ exc_sold: newExcSold });
      } else if (transaction.type === 'sell') {
        // Update exc_listed
        const newExcListed = parseFloat(project.exc_listed) + parseFloat(transaction.amount);
        await project.update({ exc_listed: newExcListed });
      }

      console.log(`📊 Updated project ${project.id} statistics`);
    } catch (error) {
      console.error('Error updating project stats:', error);
    }
  }

  emitTransactionUpdate(transaction, status) {
    // This would emit to WebSocket clients if implemented
    // For now, just log
    console.log(`📡 Transaction update: ${transaction.id} -> ${status}`);
  }

  // Manual transaction check
  async checkTransaction(txHash) {
    try {
      const transaction = await Transaction.findOne({
        where: { tx_hash: txHash }
      });

      if (!transaction) {
        throw new Error('Transaction not found in database');
      }

      await this.checkTransactionStatus(transaction);
      return transaction.reload();
    } catch (error) {
      console.error('Error checking specific transaction:', error);
      throw error;
    }
  }

  // Get transaction status from blockchain
  async getTransactionStatus(txHash) {
    try {
      const web3 = this.blockchain.getWeb3();
      const receipt = await web3.eth.getTransactionReceipt(txHash);
      
      if (receipt) {
        return {
          status: receipt.status ? 'confirmed' : 'failed',
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed
        };
      }

      const tx = await web3.eth.getTransaction(txHash);
      return {
        status: tx ? 'pending' : 'not_found',
        blockNumber: null,
        gasUsed: null
      };
    } catch (error) {
      console.error('Error getting transaction status:', error);
      throw error;
    }
  }
}

// Create singleton instance
const transactionMonitor = new TransactionMonitor();

module.exports = {
  TransactionMonitor,
  transactionMonitor
};
