const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config();

async function main() {
  try {
    // Create a connection pool
    const pool = new Pool({
      user: process.env.DB_USER || "postgres",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "wolvesville",
      password: process.env.DB_PASSWORD || "postgres",
      port: process.env.DB_PORT || 5432,
    });

    console.log("Connected to PostgreSQL database");

    // First execute the schema SQL file
    const schemaFile = path.join(__dirname, "db-setup.sql");
    const schemaSql = fs.readFileSync(schemaFile, "utf8");
    console.log("Executing schema SQL...");
    await pool.query(schemaSql);
    console.log("Schema created successfully");

    // Create demo data
    // 1. Create a demo user
    const hashedPassword = await bcrypt.hash("password123", 10);
    const insertUserResult = await pool.query(
      `INSERT INTO users (username, email, password_hash, bio, avatar, gold_coins, gems) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       ON CONFLICT (email) DO UPDATE 
       SET username = EXCLUDED.username, 
           bio = EXCLUDED.bio,
           avatar = EXCLUDED.avatar
       RETURNING user_id`,
      [
        "demouser",
        "demo@example.com",
        hashedPassword,
        "I am a demo user for the Wolvesville app!",
        "https://via.placeholder.com/150",
        1000,
        50,
      ]
    );

    console.log("Demo user created");
    const demoUserId = insertUserResult.rows[0].user_id;

    // 2. Insert some achievements
    const achievements = [
      {
        name: "First Win",
        description: "Win your first game",
        icon: "/icons/achievements/first-win.png",
      },
      {
        name: "Wolf Pack",
        description: "Win 5 games as a Werewolf",
        icon: "/icons/achievements/wolf-pack.png",
      },
      {
        name: "Village Hero",
        description: "Save a villager from the werewolves",
        icon: "/icons/achievements/village-hero.png",
      },
      {
        name: "Perfect Detective",
        description: "Correctly identify 3 werewolves in one game",
        icon: "/icons/achievements/detective.png",
      },
      {
        name: "Mastermind",
        description: "Win 10 games in a row",
        icon: "/icons/achievements/mastermind.png",
      },
    ];

    for (const achievement of achievements) {
      await pool.query(
        `INSERT INTO achievements (name, description, icon) 
         VALUES ($1, $2, $3) 
         ON CONFLICT (name) DO NOTHING`,
        [achievement.name, achievement.description, achievement.icon]
      );
    }
    console.log("Achievements created");

    // 3. Create some game sessions
    const gameModes = ["classic", "quick", "custom", "ranked", "custom"];
    const gameIds = [];

    for (let i = 0; i < 5; i++) {
      const result = await pool.query(
        `INSERT INTO games (game_mode, host_id, status, max_players, current_phase, created_at, started_at, ended_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING game_id`,
        [
          gameModes[i % gameModes.length],
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
    console.log("Game sessions created");

    // 4. Create player games (participation records)
    const roles = ["Villager", "Werewolf", "Seer", "Doctor", "Hunter"];
    const results = ["victory", "defeat", "victory", "victory", "defeat"];

    for (let i = 0; i < gameIds.length; i++) {
      await pool.query(
        `INSERT INTO player_games (user_id, game_id, role, result, eliminations, xp_earned)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, game_id) DO NOTHING`,
        [
          demoUserId,
          gameIds[i],
          roles[i % roles.length],
          results[i % results.length],
          Math.floor(Math.random() * 3),
          Math.floor(Math.random() * 100) + 50,
        ]
      );
    }
    console.log("Player game records created");

    // 5. Create some chat messages
    for (let i = 0; i < gameIds.length; i++) {
      await pool.query(
        `INSERT INTO chat_messages (game_id, user_id, message, chat_type)
         VALUES ($1, $2, $3, $4)`,
        [
          gameIds[i],
          demoUserId,
          `This is a test message in game ${i + 1}`,
          "public",
        ]
      );
    }
    console.log("Chat messages created");

    // 6. Assign achievements to the demo user
    const achievementResults = await pool.query(
      "SELECT achievement_id FROM achievements LIMIT 3"
    );

    for (const achievement of achievementResults.rows) {
      await pool.query(
        `INSERT INTO user_achievements (user_id, achievement_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, achievement_id) DO NOTHING`,
        [demoUserId, achievement.achievement_id]
      );
    }
    console.log("Achievements assigned to demo user");

    console.log("Demo data setup complete!");
    console.log("You can now login with:");
    console.log("Email: demo@example.com");
    console.log("Password: password123");

    await pool.end();
  } catch (error) {
    console.error("Error setting up demo data:", error);
    process.exit(1);
  }
}

main();
