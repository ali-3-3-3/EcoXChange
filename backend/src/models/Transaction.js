const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaction = sequelize.define('Transaction', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    type: {
      type: DataTypes.ENUM('buy', 'sell', 'transfer', 'burn'),
      allowNull: false
    },
    buyer_address: {
      type: DataTypes.STRING(42),
      allowNull: true,
      validate: {
        isEthereumAddress(value) {
          if (value && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
            throw new Error('Invalid Ethereum address format');
          }
        }
      }
    },
    seller_address: {
      type: DataTypes.STRING(42),
      allowNull: true,
      validate: {
        isEthereumAddress(value) {
          if (value && !/^0x[a-fA-F0-9]{40}$/.test(value)) {
            throw new Error('Invalid Ethereum address format');
          }
        }
      }
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id'
      }
    },
    amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      validate: {
        min: 0.01
      },
      comment: 'Amount of EXC tokens transacted'
    },
    price_per_credit: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      validate: {
        min: 0.01
      },
      comment: 'Price per EXC token in ETH'
    },
    total_price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      validate: {
        min: 0.01
      },
      comment: 'Total transaction value in ETH'
    },
    tx_hash: {
      type: DataTypes.STRING(66),
      allowNull: true,
      unique: true,
      validate: {
        isTransactionHash(value) {
          if (value && !/^0x[a-fA-F0-9]{64}$/.test(value)) {
            throw new Error('Invalid transaction hash format');
          }
        }
      }
    },
    block_number: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0
      }
    },
    gas_used: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 0
      }
    },
    gas_price: {
      type: DataTypes.DECIMAL(20, 0),
      allowNull: true,
      validate: {
        min: 0
      },
      comment: 'Gas price in wei'
    },
    status: {
      type: DataTypes.ENUM('pending', 'confirmed', 'failed', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    confirmed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failed_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    transaction_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional transaction metadata'
    }
  }, {
    tableName: 'transactions',
    indexes: [
      {
        unique: true,
        fields: ['tx_hash'],
        where: {
          tx_hash: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      {
        fields: ['buyer_address']
      },
      {
        fields: ['seller_address']
      },
      {
        fields: ['project_id']
      },
      {
        fields: ['type']
      },
      {
        fields: ['status']
      },
      {
        fields: ['created_at']
      },
      {
        fields: ['confirmed_at']
      }
    ]
  });

  // Instance methods
  Transaction.prototype.getTotalCost = function() {
    return parseFloat(this.amount) * parseFloat(this.price_per_credit);
  };

  Transaction.prototype.isPending = function() {
    return this.status === 'pending';
  };

  Transaction.prototype.isConfirmed = function() {
    return this.status === 'confirmed';
  };

  Transaction.prototype.markAsConfirmed = function(txHash, blockNumber) {
    this.status = 'confirmed';
    this.tx_hash = txHash;
    this.block_number = blockNumber;
    this.confirmed_at = new Date();
    return this.save();
  };

  Transaction.prototype.markAsFailed = function(reason) {
    this.status = 'failed';
    this.failed_reason = reason;
    return this.save();
  };

  // Class methods
  Transaction.findByTxHash = function(txHash) {
    return this.findOne({
      where: { tx_hash: txHash }
    });
  };

  Transaction.findByAddress = function(address, type = null) {
    const where = {
      [sequelize.Sequelize.Op.or]: [
        { buyer_address: address.toLowerCase() },
        { seller_address: address.toLowerCase() }
      ]
    };
    
    if (type) {
      where.type = type;
    }

    return this.findAll({ where });
  };

  // Associations
  Transaction.associate = function(models) {
    // Transaction belongs to a project
    Transaction.belongsTo(models.Project, {
      foreignKey: 'project_id',
      as: 'project'
    });

    // Transaction can reference buyer (User)
    Transaction.belongsTo(models.User, {
      foreignKey: 'buyer_address',
      targetKey: 'wallet_address',
      as: 'buyer'
    });

    // Transaction can reference seller (Company)
    Transaction.belongsTo(models.Company, {
      foreignKey: 'seller_address',
      targetKey: 'wallet_address',
      as: 'seller'
    });
  };

  return Transaction;
};
