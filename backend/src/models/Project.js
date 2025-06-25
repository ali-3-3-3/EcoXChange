const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Project = sequelize.define('Project', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    blockchain_project_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      unique: true,
      comment: 'Project ID from smart contract'
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [3, 200],
        notEmpty: true
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        len: [10, 5000],
        notEmpty: true
      }
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [2, 200],
        notEmpty: true
      }
    },
    project_type: {
      type: DataTypes.ENUM(
        'reforestation',
        'renewable_energy', 
        'energy_efficiency',
        'waste_management',
        'carbon_capture',
        'other'
      ),
      allowNull: false
    },
    exc_amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      validate: {
        min: 1,
        max: 1000000
      },
      comment: 'Total EXC amount predicted/allocated for project'
    },
    exc_listed: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'EXC amount currently listed for sale'
    },
    exc_sold: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'EXC amount sold so far'
    },
    staked_credits: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Amount of credits staked by company'
    },
    state: {
      type: DataTypes.ENUM(
        'draft',
        'submitted', 
        'under_review',
        'ongoing',
        'completed',
        'rejected'
      ),
      allowNull: false,
      defaultValue: 'draft'
    },
    validation_status: {
      type: DataTypes.ENUM(
        'pending',
        'approved',
        'rejected',
        'requires_changes'
      ),
      allowNull: false,
      defaultValue: 'pending'
    },
    days_till_completion: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 365
      }
    },
    completion_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    carbon_dioxide_saved: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      validate: {
        min: 1,
        max: 1000000
      },
      comment: 'Amount of CO2 to be saved (in tons)'
    },
    current_price: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: true,
      validate: {
        min: 0.01
      },
      comment: 'Current price per EXC token'
    },
    project_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional project metadata'
    }
  }, {
    tableName: 'projects',
    indexes: [
      {
        unique: true,
        fields: ['blockchain_project_id'],
        where: {
          blockchain_project_id: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      {
        fields: ['company_id']
      },
      {
        fields: ['project_type']
      },
      {
        fields: ['state']
      },
      {
        fields: ['validation_status']
      },
      {
        fields: ['created_at']
      }
    ]
  });

  // Instance methods
  Project.prototype.getAvailableCredits = function() {
    return parseFloat(this.exc_amount) - parseFloat(this.exc_sold);
  };

  Project.prototype.getCompletionPercentage = function() {
    if (!this.exc_amount || this.exc_amount === 0) return 0;
    return (parseFloat(this.exc_sold) / parseFloat(this.exc_amount)) * 100;
  };

  Project.prototype.isAvailableForPurchase = function() {
    return this.state === 'ongoing' && 
           this.validation_status === 'approved' && 
           this.getAvailableCredits() > 0;
  };

  // Associations
  Project.associate = function(models) {
    // Project belongs to a company
    Project.belongsTo(models.Company, {
      foreignKey: 'company_id',
      as: 'company'
    });

    // Project has many documents
    Project.hasMany(models.ProjectDocument, {
      foreignKey: 'project_id',
      as: 'documents'
    });

    // Project has many transactions
    Project.hasMany(models.Transaction, {
      foreignKey: 'project_id',
      as: 'transactions'
    });
  };

  return Project;
};
