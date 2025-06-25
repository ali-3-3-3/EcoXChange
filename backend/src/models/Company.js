const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Company = sequelize.define('Company', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [2, 200],
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true
      }
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
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    registration_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    is_verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    project_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    total_exc_issued: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    total_exc_sold: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    company_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    }
  }, {
    tableName: 'companies',
    indexes: [
      {
        unique: true,
        fields: ['wallet_address']
      },
      {
        fields: ['owner_id']
      },
      {
        fields: ['is_verified']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['registration_date']
      }
    ]
  });

  // Instance methods
  Company.prototype.toJSON = function() {
    const values = { ...this.get() };
    // Remove sensitive data from JSON output
    delete values.company_data;
    return values;
  };

  Company.prototype.getPublicProfile = function() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      website: this.website,
      wallet_address: this.wallet_address,
      is_verified: this.is_verified,
      project_count: this.project_count,
      total_exc_issued: this.total_exc_issued,
      registration_date: this.registration_date
    };
  };

  // Class methods
  Company.findByWalletAddress = function(walletAddress) {
    return this.findOne({
      where: { wallet_address: walletAddress.toLowerCase() }
    });
  };

  // Associations
  Company.associate = function(models) {
    // Company belongs to a user (owner)
    Company.belongsTo(models.User, {
      foreignKey: 'owner_id',
      as: 'owner'
    });

    // Company has many projects
    Company.hasMany(models.Project, {
      foreignKey: 'company_id',
      as: 'projects'
    });

    // Company has many transactions through projects
    Company.hasMany(models.Transaction, {
      foreignKey: 'seller_address',
      sourceKey: 'wallet_address',
      as: 'sales'
    });
  };

  return Company;
};
