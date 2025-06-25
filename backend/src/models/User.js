const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    wallet_address: {
      type: DataTypes.STRING(42),
      allowNull: false,
      unique: true,
      validate: {
        isEthereumAddress(value) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
            throw new Error('Invalid Ethereum address format');
          }
        }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: true,
      validate: {
        len: [2, 100]
      }
    },
    role: {
      type: DataTypes.ENUM('buyer', 'seller', 'validator', 'admin'),
      allowNull: false,
      defaultValue: 'buyer'
    },
    is_validator: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true
    },
    profile_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'users',
    indexes: [
      {
        unique: true,
        fields: ['wallet_address']
      },
      {
        unique: true,
        fields: ['email'],
        where: {
          email: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      {
        fields: ['role']
      },
      {
        fields: ['is_validator']
      }
    ]
  });

  // Instance methods
  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    // Remove sensitive data from JSON output
    delete values.profile_data;
    return values;
  };

  User.prototype.getPublicProfile = function() {
    return {
      id: this.id,
      wallet_address: this.wallet_address,
      name: this.name,
      role: this.role,
      is_validator: this.is_validator,
      created_at: this.created_at
    };
  };

  // Class methods
  User.findByWalletAddress = function(walletAddress) {
    return this.findOne({
      where: { wallet_address: walletAddress.toLowerCase() }
    });
  };

  // Associations
  User.associate = function(models) {
    // User can own multiple companies
    User.hasMany(models.Company, {
      foreignKey: 'owner_id',
      as: 'companies'
    });

    // User can have multiple transactions as buyer
    User.hasMany(models.Transaction, {
      foreignKey: 'buyer_address',
      sourceKey: 'wallet_address',
      as: 'purchases'
    });

    // User can have multiple transactions as seller
    User.hasMany(models.Transaction, {
      foreignKey: 'seller_address',
      sourceKey: 'wallet_address',
      as: 'sales'
    });

    // User can be a validator
    User.hasOne(models.Validator, {
      foreignKey: 'user_id',
      as: 'validator_profile'
    });
  };

  return User;
};
