const { sequelize } = require('../config/database');

// Import all models
const User = require('./User');
const Company = require('./Company');
const Project = require('./Project');
const Transaction = require('./Transaction');
const Validator = require('./Validator');
const ProjectDocument = require('./ProjectDocument');

// Initialize models with sequelize instance
const models = {
  User: User(sequelize),
  Company: Company(sequelize),
  Project: Project(sequelize),
  Transaction: Transaction(sequelize),
  Validator: Validator(sequelize),
  ProjectDocument: ProjectDocument(sequelize)
};

// Export models and sequelize instance
module.exports = {
  ...models,
  sequelize
};
