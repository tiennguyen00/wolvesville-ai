require("dotenv").config();
const { initializeDatabase } = require("./config/db");

// Run the database initialization
(async () => {
  try {
    console.log("Starting database initialization...");
    await initializeDatabase();
    console.log("Database initialization completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
})();
