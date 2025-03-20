-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(30) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  bio TEXT,
  avatar VARCHAR(255),
  experience_points INTEGER NOT NULL DEFAULT 0,
  gold_coins INTEGER NOT NULL DEFAULT 100,
  gems INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_login TIMESTAMP,
  account_status VARCHAR(20) NOT NULL DEFAULT 'active',
  verification_status BOOLEAN NOT NULL DEFAULT false
);

-- Games Table
CREATE TABLE IF NOT EXISTS games (
  game_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_mode VARCHAR(20) NOT NULL DEFAULT 'classic',
  host_id UUID NOT NULL REFERENCES users(user_id),
  status VARCHAR(20) NOT NULL DEFAULT 'lobby',
  max_players INTEGER NOT NULL DEFAULT 12,
  current_phase VARCHAR(20) DEFAULT 'lobby',
  password_protected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at TIMESTAMP,
  ended_at TIMESTAMP
);

-- Player Games Table
CREATE TABLE IF NOT EXISTS player_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  game_id UUID NOT NULL REFERENCES games(game_id),
  role VARCHAR(50) NOT NULL,
  result VARCHAR(20) CHECK (result IN ('victory', 'defeat', 'draw', 'abandoned')),
  eliminations INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  played_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Game Events Table
CREATE TABLE IF NOT EXISTS game_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(game_id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(game_id),
  user_id UUID REFERENCES users(user_id),
  message TEXT NOT NULL,
  chat_type VARCHAR(20) NOT NULL DEFAULT 'public',
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
  achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User Achievements Table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  achievement_id UUID NOT NULL REFERENCES achievements(achievement_id),
  unlocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_games_user_id ON player_games(user_id);
CREATE INDEX IF NOT EXISTS idx_player_games_game_id ON player_games(game_id);
CREATE INDEX IF NOT EXISTS idx_player_games_role ON player_games(role);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_games_ended_at ON games(ended_at); 