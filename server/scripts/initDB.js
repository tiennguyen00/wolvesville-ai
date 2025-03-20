const { pool, initializeDatabase } = require("../config/db");
const fs = require("fs");
const path = require("path");
const { Client } = require("pg");
require("dotenv").config();

// Function to execute database.sql file
async function setupDatabase() {
  try {
    console.log("Starting database initialization...");

    // Connect to postgres to create the database
    const client = new Client({
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: "postgres", // Connect to default postgres database
      password: process.env.DB_PASSWORD || "postgres",
      port: process.env.DB_PORT || 5432,
    });

    await client.connect();
    console.log("Connected to PostgreSQL");

    // Check if database exists
    const dbCheckResult = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME || "wolvesville"]
    );

    // Create database if it doesn't exist
    if (dbCheckResult.rows.length === 0) {
      console.log(`Creating database: ${process.env.DB_NAME || "wolvesville"}`);
      await client.query(
        `CREATE DATABASE ${process.env.DB_NAME || "wolvesville"}`
      );
    } else {
      console.log(
        `Database ${process.env.DB_NAME || "wolvesville"} already exists`
      );
    }

    await client.end();

    // Now connect to the created database and run the schema
    const dbClient = new Client({
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "wolvesville",
      password: process.env.DB_PASSWORD || "postgres",
      port: process.env.DB_PORT || 5432,
    });

    await dbClient.connect();
    console.log(
      `Connected to ${process.env.DB_NAME || "wolvesville"} database`
    );

    // Run database schema from database.sql
    const schemaFile = path.join(__dirname, "..", "database.sql");

    // Skip the first few lines that have DROP/CREATE DATABASE statements
    const sql = fs
      .readFileSync(schemaFile, "utf8")
      .split("\n")
      .filter(
        (line) =>
          !line.includes("DROP DATABASE") &&
          !line.includes("CREATE DATABASE") &&
          !line.includes("\\c")
      );

    console.log("Running database schema...");
    await dbClient.query(sql.join("\n"));

    console.log("Database schema applied successfully");

    // Insert demo data
    console.log("Inserting demo data...");
    await insertDemoData(dbClient);

    await dbClient.end();
    console.log("Database initialization completed");
  } catch (error) {
    console.error("Error initializing database:", error);
    process.exit(1);
  }
}

// Insert demo data for testing
async function insertDemoData(client) {
  try {
    // Create demo users
    const userPassword = await require("bcryptjs").hash("password123", 10);

    const users = [
      { username: "demo", email: "demo@example.com", password: userPassword },
      {
        username: "player1",
        email: "player1@example.com",
        password: userPassword,
      },
      {
        username: "player2",
        email: "player2@example.com",
        password: userPassword,
      },
      {
        username: "player3",
        email: "player3@example.com",
        password: userPassword,
      },
      {
        username: "player4",
        email: "player4@example.com",
        password: userPassword,
      },
    ];

    for (const user of users) {
      await client.query(
        "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING",
        [user.username, user.email, user.password]
      );
    }

    console.log("Demo users created");

    // Get demo user id
    const demoUser = await client.query(
      "SELECT user_id FROM users WHERE email = $1",
      ["demo@example.com"]
    );
    const demoUserId = demoUser.rows[0].user_id;

    // Create demo games
    const gameModels = ["classic", "quick", "custom", "ranked", "custom"];
    let gameIds = [];

    for (let i = 0; i < 5; i++) {
      const result = await client.query(
        `INSERT INTO games 
          (game_mode, host_id, status, max_players, current_phase, created_at, started_at, ended_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING game_id`,
        [
          gameModels[i % gameModels.length],
          demoUserId,
          "completed",
          12,
          "ended",
          new Date(Date.now() - (10 - i) * 86400000), // Different dates in the past
          new Date(Date.now() - (10 - i) * 86400000 + 3600000), // Start time
          new Date(Date.now() - (10 - i) * 86400000 + 7200000), // End time
        ]
      );
      gameIds.push(result.rows[0].game_id);
    }

    console.log("Demo games created");

    // Create demo player games
    const roles = ["Villager", "Werewolf", "Seer", "Doctor", "Hunter"];
    const results = ["victory", "defeat", "victory", "victory", "defeat"];

    for (let i = 0; i < gameIds.length; i++) {
      await client.query(
        `INSERT INTO player_games 
         (user_id, game_id, role, result, eliminations, xp_earned) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          demoUserId,
          gameIds[i],
          roles[i],
          results[i],
          Math.floor(Math.random() * 3),
          Math.floor(Math.random() * 100) + 50,
        ]
      );
    }

    console.log("Demo player games created");

    // Create demo achievements for the user
    const achievements = await client.query(
      "SELECT achievement_id FROM achievements LIMIT 3"
    );

    for (const achievement of achievements.rows) {
      await client.query(
        `INSERT INTO user_achievements (user_id, achievement_id) VALUES ($1, $2)
         ON CONFLICT (user_id, achievement_id) DO NOTHING`,
        [demoUserId, achievement.achievement_id]
      );
    }

    console.log("Demo achievements assigned");
  } catch (error) {
    console.error("Error inserting demo data:", error);
    throw error;
  }
}

// Run the setup
setupDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error in script execution:", err);
    process.exit(1);
  });
