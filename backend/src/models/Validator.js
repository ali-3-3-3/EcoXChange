const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Validator = sequelize.define('Validator', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id'
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
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        len: [2, 100],
        notEmpty: true
      }
    },
    credentials: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 2000],
        notEmpty: true
      },
      comment: 'Professional credentials and qualifications'
    },
    specializations: {
      type: DataTypes.ARRAY(DataTypes.ENUM(
        'reforestation',
        'renewable_energy',
        'energy_efficiency', 
        'waste_management',
        'carbon_capture',
        'other'
      )),
      allowNull: false,
      defaultValue: [],
      validate: {
        notEmpty: true
      }
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    is_approved: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether validator has been approved by admin'
    },
    validated_projects: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    reputation_score: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 5.00,
      validate: {
        min: 0,
        max: 10
      },
      comment: 'Reputation score out of 10'
    },
    join_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    last_validation: {
      type: DataTypes.DATE,
      allowNull: true
    },
    validator_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional validator metadata'
    }
  }, {
    tableName: 'validators',
    indexes: [
      {
        unique: true,
        fields: ['user_id']
      },
      {
        unique: true,
        fields: ['wallet_address']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['is_approved']
      },
      {
        fields: ['specializations'],
        using: 'gin'
      },
      {
        fields: ['reputation_score']
      },
      {
        fields: ['join_date']
      }
    ]
  });

  // Instance methods
  Validator.prototype.canValidateProject = function(projectType) {
    return this.is_active && 
           this.is_approved && 
           this.specializations.includes(projectType);
  };

  Validator.prototype.getPublicProfile = function() {
    return {
      id: this.id,
      name: this.name,
      specializations: this.specializations,
      validated_projects: this.validated_projects,
      reputation_score: this.reputation_score,
      join_date: this.join_date
    };
  };

  Validator.prototype.updateReputation = function(newScore) {
    // Simple reputation update - could be more sophisticated
    const currentScore = parseFloat(this.reputation_score);
    const updatedScore = (currentScore + newScore) / 2;
    this.reputation_score = Math.max(0, Math.min(10, updatedScore));
    return this.save();
  };

  Validator.prototype.incrementValidatedProjects = function() {
    this.validated_projects += 1;
    this.last_validation = new Date();
    return this.save();
  };

  // Class methods
  Validator.findByWalletAddress = function(walletAddress) {
    return this.findOne({
      where: { wallet_address: walletAddress.toLowerCase() }
    });
  };

  Validator.findActiveValidators = function() {
    return this.findAll({
      where: { 
        is_active: true,
        is_approved: true
      },
      order: [['reputation_score', 'DESC']]
    });
  };

  Validator.findValidatorsForProject = function(projectType) {
    return this.findAll({
      where: {
        is_active: true,
        is_approved: true,
        specializations: {
          [sequelize.Sequelize.Op.contains]: [projectType]
        }
      },
      order: [['reputation_score', 'DESC']]
    });
  };

  // Associations
  Validator.associate = function(models) {
    // Validator belongs to a user
    Validator.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });
  };

  return Validator;
};
