# Wolvesville Frontend

This document provides information about the frontend implementation for the Wolvesville web application.

## Frontend Structure

We've set up a React TypeScript application with the following pages and features:

### Pages

- **Home**: Landing page with game features and call-to-action buttons
- **Login**: User authentication page
- **Register**: New user registration page
- **Dashboard**: User dashboard showing game options, stats, and recent games
- **NotFound**: 404 page for handling invalid routes

### Components and Structure

- **AuthContext**: Manages user authentication state and provides auth functions
- **ProtectedRoute**: Ensures users are authenticated before accessing certain routes

### Tech Stack

- React with TypeScript
- React Router for navigation
- TailwindCSS for styling
- Axios for API requests
- Vite as the build tool and development server

## Running the Application

To run the application in development mode:

1. Start the backend server:

   ```
   npm run server
   ```

2. In a separate terminal, start the frontend:

   ```
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:3000`

## Features Implemented

### Authentication Flow

- User registration with validation
- Login with error handling
- Protected routes for authenticated users
- JWT token management

### UI Components

- Responsive navigation
- Modern card-based layouts
- Form components with validation
- Loading states and animations
- Mobile-friendly design

### Styling

- Custom Tailwind configuration
- Themed colors for Wolvesville
- Custom component classes
- Animation effects

## Next Steps

1. **Game Browser Implementation**

   - List of available games
   - Filtering and sorting options
   - Game details modal

2. **Game Creation Interface**

   - Game settings form
   - Role selection
   - Custom rules configuration

3. **In-Game UI**

   - Game board interface
   - Player cards and interactions
   - Chat system integration
   - Day/night cycle visualization

4. **Profile Page**
   - User statistics
   - Achievement tracking
   - Game history
   - Friends list
