# Wolvesville Web Application

A real-time social deduction game where players secretly become villagers or werewolves. Through strategic discussion, voting, and unique abilities, villagers must identify the werewolves before being outnumbered, while werewolves attempt to remain hidden and eliminate the village.

## Features (MVP for 1-month Demo)

- User authentication and basic profiles
- Game lobby creation and management
- Core role implementation (Villager, Werewolf, Seer)
- Day/night cycle gameplay
- In-game chat system
- Voting mechanics
- Win condition evaluation

## Tech Stack

- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL
- Real-time Communication: Socket.io
- Authentication: JWT
- Styling: Tailwind CSS

## Project Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables
4. Start the development server:
   ```bash
   npm run dev
   ```

## Development Timeline

- Week 1: User authentication and game session creation
- Week 2: Role assignment and game cycle management
- Week 3: Chat system and voting mechanics
- Week 4: Win conditions and UI polish

## Project Structure

```
src/
├── components/       # Reusable UI components
├── pages/            # Main application pages
├── services/         # API services and business logic
├── context/          # React context for state management
└── utils/            # Utility functions and helpers
```
