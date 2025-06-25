const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ProjectDocument = sequelize.define('ProjectDocument', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    project_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
      validate: {
        len: [1, 200],
        notEmpty: true
      }
    },
    type: {
      type: DataTypes.ENUM(
        'project_plan',
        'environmental_impact',
        'verification_report',
        'financial_statement',
        'certification',
        'other'
      ),
      allowNull: false
    },
    file_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 10485760 // 10MB max
      }
    },
    mime_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        isIn: [[
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/gif',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ]]
      }
    },
    ipfs_hash: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
      comment: 'IPFS hash for decentralized storage'
    },
    file_path: {
      type: DataTypes.STRING(500),
      allowNull: true,
      comment: 'Local file path as backup'
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Whether document is publicly accessible'
    },
    uploaded_by: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    upload_date: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    verification_status: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected'),
      allowNull: false,
      defaultValue: 'pending'
    },
    verified_by: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    document_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Additional document metadata'
    }
  }, {
    tableName: 'project_documents',
    indexes: [
      {
        fields: ['project_id']
      },
      {
        fields: ['type']
      },
      {
        unique: true,
        fields: ['ipfs_hash'],
        where: {
          ipfs_hash: {
            [sequelize.Sequelize.Op.ne]: null
          }
        }
      },
      {
        fields: ['uploaded_by']
      },
      {
        fields: ['verification_status']
      },
      {
        fields: ['upload_date']
      }
    ]
  });

  // Instance methods
  ProjectDocument.prototype.getFileUrl = function() {
    if (this.ipfs_hash) {
      return `https://ipfs.io/ipfs/${this.ipfs_hash}`;
    }
    return null;
  };

  ProjectDocument.prototype.isImage = function() {
    return this.mime_type.startsWith('image/');
  };

  ProjectDocument.prototype.isPDF = function() {
    return this.mime_type === 'application/pdf';
  };

  ProjectDocument.prototype.getFileExtension = function() {
    return this.file_name.split('.').pop().toLowerCase();
  };

  ProjectDocument.prototype.markAsVerified = function(verifierId) {
    this.verification_status = 'verified';
    this.verified_by = verifierId;
    this.verified_at = new Date();
    return this.save();
  };

  ProjectDocument.prototype.markAsRejected = function(verifierId) {
    this.verification_status = 'rejected';
    this.verified_by = verifierId;
    this.verified_at = new Date();
    return this.save();
  };

  // Class methods
  ProjectDocument.findByProject = function(projectId) {
    return this.findAll({
      where: { project_id: projectId },
      order: [['upload_date', 'DESC']]
    });
  };

  ProjectDocument.findPublicDocuments = function(projectId) {
    return this.findAll({
      where: { 
        project_id: projectId,
        is_public: true,
        verification_status: 'verified'
      },
      order: [['upload_date', 'DESC']]
    });
  };

  // Associations
  ProjectDocument.associate = function(models) {
    // Document belongs to a project
    ProjectDocument.belongsTo(models.Project, {
      foreignKey: 'project_id',
      as: 'project'
    });

    // Document uploaded by a user
    ProjectDocument.belongsTo(models.User, {
      foreignKey: 'uploaded_by',
      as: 'uploader'
    });

    // Document verified by a user (validator)
    ProjectDocument.belongsTo(models.User, {
      foreignKey: 'verified_by',
      as: 'verifier'
    });
  };

  return ProjectDocument;
};
