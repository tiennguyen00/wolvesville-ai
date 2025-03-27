-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create ENUMs for better data integrity
DO $$ BEGIN
    CREATE TYPE account_status_type AS ENUM ('active', 'suspended', 'banned', 'inactive');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE game_status_type AS ENUM ('lobby', 'in_progress', 'completed', 'abandoned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE game_phase_type AS ENUM ('lobby', 'day', 'night', 'voting', 'results');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE game_result_type AS ENUM ('victory', 'defeat', 'draw', 'abandoned');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE chat_type_enum AS ENUM ('public', 'werewolf', 'dead', 'private', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login TIMESTAMPTZ,
  account_status account_status_type NOT NULL DEFAULT 'active',
  verification_status BOOLEAN NOT NULL DEFAULT false
);

-- Roles Table (new)
CREATE TABLE IF NOT EXISTS roles (
  role_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name VARCHAR(50) NOT NULL UNIQUE,
  faction VARCHAR(30) NOT NULL,
  description TEXT NOT NULL,
  ability_description TEXT,
  icon VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Add default roles
INSERT INTO roles (role_name, faction, description, ability_description, icon) VALUES
('Werewolf', 'Werewolves', 'A cunning and powerful werewolf', 'You can transform into a werewolf at night and vote to eliminate a villager', 'https://example.com/werewolf.png'),
('Villager', 'Villagers', 'A simple villager trying to survive', 'You have no special abilities but can vote during the day', 'https://example.com/villager.png'),
('Seer', 'Villagers', 'A mystical villager with psychic abilities', 'You can check one player each night to determine if they are a werewolf', 'https://example.com/seer.png'),
('Doctor', 'Villagers', 'A skilled medical professional', 'You can protect one player each night from being eliminated', 'https://example.com/doctor.png'),
('Hunter', 'Villagers', 'A skilled marksman with a single silver bullet', 'When eliminated, you can immediately take one player with you', 'https://example.com/hunter.png');


-- Items Table (new)
CREATE TABLE IF NOT EXISTS items (
  item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  price_coins INTEGER,
  price_gems INTEGER,
  item_type VARCHAR(30) NOT NULL,
  rarity VARCHAR(20) NOT NULL,
  icon VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Items Table (new)
CREATE TABLE IF NOT EXISTS user_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, item_id)
);

-- Games Table
CREATE TABLE IF NOT EXISTS games (
  game_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_mode VARCHAR(20) NOT NULL DEFAULT 'classic',
  host_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status game_status_type NOT NULL DEFAULT 'lobby',
  max_players INTEGER NOT NULL DEFAULT 12,
  current_phase game_phase_type DEFAULT 'lobby',
  password_protected BOOLEAN NOT NULL DEFAULT false,
  game_password VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  winner_faction VARCHAR(30),
  settings JSONB
);

-- Player Games Table
CREATE TABLE IF NOT EXISTS player_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(role_id) ON DELETE SET NULL,
  is_alive BOOLEAN DEFAULT TRUE,
  result game_result_type,
  eliminations INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  coins_earned INTEGER NOT NULL DEFAULT 0,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, game_id)
);

-- Game Events Table
CREATE TABLE IF NOT EXISTS game_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Game Votes Table (new)
CREATE TABLE IF NOT EXISTS game_votes (
  vote_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  voter_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, 
  target_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  vote_type VARCHAR(20) NOT NULL,
  phase_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(game_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  chat_type chat_type_enum NOT NULL DEFAULT 'public',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Friends Table (new)
CREATE TABLE IF NOT EXISTS friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, friend_id),
  CHECK (user_id <> friend_id)
);

-- Achievements Table
CREATE TABLE IF NOT EXISTS achievements (
  achievement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon VARCHAR(255),
  points INTEGER NOT NULL DEFAULT 10,
  difficulty VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User Achievements Table
CREATE TABLE IF NOT EXISTS user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES achievements(achievement_id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_games_user_id ON player_games(user_id);
CREATE INDEX IF NOT EXISTS idx_player_games_game_id ON player_games(game_id);
CREATE INDEX IF NOT EXISTS idx_player_games_role_id ON player_games(role_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_games_ended_at ON games(ended_at);
CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events(game_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_game_id ON chat_messages(game_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_user_id ON friends(user_id);
CREATE INDEX IF NOT EXISTS idx_friends_friend_id ON friends(friend_id);
CREATE INDEX IF NOT EXISTS idx_game_votes_game_id ON game_votes(game_id);


-- Add triggers for updated_at fields
CREATE OR REPLACE FUNCTION update_modified_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW; 
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_users_modtime
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column();

CREATE TRIGGER update_friends_modtime
    BEFORE UPDATE ON friends
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_column(); 