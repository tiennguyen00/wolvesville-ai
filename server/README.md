# Wolvesville Server

This is the backend server for the Wolvesville web application, built with Node.js, Express, PostgreSQL, and Socket.io.

## Server Structure

- `index.js` - Main entry point that sets up the Express server and Socket.io
- `config/` - Configuration files for database and other settings
- `controllers/` - Business logic for handling requests
- `models/` - Database models and queries
- `routes/` - API route definitions
- `middleware/` - Express middleware (auth, error handling, etc.)
- `socket/` - Socket.io event handlers
- `utils/` - Utility functions

## Database Structure

The server uses PostgreSQL with the following tables:

- `users` - User accounts with authentication info
- `profiles` - User profiles with customization settings
- `roles` - Game roles (Villager, Werewolf, Seer, etc.)
- `game_sessions` - Game rooms and their settings
- `game_players` - Players in each game session
- `game_events` - Game actions and events
- `chat_messages` - In-game chat messages
- `votes` - Voting records for each game

## Setup Instructions

1. Install PostgreSQL and create a database called `wolvesville`

2. Set up environment variables in `.env` file:

   ```
   PORT=5000
   NODE_ENV=development
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=wolvesville
   DB_PASSWORD=yourpassword
   DB_PORT=5432
   JWT_SECRET=yoursecretkey
   JWT_EXPIRES_IN=7d
   ```

3. Initialize the database:

   ```
   npm run db:init
   ```

4. Start the server:
   ```
   npm run server
   ```

## API Documentation

### User Routes

- `POST /api/users/register` - Register a new user
- `POST /api/users/login` - Login and get JWT token
- `GET /api/users/me` - Get current user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users/stats` - Get user game statistics

### Game Routes

- `POST /api/games` - Create a new game
- `GET /api/games` - Get list of available games
- `GET /api/games/:id` - Get details of a game
- `POST /api/games/:id/join` - Join a game
- `POST /api/games/:id/leave` - Leave a game
- `GET /api/games/:id/events` - Get game events
- `GET /api/games/user/history` - Get user's game history
- `GET /api/games/roles/list` - Get available roles

### Chat Routes

- `GET /api/chat/:sessionId` - Get chat messages for a game session
- `GET /api/chat/:sessionId/history` - Get chat history for a completed game

## Socket.io Events

### Game Namespace (/game)

- `authenticate` - Authenticate user with token
- `join_game` - Join a game session
- `player_ready` - Set player ready status
- `game_action` - Perform game actions (vote, use ability, etc.)
- `leave_game` - Leave a game

### Chat Namespace (/chat)

- `authenticate` - Authenticate user with token
- `send_message` - Send a public message
- `send_whisper` - Send a private message
- `team_chat` - Send a team-specific message (werewolves)
- `react_to_message` - React to a message
