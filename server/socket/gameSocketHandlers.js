const { pool } = require("../config/db");
const { Game } = require("../models/game");
const SOCKET_EVENTS = require("../constants/socketEvents");

// Map to store active games and their connected players
const activeGames = new Map();

// Add a way to store/lookup socket connections by userId
const userSockets = new Map(); // Map userId -> socket

// Setup game-related socket event handlers
const setupGameSocketHandlers = (io) => {
  // Create a namespace for game-related events
  const gameNamespace = io.of("/game");

  gameNamespace.on(SOCKET_EVENTS.CONNECT, (socket) => {
    // Track user data
    let userId = null;
    let gameId = null;

    // Authenticate user (should be called first)
    socket.on(SOCKET_EVENTS.AUTHENTICATED, async (data) => {
      try {
        const { user_id, token } = data;
        userId = user_id;
        console.log(`User ${userId} authenticated on socket ${socket.id}`);
        userSockets.set(data.user_id, socket);
      } catch (error) {
        console.error("Connection error:", error);
      }
    });

    // Handle game creation broadcast
    socket.on(SOCKET_EVENTS.CREATE_GAME, async (data) => {
      console.log("CREATE_GAME SOCKET HANDLER");
      try {
        const { game_id, settings, host_info } = data;
        gameId = game_id;

        // Add game to active games map
        activeGames.set(gameId, {
          players: new Set([host_info.user_id]),
          game: { ...settings, host_id: host_info.user_id },
        });

        // Join the game room
        socket.join(`game:${gameId}`);

        // Broadcast new game to all connected clients
        gameNamespace.emit(SOCKET_EVENTS.GAME_CREATED, {
          game_id: gameId,
          settings,
          host_info,
        });

        console.log(`Game ${gameId} created by host ${host_info.user_id}`);
      } catch (error) {
        console.error("Error in game creation:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    });

    // Player is ready to start the game
    socket.on("player_ready", async () => {
      try {
        if (!gameId || !userId) {
          throw new Error("Not authenticated or not in a game");
        }

        // Get current game phase
        const gameResult = await pool.query(
          `SELECT current_phase FROM games WHERE game_id = $1`,
          [gameId]
        );

        // Record player ready status as a game event
        await pool.query(
          `INSERT INTO game_events (game_id, event_type, event_data)
           VALUES ($1, 'player_ready', $2)`,
          [gameId, JSON.stringify({ user_id: userId })]
        );

        // Notify all clients in the room
        gameNamespace.to(`game:${gameId}`).emit("player_ready_update", {
          userId,
          ready: true,
        });

        // Check if all players are ready
        const result = await pool.query(
          `WITH player_count AS (
             SELECT COUNT(*) as total_players
             FROM player_games
             WHERE game_id = $1
           ),
           ready_count AS (
             SELECT COUNT(DISTINCT (event_data->>'user_id')::uuid) as ready_players
             FROM game_events
             WHERE game_id = $1 
             AND event_type = 'player_ready'
           )
           SELECT pc.total_players, rc.ready_players
           FROM player_count pc, ready_count rc`,
          [gameId]
        );

        const { total_players, ready_players } = result.rows[0];

        // If all players are ready and we have at least 3 players, start the game
        if (
          parseInt(total_players) >= 3 &&
          parseInt(total_players) === parseInt(ready_players)
        ) {
          // Get the game
          const game = await pool.query(
            `SELECT * FROM games WHERE game_id = $1`,
            [gameId]
          );

          // If the host is the current user, start the game
          if (game.rows[0].host_id === userId) {
            await startGame(gameId, gameNamespace);
          }
        }
      } catch (error) {
        console.error("Error setting player ready:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    });

    // Game action (voting, using abilities, etc.)
    socket.on("game_action", async (data) => {
      try {
        const { action_type, target_id } = data;

        if (!gameId || !userId) {
          throw new Error("Not authenticated or not in a game");
        }

        // Get the game state
        const game = await pool.query(
          `SELECT * FROM games WHERE game_id = $1`,
          [gameId]
        );

        if (game.rows.length === 0) {
          throw new Error("Game not found");
        }

        // Get the player's role
        const player = await pool.query(
          `SELECT pg.*, r.role_name, r.faction, r.ability_description
           FROM player_games pg
           JOIN roles r ON pg.role_id = r.role_id
           WHERE pg.game_id = $1 AND pg.user_id = $2`,
          [gameId, userId]
        );

        if (player.rows.length === 0) {
          throw new Error("Player not found in game");
        }

        // Record the action
        await pool.query(
          `INSERT INTO game_events 
           (game_id, event_type, event_data, day_number)
           VALUES ($1, $2, $3, $4)`,
          [
            gameId,
            action_type,
            JSON.stringify({
              player_id: player.rows[0].id,
              target_id: target_id,
              role_name: player.rows[0].role_name,
              ability_type: action_type,
            }),
            game.rows[0].current_day,
          ]
        );

        // Notify players based on action type
        if (action_type === "vote") {
          // Notify all players about the vote
          gameNamespace.to(`game:${gameId}`).emit("vote_cast", {
            voter_id: userId,
            target_id: target_id,
          });
        } else {
          // For role abilities, only notify the player
          socket.emit("ability_used", {
            success: true,
            target_id: target_id,
          });
        }

        // Check if all players have acted
        const actionCount = await pool.query(
          `SELECT COUNT(DISTINCT (event_data->>'player_id')::uuid) as action_count
           FROM game_events
           WHERE game_id = $1
           AND day_number = $2
           AND event_type = $3`,
          [gameId, game.rows[0].current_day, action_type]
        );

        const playerCount = await pool.query(
          `SELECT COUNT(*) as count
           FROM player_games
           WHERE game_id = $1
           AND is_alive = true`,
          [gameId]
        );

        // If all players have acted, transition to the next phase
        if (
          parseInt(actionCount.rows[0].action_count) ===
          parseInt(playerCount.rows[0].count)
        ) {
          if (game.rows[0].current_phase === "day") {
            await transitionToNight(gameId, gameNamespace);
          } else {
            await transitionToDay(gameId, gameNamespace);
          }
        }
      } catch (error) {
        console.error("Error processing game action:", error);
        socket.emit(SOCKET_EVENTS.ERROR, { message: error.message });
      }
    });

    // Handle disconnections
    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      try {
        if (gameId && userId) {
          // Get current game phase and day number
          const gameResult = await pool.query(
            `SELECT current_phase FROM games WHERE game_id = $1`,
            [gameId]
          );

          // Record disconnect event
          await pool.query(
            `INSERT INTO game_events (game_id, event_type, event_data)
             VALUES ($1, 'player_disconnected', $2)`,
            [gameId, JSON.stringify({ user_id: userId })]
          );

          // Notify all clients in the room
          socket.to(`game:${gameId}`).emit(SOCKET_EVENTS.PLAYER_DISCONNECTED, {
            userId,
          });
        }
      } catch (error) {
        console.error("Error handling disconnect:", error);
      }
    });

    // Handle joining a specific game room
    socket.on(SOCKET_EVENTS.JOIN_GAME_ROOM, ({ gameId, username }) => {
      if (!gameId) return;
      socket.join(`game:${gameId}`);

      // Optionally notify the room that someone joined (for debugging)
      socket.to(`game:${gameId}`).emit(SOCKET_EVENTS.USER_JOINED_ROOM, {
        username,
        game_id: gameId,
        timestamp: new Date(),
      });
    });

    // Handle leaving a specific game room
    socket.on(SOCKET_EVENTS.LEAVE_GAME_ROOM, ({ gameId, username }) => {
      if (!gameId) return;
      // Optionally notify the room that someone left (for debugging)
      socket.to(`game:${gameId}`).emit(SOCKET_EVENTS.USER_LEFT_ROOM, {
        username,
        game_id: gameId,
        timestamp: new Date(),
      });

      // the client will no longer receive messages or events sent to that room.
      socket.leave(`game:${gameId}`);
    });

    // Handle leaving a specific game room
    socket.on(
      SOCKET_EVENTS.KICK_GAME_ROOM,
      ({ gameId, targetUserId, targetUsername }) => {
        if (!gameId || !targetUserId) return;

        // Broadcast to everyone that user was kicked
        gameNamespace.to(`game:${gameId}`).emit(SOCKET_EVENTS.USER_WAS_KICKED, {
          username: targetUsername,
          user_id: targetUserId,
          game_id: gameId,
          timestamp: new Date(),
        });

        // Find the socket of the kicked user
        const targetSocket = userSockets.get(targetUserId);
        if (targetSocket) {
          targetSocket.leave(`game:${gameId}`);
        }
      }
    );
  });

  return gameNamespace;
};

// Helper function to get game state with players
async function getGameStateWithPlayers(gameId) {
  const result = await pool.query(
    `SELECT g.*,
            COALESCE(json_agg(
              json_build_object(
                'id', pg.id,
                'user_id', pg.user_id,
                'game_id', pg.game_id,
                'role_id', pg.role_id,
                'is_alive', pg.is_alive,
                'result', pg.result,
                'eliminations', pg.eliminations,
                'xp_earned', pg.xp_earned,
                'coins_earned', pg.coins_earned,
                'played_at', pg.played_at,
                'username', u.username,
                'role_name', r.role_name,
                'role_description', r.description
              )
            ) FILTER (WHERE pg.id IS NOT NULL), '[]') as players
     FROM games g
     LEFT JOIN player_games pg ON g.game_id = pg.game_id
     LEFT JOIN users u ON pg.user_id = u.user_id
     LEFT JOIN roles r ON pg.role_id = r.role_id
     WHERE g.game_id = $1
     GROUP BY g.game_id`,
    [gameId]
  );

  if (result.rows.length === 0) {
    throw new Error("Game not found");
  }

  const game = result.rows[0];
  const players = game.players;
  delete game.players;

  return { game, players };
}

// Helper function to start a game
async function startGame(gameId, namespace) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get all players
    const { game, players } = await getGameStateWithPlayers(gameId);

    if (players.length < 3) {
      throw new Error("Not enough players to start game");
    }

    // Assign roles randomly
    const rolesResult = await client.query(`SELECT * FROM roles`);
    const roles = rolesResult.rows;

    // Update game status
    await client.query(
      `UPDATE games 
       SET status = 'in_progress',
           started_at = NOW(),
           current_phase = 'night'
       WHERE game_id = $1`,
      [gameId]
    );

    // Assign roles to players
    for (const player of players) {
      const randomRole = roles[Math.floor(Math.random() * roles.length)];
      await client.query(
        `UPDATE player_games
         SET role_id = $1
         WHERE id = $3`,
        [randomRole.role_id, player.id]
      );
    }

    await client.query("COMMIT");

    // Get updated game state
    const updatedState = await getGameStateWithPlayers(gameId);

    // Notify all players that game has started
    namespace.to(`game:${gameId}`).emit(SOCKET_EVENTS.GAME_STARTED, {
      game: updatedState.game,
      players: updatedState.players,
      startTime: new Date(),
    });

    // Start night phase
    setTimeout(() => transitionToDay(gameId, namespace), 30000);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error starting game:", error);
    namespace
      .to(`game:${gameId}`)
      .emit(SOCKET_EVENTS.ERROR, { message: error.message });
  } finally {
    client.release();
  }
}

// Helper function to transition from night to day
async function transitionToDay(gameId, namespace) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update game phase
    await client.query(
      `UPDATE games 
       SET current_phase = 'day'
       WHERE game_id = $1`,
      [gameId]
    );

    // Get updated game state and players
    const gameState = await getGameStateWithPlayers(gameId);

    // Get any killed players from the night phase
    const killedPlayerResult = await client.query(
      `SELECT u.username, pg.user_id
       FROM player_games pg
       JOIN users u ON pg.user_id = u.user_id
       WHERE pg.game_id = $1 
       AND pg.result = 'defeat'
       AND EXISTS (
         SELECT 1 FROM game_events ge
         WHERE ge.game_id = pg.game_id
         AND ge.event_type = 'werewolf_kill'
         AND ge.event_data->>'target_id' = pg.id::text
       )`,
      [gameId]
    );

    const killedPlayer = killedPlayerResult.rows[0];

    // Emit phase change to all players
    namespace.to(`game:${gameId}`).emit(SOCKET_EVENTS.PHASE_CHANGED, {
      phase: "day",
      session: {
        current_day: gameState.game.current_day,
      },
      players: gameState.players,
      killed_player: killedPlayer
        ? {
            player: {
              username: killedPlayer.username,
              user_id: killedPlayer.user_id,
            },
          }
        : undefined,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Helper function to transition from day to night
async function transitionToNight(gameId, namespace) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update game phase
    await client.query(
      `UPDATE games 
       SET current_phase = 'night'
       WHERE game_id = $1`,
      [gameId]
    );

    // Get updated game state and players
    const gameState = await getGameStateWithPlayers(gameId);

    // Get any lynched players from the day phase
    const lynchedPlayerResult = await client.query(
      `SELECT u.username, pg.user_id
       FROM player_games pg
       JOIN users u ON pg.user_id = u.user_id
       WHERE pg.game_id = $1 
       AND pg.result = 'defeat'
       AND EXISTS (
         SELECT 1 FROM game_events ge
         WHERE ge.game_id = pg.game_id
         AND ge.event_type = 'lynch'
         AND ge.event_data->>'target_id' = pg.id::text
       )`,
      [gameId]
    );

    const lynchedPlayer = lynchedPlayerResult.rows[0];

    // Emit phase change to all players
    namespace.to(`game:${gameId}`).emit(SOCKET_EVENTS.PHASE_CHANGED, {
      phase: "night",
      session: {
        current_day: gameState.game.current_day,
      },
      players: gameState.players,
      lynched_player: lynchedPlayer
        ? {
            player: {
              username: lynchedPlayer.username,
              user_id: lynchedPlayer.user_id,
            },
          }
        : undefined,
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Helper function to check win conditions
async function checkWinConditions(gameId, namespace) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get all alive players and their roles
    const { rows: players } = await client.query(
      `SELECT pg.*, u.username, r.faction
       FROM player_games pg
       JOIN users u ON pg.user_id = u.user_id
       JOIN roles r ON pg.role_id = r.role_id
       WHERE pg.game_id = $1 AND pg.is_alive = true`,
      [gameId]
    );

    // Count players by faction
    const factionCounts = players.reduce((acc, p) => {
      acc[p.faction] = (acc[p.faction] || 0) + 1;
      return acc;
    }, {});

    let winner_faction = null;

    // Check win conditions
    if (factionCounts.werewolf === 0) {
      winner_faction = "village";
    } else if (factionCounts.werewolf >= factionCounts.village) {
      winner_faction = "werewolf";
    }

    if (winner_faction) {
      // Update game status
      await client.query(
        `UPDATE games
         SET status = 'completed',
             winner_faction = $1,
             ended_at = NOW()
         WHERE game_id = $2`,
        [winner_faction, gameId]
      );

      // Get final game state
      const finalState = await getGameStateWithPlayers(gameId);

      // Notify players of game end
      namespace.to(`game:${gameId}`).emit(SOCKET_EVENTS.GAME_ENDED, {
        winner: winner_faction,
      });

      await client.query("COMMIT");
      return true;
    }

    await client.query("COMMIT");
    return false;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  setupGameSocketHandlers,
  activeGames,
  // Any other helpers that might be useful externally
};
