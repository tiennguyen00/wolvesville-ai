const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const { pool, initializeDatabase } = require("./config/mock-db");
const { userRoutes, gameRoutes, chatRoutes } = require("./routes");
const { setupGameSocketHandlers } = require("./socket/gameSocketHandlers");
const { setupChatSocketHandlers } = require("./socket/chatSocketHandlers");
require("dotenv").config();

// Initialize express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN || "*", // Allow all origins in development
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/users", userRoutes);
app.use("/api/games", gameRoutes);
app.use("/api/chat", chatRoutes);

// Socket.io handlers
setupGameSocketHandlers(io);
setupChatSocketHandlers(io);

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to the Wolvesville API" });
});

// Database test connection
app.get("/api/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Database connection successful (Mock DB)",
      timestamp: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection error:", error);
    res.status(500).json({
      message: "Database connection failed",
      error: error.message,
    });
  }
});

// Initialize database on startup
(async () => {
  try {
    console.log("Initializing mock database...");
    await initializeDatabase();
    console.log("Mock database initialized successfully!");
  } catch (error) {
    console.error("Database initialization error:", error);
    console.log(
      "Server will start, but database may not be fully initialized."
    );
  }
})();

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: "Something went wrong!",
    error:
      process.env.NODE_ENV === "development" ? err.message : "Server error",
  });
});

// Start server
const PORT = process.env.PORT || 5432;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
