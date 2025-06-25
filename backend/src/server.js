const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

// Load environment variables from the correct path
require("dotenv").config({ path: path.join(__dirname, "../.env") });

// Import middleware
const {
  globalErrorHandler,
  handleNotFound,
} = require("./middleware/errorHandler");
const {
  generalLimiter,
  sanitizeInput,
  detectSuspiciousActivity,
  securityHeaders,
} = require("./middleware/security");

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for accurate IP addresses
app.set("trust proxy", 1);

// Security headers
app.use(securityHeaders);

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // We set our own CSP
    crossOriginEmbedderPolicy: false,
  })
);

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);

// Rate limiting
app.use(generalLimiter);

// Logging
app.use(morgan("combined"));

// Body parsing middleware
app.use(
  express.json({
    limit: process.env.MAX_FILE_SIZE || "10mb",
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.MAX_FILE_SIZE || "10mb",
  })
);

// Security middleware
app.use(sanitizeInput);
app.use(detectSuspiciousActivity);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// API routes (will be added later)
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/projects", require("./routes/projects"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/validators", require("./routes/validators"));

// 404 handler for undefined routes
app.use("*", handleNotFound);

// Global error handling middleware
app.use(globalErrorHandler);

// Initialize database and start server
const { initializeDatabase } = require("./config/database");
const { contractService } = require("./services/ContractService");
const { transactionMonitor } = require("./services/TransactionMonitor");
const { logConfigStatus, validateEnvironment } = require("./config");

const startServer = async () => {
  try {
    // Log configuration status
    logConfigStatus();

    // Validate environment
    const envValidation = validateEnvironment();
    if (!envValidation.valid) {
      console.warn("⚠️ Environment validation issues detected:");
      envValidation.issues.forEach((issue) => console.warn(`   - ${issue}`));
    }

    // Initialize database
    await initializeDatabase();

    // Initialize blockchain services
    try {
      await contractService.initialize();
      await transactionMonitor.startMonitoring();
      console.log("✅ Blockchain services initialized");
    } catch (error) {
      console.warn(
        "⚠️ Blockchain services failed to initialize:",
        error.message
      );
      console.warn("⚠️ Server will continue without blockchain functionality");
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 EcoXChange Backend Server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN}`);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
