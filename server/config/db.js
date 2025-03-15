const { Pool } = require("pg");
require("dotenv").config();

// PostgreSQL connection configuration
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "wolvesville",
  password: process.env.DB_PASSWORD || "postgres",
  port: process.env.DB_PORT || 5432,
});

// Test database connection
pool.on("connect", () => {
  console.log("Connected to PostgreSQL database");
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
  process.exit(-1);
});

// Function to initialize database with required tables
const initializeDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log("Initializing database...");

    // Start transaction
    await client.query("BEGIN");

    // Create extension for UUID generation if it doesn't exist
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "pgcrypto";
    `);

    // Create Users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(30) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login TIMESTAMP,
        account_status VARCHAR(20) NOT NULL DEFAULT 'active',
        verification_status BOOLEAN NOT NULL DEFAULT false,
        experience_points INTEGER NOT NULL DEFAULT 0,
        gold_coins INTEGER NOT NULL DEFAULT 100,
        gems INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Create Profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS profiles (
        profile_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
        display_name VARCHAR(30),
        bio TEXT,
        country_code VARCHAR(2),
        preferred_roles JSONB DEFAULT '[]'::JSONB,
        stats JSONB DEFAULT '{}'::JSONB,
        achievements JSONB DEFAULT '[]'::JSONB,
        settings JSONB DEFAULT '{}'::JSONB
      );
    `);

    // Create Roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(50) NOT NULL UNIQUE,
        description TEXT NOT NULL,
        team VARCHAR(20) NOT NULL,
        category VARCHAR(30) NOT NULL,
        ability_type VARCHAR(30),
        ability_target VARCHAR(30),
        icon_url VARCHAR(255),
        enabled BOOLEAN NOT NULL DEFAULT true
      );
    `);

    // Create Game Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        game_mode VARCHAR(20) NOT NULL DEFAULT 'classic',
        status VARCHAR(20) NOT NULL DEFAULT 'lobby',
        current_phase VARCHAR(20) DEFAULT 'lobby',
        current_day INTEGER DEFAULT 0,
        max_players INTEGER NOT NULL DEFAULT 12,
        password_protected BOOLEAN NOT NULL DEFAULT false,
        password_hash VARCHAR(255),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        started_at TIMESTAMP,
        ended_at TIMESTAMP,
        host_user_id UUID REFERENCES users(user_id),
        settings JSONB DEFAULT '{}'::JSONB
      );
    `);

    // Create Game Players table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_players (
        player_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES game_sessions(session_id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(user_id),
        role_id UUID REFERENCES roles(role_id),
        is_alive BOOLEAN NOT NULL DEFAULT true,
        team VARCHAR(20),
        join_time TIMESTAMP NOT NULL DEFAULT NOW(),
        death_time TIMESTAMP,
        death_cause VARCHAR(100),
        position INTEGER,
        temporary_effects JSONB DEFAULT '[]'::JSONB,
        vote_history JSONB DEFAULT '[]'::JSONB,
        UNIQUE(session_id, user_id)
      );
    `);

    // Create Game Events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS game_events (
        event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES game_sessions(session_id) ON DELETE CASCADE,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB NOT NULL DEFAULT '{}'::JSONB,
        initiator_id UUID REFERENCES game_players(player_id),
        target_ids UUID[] DEFAULT '{}',
        phase VARCHAR(20) NOT NULL,
        day_number INTEGER NOT NULL,
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        is_public BOOLEAN NOT NULL DEFAULT true
      );
    `);

    // Create Chat Messages table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES game_sessions(session_id) ON DELETE CASCADE,
        sender_id UUID REFERENCES game_players(player_id),
        message_type VARCHAR(20) NOT NULL DEFAULT 'public',
        content TEXT NOT NULL,
        recipient_id UUID REFERENCES game_players(player_id),
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        is_censored BOOLEAN NOT NULL DEFAULT false,
        reactions JSONB DEFAULT '{}'::JSONB
      );
    `);

    // Create Votes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS votes (
        vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES game_sessions(session_id) ON DELETE CASCADE,
        day_number INTEGER NOT NULL,
        voter_id UUID NOT NULL REFERENCES game_players(player_id),
        target_id UUID REFERENCES game_players(player_id),
        vote_type VARCHAR(20) NOT NULL DEFAULT 'lynch',
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        changed_count INTEGER NOT NULL DEFAULT 0
      );
    `);

    // Insert default roles if they don't exist
    await client.query(`
      INSERT INTO roles (name, description, team, category, ability_type, ability_target)
      VALUES 
        ('Villager', 'A regular villager with no special abilities. Win by eliminating all werewolves.', 'villager', 'vanilla', NULL, NULL),
        ('Werewolf', 'A werewolf who can eliminate one villager each night. Win by outnumbering the villagers.', 'werewolf', 'killer', 'kill', 'single'),
        ('Seer', 'A villager who can check one player each night to learn if they are a werewolf or not.', 'villager', 'investigative', 'investigate', 'single')
      ON CONFLICT (name) DO NOTHING;
    `);

    // Commit transaction
    await client.query("COMMIT");
    console.log("Database initialized successfully");
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("Error initializing database:", error);
    throw error;
  } finally {
    // Release client back to pool
    client.release();
  }
};

module.exports = {
  pool,
  initializeDatabase,
};
