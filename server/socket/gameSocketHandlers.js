const { pool } = require("../config/db");
const Game = require("../models/Game");
const Chat = require("../models/Chat");

// Map to store active game sessions and their connected players
const activeGames = new Map();

// Setup game-related socket event handlers
const setupGameSocketHandlers = (io) => {
  // Create a namespace for game-related events
  const gameNamespace = io.of("/game");

  gameNamespace.on("connection", (socket) => {
    console.log(`New connection to game namespace: ${socket.id}`);

    // Track user data
    let userId = null;
    let sessionId = null;

    // Authenticate user (should be called first)
    socket.on("authenticate", async (data) => {
      try {
        const { user_id, token } = data;

        // In a real app, verify JWT token here
        userId = user_id;

        // Acknowledge successful authentication
        socket.emit("authenticated", { success: true });
        console.log(`User ${userId} authenticated on socket ${socket.id}`);
      } catch (error) {
        console.error("Authentication error:", error);
        socket.emit("authenticated", { success: false, error: error.message });
      }
    });

    // Join a game session
    socket.on("join_game", async (data) => {
      try {
        const { session_id } = data;
        sessionId = session_id;

        // Add user to the game room
        socket.join(`game:${sessionId}`);

        // Add player to database if not already in the game
        const result = await pool.query(
          `INSERT INTO game_players (session_id, user_id)
           VALUES ($1, $2)
           ON CONFLICT (session_id, user_id) DO NOTHING
           RETURNING player_id`,
          [sessionId, userId]
        );

        // Get game session information
        const gameSession = await pool.query(
          `SELECT * FROM game_sessions WHERE session_id = $1`,
          [sessionId]
        );

        if (gameSession.rows.length === 0) {
          throw new Error("Game session not found");
        }

        // Get all players in the game
        const players = await pool.query(
          `SELECT gp.*, u.username
           FROM game_players gp
           JOIN users u ON gp.user_id = u.user_id
           WHERE gp.session_id = $1`,
          [sessionId]
        );

        // Track this session in the active games map
        if (!activeGames.has(sessionId)) {
          activeGames.set(sessionId, {
            players: new Set(),
            session: gameSession.rows[0],
          });
        }

        activeGames.get(sessionId).players.add(userId);

        // Notify all clients in the room that a new player joined
        socket.to(`game:${sessionId}`).emit("player_joined", {
          userId,
          players: players.rows,
        });

        // Send game state to the new player
        socket.emit("game_state", {
          session: gameSession.rows[0],
          players: players.rows,
          player_id: result.rows[0]?.player_id,
        });
      } catch (error) {
        console.error("Error joining game:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Player is ready to start the game
    socket.on("player_ready", async () => {
      try {
        if (!sessionId || !userId) {
          throw new Error("Not authenticated or not in a game");
        }

        // Update player ready status in database
        await pool.query(
          `UPDATE game_players
           SET ready = true
           WHERE session_id = $1 AND user_id = $2`,
          [sessionId, userId]
        );

        // Notify all clients in the room
        gameNamespace.to(`game:${sessionId}`).emit("player_ready_update", {
          userId,
          ready: true,
        });

        // Check if all players are ready
        const result = await pool.query(
          `SELECT COUNT(*) as total_players, 
                  SUM(CASE WHEN ready = true THEN 1 ELSE 0 END) as ready_players
           FROM game_players
           WHERE session_id = $1`,
          [sessionId]
        );

        const { total_players, ready_players } = result.rows[0];

        // If all players are ready and we have at least 3 players, start the game
        if (
          parseInt(total_players) >= 3 &&
          parseInt(total_players) === parseInt(ready_players)
        ) {
          // Get the game session
          const gameSession = await pool.query(
            `SELECT * FROM game_sessions WHERE session_id = $1`,
            [sessionId]
          );

          // If the host is the current user, start the game
          if (gameSession.rows[0].host_user_id === userId) {
            await startGame(sessionId, gameNamespace);
          }
        }
      } catch (error) {
        console.error("Error setting player ready:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Game action (voting, using abilities, etc.)
    socket.on("game_action", async (data) => {
      try {
        const { action_type, target_id } = data;

        if (!sessionId || !userId) {
          throw new Error("Not authenticated or not in a game");
        }

        // Get the game state
        const gameSession = await pool.query(
          `SELECT * FROM game_sessions WHERE session_id = $1`,
          [sessionId]
        );

        if (gameSession.rows.length === 0) {
          throw new Error("Game session not found");
        }

        const game = gameSession.rows[0];

        // Get the player
        const player = await pool.query(
          `SELECT * FROM game_players WHERE session_id = $1 AND user_id = $2`,
          [sessionId, userId]
        );

        if (player.rows.length === 0) {
          throw new Error("Player not found in this game");
        }

        const playerId = player.rows[0].player_id;

        // Handle different action types
        switch (action_type) {
          case "vote":
            // Check if it's day phase and voting is allowed
            if (game.current_phase !== "day") {
              throw new Error("Voting is only allowed during the day phase");
            }

            // Record the vote
            await pool.query(
              `INSERT INTO votes (session_id, day_number, voter_id, target_id, vote_type)
               VALUES ($1, $2, $3, $4, 'lynch')`,
              [sessionId, game.current_day, playerId, target_id]
            );

            // Notify all clients in the room
            gameNamespace.to(`game:${sessionId}`).emit("vote_update", {
              voter_id: playerId,
              target_id,
              day_number: game.current_day,
            });
            break;

          case "ability":
            // Check if it's night phase for night abilities
            if (game.current_phase !== "night") {
              throw new Error(
                "Abilities can only be used during the night phase"
              );
            }

            // Get player role
            if (!player.rows[0].role_id) {
              throw new Error("Player does not have a role assigned");
            }

            const role = await pool.query(
              `SELECT * FROM roles WHERE role_id = $1`,
              [player.rows[0].role_id]
            );

            if (role.rows.length === 0) {
              throw new Error("Role not found");
            }

            // Record the ability use
            await pool.query(
              `INSERT INTO game_events 
               (session_id, event_type, event_data, initiator_id, target_ids, phase, day_number, is_public)
               VALUES ($1, $2, $3, $4, $5, $6, $7, false)`,
              [
                sessionId,
                `${role.rows[0].name.toLowerCase()}_ability`,
                JSON.stringify({ ability_type: role.rows[0].ability_type }),
                playerId,
                [target_id],
                game.current_phase,
                game.current_day,
              ]
            );

            // For werewolf kill ability, notify other werewolves
            if (
              role.rows[0].team === "werewolf" &&
              role.rows[0].ability_type === "kill"
            ) {
              // Get all werewolves in the game
              const werewolves = await pool.query(
                `SELECT gp.player_id
                 FROM game_players gp
                 JOIN roles r ON gp.role_id = r.role_id
                 WHERE gp.session_id = $1 AND r.team = 'werewolf'`,
                [sessionId]
              );

              // Notify all werewolves
              werewolves.rows.forEach((wolf) => {
                socket.to(`player:${wolf.player_id}`).emit("ability_used", {
                  role: "werewolf",
                  user_id: userId,
                  target_id,
                  ability_type: "kill",
                });
              });
            }

            // Confirm to the player that their ability was used
            socket.emit("ability_confirmed", {
              target_id,
              ability_type: role.rows[0].ability_type,
            });
            break;

          default:
            throw new Error(`Unknown action type: ${action_type}`);
        }
      } catch (error) {
        console.error("Error processing game action:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Leave game
    socket.on("leave_game", async () => {
      try {
        if (sessionId && userId) {
          // Remove player from the game
          await pool.query(
            `DELETE FROM game_players
             WHERE session_id = $1 AND user_id = $2`,
            [sessionId, userId]
          );

          // Remove from active games tracking
          const gameInfo = activeGames.get(sessionId);
          if (gameInfo) {
            gameInfo.players.delete(userId);

            // If no players left, remove the game from tracking
            if (gameInfo.players.size === 0) {
              activeGames.delete(sessionId);
            }
          }

          // Notify all clients in the room
          socket.to(`game:${sessionId}`).emit("player_left", {
            userId,
          });

          // Leave the socket room
          socket.leave(`game:${sessionId}`);

          sessionId = null;
        }
      } catch (error) {
        console.error("Error leaving game:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Handle disconnections
    socket.on("disconnect", async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      try {
        if (sessionId && userId) {
          // Update player connection status
          await pool.query(
            `UPDATE game_players
             SET connected = false
             WHERE session_id = $1 AND user_id = $2`,
            [sessionId, userId]
          );

          // Notify all clients in the room
          socket.to(`game:${sessionId}`).emit("player_disconnected", {
            userId,
          });
        }
      } catch (error) {
        console.error("Error handling disconnect:", error);
      }
    });
  });

  return gameNamespace;
};

// Helper function to start a game
async function startGame(sessionId, namespace) {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query("BEGIN");

    // Update game session status
    await client.query(
      `UPDATE game_sessions
       SET status = 'in_progress',
           current_phase = 'night',
           current_day = 1,
           started_at = NOW()
       WHERE session_id = $1
       RETURNING *`,
      [sessionId]
    );

    // Get all players in the game
    const playersResult = await client.query(
      `SELECT * FROM game_players WHERE session_id = $1`,
      [sessionId]
    );

    const players = playersResult.rows;

    // Get available roles
    const rolesResult = await client.query(
      `SELECT * FROM roles WHERE enabled = true`
    );

    const roles = rolesResult.rows;

    // Ensure we have at least one werewolf and the rest are villagers
    const numPlayers = players.length;
    const numWerewolves = Math.max(1, Math.floor(numPlayers / 4));

    // Assign roles
    const werewolfRole = roles.find((r) => r.name === "Werewolf");
    const seerRole = roles.find((r) => r.name === "Seer");
    const villagerRole = roles.find((r) => r.name === "Villager");

    // Shuffle players for random role assignment
    const shuffledPlayers = [...players].sort(() => 0.5 - Math.random());

    // Assign werewolves
    for (let i = 0; i < numWerewolves; i++) {
      await client.query(
        `UPDATE game_players
         SET role_id = $1, team = 'werewolf'
         WHERE player_id = $2`,
        [werewolfRole.role_id, shuffledPlayers[i].player_id]
      );
    }

    // Assign one seer if available
    if (seerRole && numPlayers > numWerewolves) {
      await client.query(
        `UPDATE game_players
         SET role_id = $1, team = 'villager'
         WHERE player_id = $2`,
        [seerRole.role_id, shuffledPlayers[numWerewolves].player_id]
      );
    }

    // Assign remaining players as villagers
    for (let i = numWerewolves + 1; i < numPlayers; i++) {
      await client.query(
        `UPDATE game_players
         SET role_id = $1, team = 'villager'
         WHERE player_id = $2`,
        [villagerRole.role_id, shuffledPlayers[i].player_id]
      );
    }

    // Log game start event
    await client.query(
      `INSERT INTO game_events 
       (session_id, event_type, event_data, phase, day_number, is_public)
       VALUES ($1, 'game_started', $2, 'night', 1, true)`,
      [sessionId, JSON.stringify({ player_count: numPlayers })]
    );

    // Commit transaction
    await client.query("COMMIT");

    // Get updated game state
    const gameResult = await pool.query(
      `SELECT * FROM game_sessions WHERE session_id = $1`,
      [sessionId]
    );

    // Get updated players with their roles
    const updatedPlayersResult = await pool.query(
      `SELECT gp.*, r.name as role_name, r.team, r.ability_type
       FROM game_players gp
       JOIN roles r ON gp.role_id = r.role_id
       WHERE gp.session_id = $1`,
      [sessionId]
    );

    // Notify all clients that the game has started
    namespace.to(`game:${sessionId}`).emit("game_started", {
      session: gameResult.rows[0],
      players: updatedPlayersResult.rows,
    });

    // Send role information privately to each player
    updatedPlayersResult.rows.forEach((player) => {
      namespace.to(`player:${player.user_id}`).emit("role_assigned", {
        role_name: player.role_name,
        team: player.team,
        ability_type: player.ability_type,
      });
    });

    // Start the night phase timer (2 minutes)
    setTimeout(() => {
      transitionToDay(sessionId, namespace);
    }, 2 * 60 * 1000);
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("Error starting game:", error);
    namespace
      .to(`game:${sessionId}`)
      .emit("error", { message: "Failed to start game" });
  } finally {
    client.release();
  }
}

// Helper function to transition from night to day
async function transitionToDay(sessionId, namespace) {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query("BEGIN");

    // Get current game state
    const gameResult = await client.query(
      `SELECT * FROM game_sessions WHERE session_id = $1`,
      [sessionId]
    );

    if (gameResult.rows.length === 0) {
      throw new Error("Game session not found");
    }

    const game = gameResult.rows[0];

    // Only proceed if the game is still in the night phase
    if (game.status !== "in_progress" || game.current_phase !== "night") {
      return;
    }

    // Process night actions

    // 1. Get all werewolf kill votes for this night
    const werewolfKillsResult = await client.query(
      `SELECT e.*, count(*) as vote_count, gp.user_id as target_user_id
       FROM game_events e
       JOIN game_players gp ON gp.player_id = ANY(e.target_ids)
       WHERE e.session_id = $1 
       AND e.phase = 'night' 
       AND e.day_number = $2
       AND e.event_type = 'werewolf_ability'
       GROUP BY e.target_ids[1], e.session_id, e.event_id, gp.user_id
       ORDER BY vote_count DESC
       LIMIT 1`,
      [sessionId, game.current_day]
    );

    let killedPlayerId = null;

    // If there was a werewolf kill
    if (werewolfKillsResult.rows.length > 0) {
      killedPlayerId = werewolfKillsResult.rows[0].target_ids[0];

      // Update player as dead
      await client.query(
        `UPDATE game_players
         SET is_alive = false, death_time = NOW(), death_cause = 'werewolf_kill'
         WHERE player_id = $1`,
        [killedPlayerId]
      );

      // Log the kill event
      await client.query(
        `INSERT INTO game_events 
         (session_id, event_type, event_data, target_ids, phase, day_number, is_public)
         VALUES ($1, 'player_killed', $2, $3, 'night', $4, true)`,
        [
          sessionId,
          JSON.stringify({ cause: "werewolf_kill" }),
          [killedPlayerId],
          game.current_day,
        ]
      );
    }

    // Update game to day phase
    await client.query(
      `UPDATE game_sessions
       SET current_phase = 'day'
       WHERE session_id = $1
       RETURNING *`,
      [sessionId]
    );

    // Commit transaction
    await client.query("COMMIT");

    // Get updated game state
    const updatedGameResult = await client.query(
      `SELECT * FROM game_sessions WHERE session_id = $1`,
      [sessionId]
    );

    // Get all players with their updated status
    const playersResult = await client.query(
      `SELECT gp.*, u.username
       FROM game_players gp
       JOIN users u ON gp.user_id = u.user_id
       WHERE gp.session_id = $1`,
      [sessionId]
    );

    // Notify all clients about the phase change
    namespace.to(`game:${sessionId}`).emit("phase_changed", {
      session: updatedGameResult.rows[0],
      phase: "day",
      killed_player: killedPlayerId
        ? {
            player_id: killedPlayerId,
            player: playersResult.rows.find(
              (p) => p.player_id === killedPlayerId
            ),
          }
        : null,
      players: playersResult.rows,
    });

    // Check win conditions
    checkWinConditions(sessionId, namespace);

    // Start the day phase timer (5 minutes)
    setTimeout(() => {
      transitionToNight(sessionId, namespace);
    }, 5 * 60 * 1000);
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("Error transitioning to day phase:", error);
    namespace
      .to(`game:${sessionId}`)
      .emit("error", { message: "Failed to transition to day phase" });
  } finally {
    client.release();
  }
}

// Helper function to transition from day to night
async function transitionToNight(sessionId, namespace) {
  const client = await pool.connect();

  try {
    // Start transaction
    await client.query("BEGIN");

    // Get current game state
    const gameResult = await client.query(
      `SELECT * FROM game_sessions WHERE session_id = $1`,
      [sessionId]
    );

    if (gameResult.rows.length === 0) {
      throw new Error("Game session not found");
    }

    const game = gameResult.rows[0];

    // Only proceed if the game is still in the day phase
    if (game.status !== "in_progress" || game.current_phase !== "day") {
      return;
    }

    // Process day votes

    // Get the player with the most votes
    const votesResult = await client.query(
      `SELECT v.target_id, COUNT(*) as vote_count
       FROM votes v
       WHERE v.session_id = $1 AND v.day_number = $2 AND v.vote_type = 'lynch'
       GROUP BY v.target_id
       ORDER BY vote_count DESC
       LIMIT 1`,
      [sessionId, game.current_day]
    );

    let lynchedPlayerId = null;

    // If there were votes and at least 2 votes for the most voted player
    if (
      votesResult.rows.length > 0 &&
      parseInt(votesResult.rows[0].vote_count) >= 2
    ) {
      lynchedPlayerId = votesResult.rows[0].target_id;

      // Update player as dead
      await client.query(
        `UPDATE game_players
         SET is_alive = false, death_time = NOW(), death_cause = 'lynch'
         WHERE player_id = $1`,
        [lynchedPlayerId]
      );

      // Log the lynch event
      await client.query(
        `INSERT INTO game_events 
         (session_id, event_type, event_data, target_ids, phase, day_number, is_public)
         VALUES ($1, 'player_lynched', $2, $3, 'day', $4, true)`,
        [
          sessionId,
          JSON.stringify({ votes: parseInt(votesResult.rows[0].vote_count) }),
          [lynchedPlayerId],
          game.current_day,
        ]
      );
    }

    // Increment the day counter and set to night phase
    await client.query(
      `UPDATE game_sessions
       SET current_phase = 'night', current_day = current_day + 1
       WHERE session_id = $1
       RETURNING *`,
      [sessionId]
    );

    // Commit transaction
    await client.query("COMMIT");

    // Get updated game state
    const updatedGameResult = await client.query(
      `SELECT * FROM game_sessions WHERE session_id = $1`,
      [sessionId]
    );

    // Get all players with their updated status
    const playersResult = await client.query(
      `SELECT gp.*, u.username
       FROM game_players gp
       JOIN users u ON gp.user_id = u.user_id
       WHERE gp.session_id = $1`,
      [sessionId]
    );

    // Notify all clients about the phase change
    namespace.to(`game:${sessionId}`).emit("phase_changed", {
      session: updatedGameResult.rows[0],
      phase: "night",
      lynched_player: lynchedPlayerId
        ? {
            player_id: lynchedPlayerId,
            player: playersResult.rows.find(
              (p) => p.player_id === lynchedPlayerId
            ),
          }
        : null,
      players: playersResult.rows,
    });

    // Check win conditions
    checkWinConditions(sessionId, namespace);

    // Start the night phase timer (2 minutes)
    setTimeout(() => {
      transitionToDay(sessionId, namespace);
    }, 2 * 60 * 1000);
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("Error transitioning to night phase:", error);
    namespace
      .to(`game:${sessionId}`)
      .emit("error", { message: "Failed to transition to night phase" });
  } finally {
    client.release();
  }
}

// Helper function to check win conditions
async function checkWinConditions(sessionId, namespace) {
  try {
    // Get all alive players with their roles
    const playersResult = await pool.query(
      `SELECT gp.*, r.team
       FROM game_players gp
       JOIN roles r ON gp.role_id = r.role_id
       WHERE gp.session_id = $1 AND gp.is_alive = true`,
      [sessionId]
    );

    const players = playersResult.rows;

    // Count alive players by team
    const villagerCount = players.filter((p) => p.team === "villager").length;
    const werewolfCount = players.filter((p) => p.team === "werewolf").length;

    let winningTeam = null;

    // Check win conditions
    if (werewolfCount === 0) {
      // All werewolves are dead, villagers win
      winningTeam = "villager";
    } else if (werewolfCount >= villagerCount) {
      // Werewolves equal or outnumber villagers, werewolves win
      winningTeam = "werewolf";
    }

    if (winningTeam) {
      // Game is over, update game session
      await pool.query(
        `UPDATE game_sessions
         SET status = 'completed', ended_at = NOW()
         WHERE session_id = $1`,
        [sessionId]
      );

      // Log the game end event
      await pool.query(
        `INSERT INTO game_events 
         (session_id, event_type, event_data, phase, day_number, is_public)
         VALUES ($1, 'game_ended', $2, $3, $4, true)`,
        [
          sessionId,
          JSON.stringify({ winning_team: winningTeam }),
          playersResult.rows[0]?.current_phase || "day",
          playersResult.rows[0]?.current_day || 1,
        ]
      );

      // Get all players with their roles for the game summary
      const allPlayersResult = await pool.query(
        `SELECT gp.*, u.username, r.name as role_name, r.team
         FROM game_players gp
         JOIN users u ON gp.user_id = u.user_id
         JOIN roles r ON gp.role_id = r.role_id
         WHERE gp.session_id = $1`,
        [sessionId]
      );

      // Notify all clients about the game end
      namespace.to(`game:${sessionId}`).emit("game_ended", {
        winning_team: winningTeam,
        players: allPlayersResult.rows,
      });

      // Award experience to players
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        for (const player of allPlayersResult.rows) {
          // Winners get more XP
          const expPoints = player.team === winningTeam ? 100 : 50;

          await client.query(
            `UPDATE users
             SET experience_points = experience_points + $1
             WHERE user_id = $2`,
            [expPoints, player.user_id]
          );
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        console.error("Error awarding experience points:", error);
      } finally {
        client.release();
      }
    }

    return winningTeam;
  } catch (error) {
    console.error("Error checking win conditions:", error);
    return null;
  }
}

module.exports = {
  setupGameSocketHandlers,
};
