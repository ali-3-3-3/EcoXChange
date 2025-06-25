const { Sequelize } = require("sequelize");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

const sequelize = new Sequelize({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "ecoxchange_dev",
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
  dialect: "postgres",
  logging: process.env.NODE_ENV === "development" ? console.log : false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
  },
});

// Test database connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log("✅ Database connection established successfully.");
  } catch (error) {
    console.error("❌ Unable to connect to the database:", error);
    throw error;
  }
};

// Initialize database with models
const initializeDatabase = async () => {
  try {
    await testConnection();

    // Import all models
    const models = require("../models");

    // Set up associations
    Object.keys(models).forEach((modelName) => {
      if (models[modelName].associate) {
        models[modelName].associate(models);
      }
    });

    // Sync all models
    await sequelize.sync({
      alter: process.env.NODE_ENV === "development",
      force: process.env.DB_FORCE_SYNC === "true",
    });
    console.log("✅ Database synchronized successfully.");

    return models;
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
    throw error;
  }
};

module.exports = {
  sequelize,
  testConnection,
  initializeDatabase,
};
