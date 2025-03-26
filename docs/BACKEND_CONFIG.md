# Backend Configuration for Wolvesville

This document outlines the configuration for the Wolvesville backend API running on port 5432.

## Port Configuration

The backend has been configured to run on port 5432 with the following changes:

1. Set `PORT=5432` in `.env` file (already configured)
2. Updated the `server` script in `package.json` to use `--port 5432` flag
3. Confirmed server/index.js uses the environment PORT value which defaults to 5432

## API Service Layer

To ensure consistent API access across the application, we've created the following services:

1. **API Base Service** (`src/services/api.ts`)

   - Configures axios with base URL `http://localhost:5432`
   - Sets up request interceptors for authentication
   - Handles common error responses

2. **User Service** (`src/services/userService.ts`)

   - Handles user registration and login
   - Retrieves user profiles and stats
   - Updates user information

3. **Game Service** (`src/services/gameService.ts`)

   - Lists, creates, and joins games
   - Retrieves game details and events
   - Performs in-game actions

4. **Chat Service** (`src/services/chatService.ts`)
   - Retrieves chat messages
   - Sends new messages
   - Manages message reactions

## Frontend Integration

The frontend has been configured to work with the backend port:

1. Updated Vite proxy configuration in `vite.config.ts` to target port 5432
2. Removed hardcoded API URLs in `AuthContext` and replaced with relative paths that work with the proxy
3. Created a centralized API client with proper error handling

## Running the Application

To run the application with this configuration:

1. Start the backend server:

   ```
   npm run server
   ```

   This will start the Express server on port 5432.

2. Start the frontend development server:
   ```
   npm run dev
   ```
   This will start the Vite dev server with the proxy configured to forward API requests to the backend.

## API Endpoints

All API endpoints are now accessible at:

```
http://localhost:5432/api/...
```

Example endpoints:

- `http://localhost:5432/api/users/register` - Register a new user
- `http://localhost:5432/api/users/login` - User login
- `http://localhost:5432/api/games` - List available games
- `http://localhost:5432/api/chat/{sessionId}` - Get chat messages
