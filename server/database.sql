-- Database: wolvesville

-- Drop database if it exists
DROP DATABASE IF EXISTS wolvesville;

-- Create database
CREATE DATABASE wolvesville;

-- Connect to database
\c wolvesville;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users Table
CREATE TABLE users (
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
CREATE TABLE games (
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
CREATE TABLE player_games (
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
CREATE TABLE game_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(game_id),
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE chat_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(game_id),
  user_id UUID REFERENCES users(user_id),
  message TEXT NOT NULL,
  chat_type VARCHAR(20) NOT NULL DEFAULT 'public',
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Achievements Table
CREATE TABLE achievements (
  achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- User Achievements Table
CREATE TABLE user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id),
  achievement_id UUID NOT NULL REFERENCES achievements(achievement_id),
  unlocked_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Insert initial achievements
INSERT INTO achievements (name, description, icon) VALUES
  ('First Win', 'Win your first game', '/icons/achievements/first-win.png'),
  ('Wolf Pack', 'Win 5 games as a Werewolf', '/icons/achievements/wolf-pack.png'),
  ('Village Hero', 'Save a villager from the werewolves', '/icons/achievements/village-hero.png'),
  ('Perfect Detective', 'Correctly identify 3 werewolves in one game', '/icons/achievements/detective.png'),
  ('Mastermind', 'Win 10 games in a row', '/icons/achievements/mastermind.png');

-- Create indexes for performance
CREATE INDEX idx_player_games_user_id ON player_games(user_id);
CREATE INDEX idx_player_games_game_id ON player_games(game_id);
CREATE INDEX idx_player_games_role ON player_games(role);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_created_at ON games(created_at);
CREATE INDEX idx_games_ended_at ON games(ended_at);

-- Create database views for common queries
CREATE VIEW user_stats AS
SELECT
  u.user_id,
  u.username,
  COUNT(DISTINCT pg.game_id) as total_games,
  SUM(CASE WHEN pg.result = 'victory' THEN 1 ELSE 0 END) as games_won,
  CASE 
    WHEN COUNT(DISTINCT pg.game_id) > 0 
    THEN ROUND((SUM(CASE WHEN pg.result = 'victory' THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT pg.game_id)), 1)
    ELSE 0
  END as win_rate
FROM users u
LEFT JOIN player_games pg ON u.user_id = pg.user_id
GROUP BY u.user_id, u.username;

-- Create a function to get user's most played role
CREATE OR REPLACE FUNCTION get_most_played_role(user_uuid UUID)
RETURNS TABLE (role VARCHAR, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT pg.role, COUNT(*) as count
  FROM player_games pg
  WHERE pg.user_id = user_uuid
  GROUP BY pg.role
  ORDER BY count DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to update user experience
CREATE OR REPLACE FUNCTION update_user_experience() 
RETURNS TRIGGER AS $$
BEGIN
  UPDATE users
  SET experience_points = experience_points + NEW.xp_earned
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update user experience on game completion
CREATE TRIGGER trigger_update_user_experience
AFTER INSERT ON player_games
FOR EACH ROW
EXECUTE FUNCTION update_user_experience(); 