# Game Session Management Flow

## Overview

This document details the game session management flows, including game creation, lobby management, and player interactions.

## 1. Game Creation Flow

```mermaid
sequenceDiagram
    participant Host as Host (User)
    participant API as Game Server
    participant Auth as Auth Service
    participant DB as Database
    participant Socket as Socket Server

    Host->>API: POST /api/games/create
    Note over Host,API: {game_mode, max_players, password?}

    API->>Auth: Verify JWT Token
    Auth-->>API: Token Valid

    API->>DB: Create Game Session
    DB-->>API: Game Created

    API->>Socket: Broadcast New Game
    Socket-->>Host: Game Created Event

    API-->>Host: 201 Created
    Note over API,Host: {game_id, settings, host_info}

    Host->>Socket: Join Game Room
    Socket->>DB: Update Host Connection
    DB-->>Socket: Connection Updated
    Socket-->>Host: Room Joined
```

## 2. Game Lobby Management Flow

```mermaid
sequenceDiagram
    participant Player as Player
    participant API as Game Server
    participant Auth as Auth Service
    participant DB as Database
    participant Socket as Socket Server
    participant Host as Host

    Player->>API: GET /api/games/list
    API-->>Player: Available Games List

    Player->>API: POST /api/games/:id/join
    Note over Player,API: {password? (if protected)}

    API->>Auth: Verify JWT Token
    Auth-->>API: Token Valid

    API->>DB: Check Game Status
    DB-->>API: Game Status

    alt Game Full
        API-->>Player: 400 Game Full
    else Game Started
        API-->>Player: 400 Game Already Started
    else Password Protected
        alt Invalid Password
            API-->>Player: 401 Invalid Password
        end
    else Can Join
        API->>DB: Add Player to Game
        DB-->>API: Player Added

        API->>Socket: Broadcast Player Joined
        Socket-->>Host: Player Joined Event
        Socket-->>Player: Joined Successfully
        Socket-->>Socket: Broadcast Updated Player List

        API-->>Player: 200 OK
        Note over API,Player: {game_info, players_list}
    end
```

## 3. Host Controls Flow

```mermaid
sequenceDiagram
    participant Host as Host
    participant API as Game Server
    participant Auth as Auth Service
    participant DB as Database
    participant Socket as Socket Server
    participant Players as Players

    Host->>API: Various Control Actions
    Note over Host,API: Start Game, Kick Player, Update Settings

    API->>Auth: Verify Host Permissions
    Auth-->>API: Host Verified

    alt Start Game
        API->>DB: Update Game Status
        DB-->>API: Game Started
        API->>Socket: Broadcast Game Start
        Socket-->>Players: Game Started Event
        Socket-->>Host: Game Started Confirmation
    else Kick Player
        API->>DB: Remove Player
        DB-->>API: Player Removed
        API->>Socket: Broadcast Player Kicked
        Socket-->>Players: Player List Updated
        Socket-->>Host: Kick Confirmed
    else Update Settings
        API->>DB: Update Game Settings
        DB-->>API: Settings Updated
        API->>Socket: Broadcast Settings Update
        Socket-->>Players: Settings Updated Event
        Socket-->>Host: Update Confirmed
    end
```

## 4. Player Management Flow

```mermaid
sequenceDiagram
    participant Player as Player
    participant API as Game Server
    participant Socket as Socket Server
    participant DB as Database
    participant Players as Other Players
    participant Host as Host

    alt Player Leaves Voluntarily
        Player->>API: POST /api/games/:id/leave
        API->>DB: Remove Player
        DB-->>API: Player Removed
        API->>Socket: Broadcast Player Left
        Socket-->>Players: Player List Updated
        Socket-->>Host: Player Left Event
    else Player Disconnects
        Socket->>DB: Detect Disconnection
        DB->>DB: Start Reconnection Timer

        alt Reconnects within Time
            Player->>Socket: Reconnect
            Socket->>DB: Restore Connection
            DB-->>Socket: Connection Restored
            Socket-->>Player: Game State Sync
        else Timeout
            DB->>DB: Remove Player
            Socket->>Players: Player Removed Event
            Socket->>Host: Player Timeout Event
        end
    end
```

## Implementation Details

### Game States

1. LOBBY - Initial state, players can join/leave
2. STARTING - Brief transition state when game is about to begin
3. IN_PROGRESS - Game is ongoing
4. FINISHED - Game has ended

### Security Measures

1. Host authentication for control actions
2. Password protection for private games
3. Player limit enforcement
4. Anti-cheat measures for disconnections
5. Rate limiting for join/leave actions

### Error Handling

- Game Full: 400 Bad Request
- Invalid Password: 401 Unauthorized
- Game Not Found: 404 Not Found
- Not Host: 403 Forbidden
- Server Error: 500 Internal Server Error

### Best Practices

1. Graceful handling of disconnections
2. Real-time state synchronization
3. Host migration capabilities
4. Game state persistence
5. Proper cleanup of abandoned games

## Common User Guide

### Creating a Game

1. Click "Create Game" button
2. Choose game settings:
   - Select game mode
   - Set maximum players (8-15)
   - Optional: Set password for private game
3. Click "Create" to start the lobby

### Joining a Game

1. Browse available games in the list
2. Click "Join" on your chosen game
3. Enter password if required
4. Wait in lobby for game to start

### Host Controls

As a host, you can:

- Start the game when enough players join
- Kick inactive or disruptive players
- Update game settings before start
- Transfer host status to another player

### Player Actions

As a player, you can:

- Join/Leave games freely in lobby
- See other players' status
- Chat in game lobby
- Ready up for game start
- Reconnect if disconnected
