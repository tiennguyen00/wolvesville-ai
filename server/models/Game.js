const { pool } = require("../config/db");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

class Game {
  // Get list of available games with optional status filter
  static async getGames(status = null) {
    try {
      let query = `
        SELECT 
          g.game_id,
          g.game_mode,
          g.status,
          g.max_players,
          COUNT(pg.id) as current_players,
          u.username as host_username,
          g.created_at,
          g.password_protected
        FROM 
          games g
        LEFT JOIN 
          player_games pg ON g.game_id = pg.game_id
        LEFT JOIN 
          users u ON g.host_id = u.user_id
      `;

      const params = [];
      if (status) {
        query += ` WHERE g.status = $1`;
        params.push(status);
      }

      query += `
        GROUP BY 
          g.game_id, u.username
        ORDER BY 
          g.created_at DESC
      `;

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (error) {
      console.error("Error fetching games:", error);
      throw error;
    }
  }

  // Create a new game
  static async createGame(
    hostUserId,
    gameMode,
    maxPlayers,
    gamePassword = null,
    passwordProtected = false,
    settings = {},
    currentPhase = "lobby"
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      console.log("Creating game with hostUserId:", hostUserId);

      // Verify the host user exists
      const userCheck = await client.query(
        "SELECT user_id, username FROM users WHERE user_id = $1",
        [hostUserId]
      );

      if (userCheck.rows.length === 0) {
        throw new Error("Host user not found");
      }

      const hostUser = userCheck.rows[0];

      // Create password hash if password is provided
      let passwordHash = null;
      if (gamePassword) {
        passwordHash = gamePassword; // Store raw password as per the db schema
        passwordProtected = true;
      }

      // Insert new game
      const gameQuery = `
        INSERT INTO games (
          host_id, 
          game_mode, 
          status,
          current_phase,
          max_players, 
          password_protected, 
          game_password,
          settings
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING game_id, created_at, status
      `;
      const gameValues = [
        hostUserId,
        gameMode || "classic",
        "lobby",
        currentPhase,
        maxPlayers || 12,
        passwordProtected,
        passwordHash,
        settings ? JSON.stringify(settings) : null,
      ];

      const gameResult = await client.query(gameQuery, gameValues);
      const game = gameResult.rows[0];

      // Add host as first player
      const playerQuery = `
        INSERT INTO player_games (game_id, user_id, is_alive)
        VALUES ($1, $2, $3)
        RETURNING id
      `;
      const playerValues = [game.game_id, hostUserId, true];
      await client.query(playerQuery, playerValues);

      await client.query("COMMIT");

      // Get the global io instance
      const io = require("../index").io;

      // Emit socket event for game creation
      io.emit("game_created", {
        game_id: game.game_id,
        settings: {
          game_mode: gameMode,
          max_players: maxPlayers,
          password_protected: passwordProtected,
          current_phase: currentPhase,
          ...settings,
        },
        host_info: {
          user_id: hostUser.user_id,
          username: hostUser.username,
        },
      });

      return game;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error creating game:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get details of a specific game
  static async getGameDetails(gameId) {
    try {
      // Get game details
      const gameQuery = `
        SELECT 
          g.game_id,
          g.game_mode,
          g.status,
          g.current_phase,
          g.max_players,
          u.username as host_username,
          u.user_id as host_id,
          g.created_at,
          g.started_at,
          g.ended_at,
          g.password_protected,
          g.winner_faction,
          g.settings
        FROM 
          games g
        LEFT JOIN 
          users u ON g.host_id = u.user_id
        WHERE 
          g.game_id = $1
      `;
      const gameResult = await pool.query(gameQuery, [gameId]);

      if (gameResult.rows.length === 0) {
        return null;
      }

      const game = gameResult.rows[0];

      // Get players in this game
      const playersQuery = `
        SELECT 
          pg.id,
          pg.user_id,
          u.username,
          pg.is_alive,
          pg.result,
          pg.eliminations,
          pg.xp_earned,
          pg.coins_earned,
          pg.played_at,
          pg.role_id,
          r.role_name,
          r.faction
        FROM 
          player_games pg
        JOIN 
          users u ON pg.user_id = u.user_id
        LEFT JOIN 
          roles r ON pg.role_id = r.role_id
        WHERE 
          pg.game_id = $1
      `;
      const playersResult = await pool.query(playersQuery, [gameId]);

      return {
        ...game,
        players: playersResult.rows,
      };
    } catch (error) {
      console.error("Error fetching game details:", error);
      throw error;
    }
  }

  // Join a game
  static async joinGame(gameId, userId, gamePassword = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check if game exists and get its status
      const gameQuery = `
        SELECT g.*, 
               COUNT(pg.id) as current_players,
               EXISTS (
                 SELECT 1 
                 FROM player_games pg2 
                 WHERE pg2.game_id = g.game_id 
                 AND pg2.user_id = $2
               ) as already_joined
        FROM games g
        LEFT JOIN player_games pg ON g.game_id = pg.game_id
        WHERE g.game_id = $1
        GROUP BY g.game_id`;

      const { rows } = await client.query(gameQuery, [gameId, userId]);

      if (rows.length === 0) {
        throw new Error("Game not found");
      }

      const game = rows[0];

      // Check various conditions
      if (game.status !== "lobby") {
        throw new Error("Cannot join a game that has already started");
      }

      if (game.already_joined) {
        throw new Error("Already in this game");
      }

      if (parseInt(game.current_players) >= game.max_players) {
        throw new Error("Game is full");
      }

      if (game.password_protected && !gamePassword) {
        throw new Error("Password is required to join this game");
      }

      if (game.password_protected && gamePassword !== game.game_password) {
        throw new Error("Invalid password");
      }

      // Add player to game
      const joinQuery = `
        INSERT INTO player_games (game_id, user_id, is_alive)
        VALUES ($1, $2, true)
        RETURNING id as player_id`;

      const result = await client.query(joinQuery, [gameId, userId]);

      // Record join event
      await client.query(
        `INSERT INTO game_events (game_id, event_type, event_data)
         VALUES ($1, 'player_joined', $2)`,
        [gameId, JSON.stringify({ user_id: userId })]
      );

      await client.query("COMMIT");

      return {
        player_id: result.rows[0].player_id,
        game_id: gameId,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Get available roles
  static async getRoles() {
    try {
      const query = `
        SELECT 
          role_id, 
          role_name, 
          faction, 
          description, 
          ability_description, 
          icon, 
          created_at
        FROM 
          roles
        ORDER BY 
          role_name ASC
      `;

      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.error("Error fetching roles:", error);
      throw error;
    }
  }

  // Get game events
  static async getGameEvents(gameId, since = null) {
    try {
      let query = `
        SELECT 
          event_id,
          game_id,
          event_type,
          event_data,
          created_at
        FROM 
          game_events
        WHERE 
          game_id = $1
      `;

      const params = [gameId];

      if (since) {
        query += ` AND created_at > $2`;
        params.push(since);
      }

      query += ` ORDER BY created_at ASC`;

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (error) {
      console.error("Error fetching game events:", error);
      throw error;
    }
  }

  // Record a game event
  static async recordGameEvent(gameId, eventType, eventData) {
    try {
      const query = `
        INSERT INTO game_events (
          game_id,
          event_type,
          event_data
        )
        VALUES ($1, $2, $3)
        RETURNING event_id, created_at
      `;

      const values = [
        gameId,
        eventType,
        eventData ? JSON.stringify(eventData) : "{}",
      ];

      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error("Error recording game event:", error);
      throw error;
    }
  }

  // Start a game
  static async startGame(gameId, hostUserId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verify user is host
      const hostQuery = `
        SELECT host_id, settings FROM games
        WHERE game_id = $1
      `;
      const hostResult = await client.query(hostQuery, [gameId]);

      if (hostResult.rows.length === 0) {
        throw new Error("Game not found");
      }

      if (hostResult.rows[0].host_id !== hostUserId) {
        throw new Error("Only the host can start the game");
      }

      // Count players
      const countQuery = `
        SELECT COUNT(*) as player_count FROM player_games
        WHERE game_id = $1
      `;
      const countResult = await client.query(countQuery, [gameId]);
      const playerCount = parseInt(countResult.rows[0].player_count);

      if (playerCount < 3) {
        throw new Error("Need at least 3 players to start a game");
      }

      // Update game status
      const updateQuery = `
        UPDATE games
        SET 
          status = 'in_progress',
          started_at = NOW(),
          current_phase = 'night'
        WHERE game_id = $1
        RETURNING status, started_at, current_phase
      `;
      const updateResult = await client.query(updateQuery, [gameId]);

      // Get or set up default roles
      let roleDistribution;
      const settings = hostResult.rows[0].settings || {};

      if (settings.roles && Array.isArray(settings.roles)) {
        roleDistribution = settings.roles;
      } else {
        // Default role distribution based on player count
        const defaultRoles = await client.query(
          `SELECT role_id, role_name FROM roles WHERE role_name IN ('Villager', 'Werewolf', 'Seer')`
        );

        const roles = defaultRoles.rows;
        const villager = roles.find((r) => r.role_name === "Villager");
        const werewolf = roles.find((r) => r.role_name === "Werewolf");
        const seer = roles.find((r) => r.role_name === "Seer");

        if (!villager || !werewolf || !seer) {
          throw new Error("Required roles not found in database");
        }

        roleDistribution = [];
        // Always 1 Seer
        roleDistribution.push(seer.role_id);

        // Number of werewolves based on player count
        const numWerewolves = Math.floor(playerCount / 4) + 1;
        for (let i = 0; i < numWerewolves; i++) {
          roleDistribution.push(werewolf.role_id);
        }

        // Rest are villagers
        const numVillagers = playerCount - numWerewolves - 1;
        for (let i = 0; i < numVillagers; i++) {
          roleDistribution.push(villager.role_id);
        }
      }

      // Get all players
      const playersQuery = `
        SELECT id FROM player_games
        WHERE game_id = $1
        ORDER BY RANDOM()
      `;
      const playersResult = await client.query(playersQuery, [gameId]);
      const players = playersResult.rows.map((p) => p.id);

      // Assign roles to players
      for (let i = 0; i < players.length; i++) {
        const roleId = roleDistribution[i];
        await client.query(
          `UPDATE player_games
           SET role_id = $1,
               team = (SELECT faction FROM roles WHERE role_id = $1)
           WHERE id = $2`,
          [roleId, players[i]]
        );
      }

      // Record game start event
      await client.query(
        `INSERT INTO game_events (
          game_id,
          event_type,
          event_data,
          phase,
          phase_number,
          is_public
        ) VALUES ($1, 'game_started', $2, 'night', 1, true)`,
        [
          gameId,
          JSON.stringify({
            player_count: playerCount,
            role_distribution: roleDistribution.length,
          }),
        ]
      );

      await client.query("COMMIT");
      return updateResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error starting game:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Record a player action
  static async recordPlayerAction(
    gameId,
    userId,
    actionType,
    targetIds,
    actionData = {}
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get game state and player
      const gameStateQuery = `
        SELECT 
          g.current_phase,
          pg.id as player_game_id,
          pg.is_alive,
          pg.role_id,
          r.role_name,
          r.ability_description
        FROM 
          games g
        JOIN 
          player_games pg ON g.game_id = pg.game_id
        LEFT JOIN 
          roles r ON pg.role_id = r.role_id
        WHERE 
          g.game_id = $1 
          AND pg.user_id = $2
      `;
      const gameStateResult = await client.query(gameStateQuery, [
        gameId,
        userId,
      ]);

      if (gameStateResult.rows.length === 0) {
        throw new Error("Game or player not found");
      }

      const gameState = gameStateResult.rows[0];
      const playerId = gameState.player_game_id;

      // Check if player is alive
      if (!gameState.is_alive) {
        throw new Error("Dead players cannot perform actions");
      }

      // Get the latest phase number
      const phaseQuery = `
        SELECT COALESCE(MAX(phase_number), 1) as current_phase_number 
        FROM game_votes 
        WHERE game_id = $1
      `;
      const phaseResult = await client.query(phaseQuery, [gameId]);
      const current_phase_number = phaseResult.rows[0].current_phase_number;

      // Validate action type and phase
      if (actionType === "kill" && gameState.current_phase !== "night") {
        throw new Error("Kill actions can only be performed at night");
      } else if (actionType === "vote" && gameState.current_phase !== "day") {
        throw new Error("Voting can only be performed during the day");
      }

      // Record action as event
      const eventQuery = `
        INSERT INTO game_events (
          game_id,
          event_type,
          event_data
        )
        VALUES ($1, $2, $3)
        RETURNING event_id
      `;

      const eventData = {
        ...actionData,
        player_id: playerId,
        target_ids: targetIds,
        phase: gameState.current_phase,
        phase_number: current_phase_number,
        role_name: gameState.role_name,
        action: actionType,
      };

      const eventValues = [gameId, `player_${actionType}`, eventData];

      const eventResult = await client.query(eventQuery, eventValues);

      // If this is a vote, record in game_votes table
      if (actionType === "vote") {
        const targetId = targetIds[0]; // Assuming single target for votes

        // Check if player already voted
        const voteCheckQuery = `
          SELECT vote_id FROM game_votes
          WHERE game_id = $1 
          AND voter_id = $2 
          AND phase_number = $3
        `;
        const voteCheckResult = await client.query(voteCheckQuery, [
          gameId,
          playerId,
          current_phase_number,
        ]);

        if (voteCheckResult.rows.length > 0) {
          // Update existing vote
          const updateVoteQuery = `
            UPDATE game_votes
            SET target_id = $1, 
                created_at = NOW()
            WHERE vote_id = $2
            RETURNING vote_id
          `;
          await client.query(updateVoteQuery, [
            targetId,
            voteCheckResult.rows[0].vote_id,
          ]);
        } else {
          // Insert new vote
          const insertVoteQuery = `
            INSERT INTO game_votes (
              game_id, 
              voter_id, 
              target_id, 
              vote_type, 
              phase_number
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING vote_id
          `;
          await client.query(insertVoteQuery, [
            gameId,
            playerId,
            targetId,
            gameState.current_phase === "day" ? "lynch" : "night_vote",
            current_phase_number,
          ]);
        }
      }

      await client.query("COMMIT");
      return {
        event_id: eventResult.rows[0].event_id,
        message: `${actionType} action recorded successfully`,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error recording player action:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Get the current vote tally
  static async getVoteTally(gameId) {
    try {
      const query = `
        SELECT 
          gv.target_id,
          COUNT(gv.vote_id) as vote_count,
          u.user_id,
          u.username,
          gv.phase_number,
          array_agg(gv.voter_id) as voters
        FROM 
          game_votes gv
        JOIN 
          users u ON gv.target_id = u.user_id
        WHERE 
          gv.game_id = $1
        GROUP BY 
          gv.target_id, u.user_id, u.username, gv.phase_number
        ORDER BY 
          gv.phase_number DESC, vote_count DESC
      `;

      const { rows } = await pool.query(query, [gameId]);
      return rows;
    } catch (error) {
      console.error("Error getting vote tally:", error);
      throw error;
    }
  }

  // Kick a player from game (host only)
  static async kickPlayer(gameId, hostUserId, targetUserId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verify game exists and user is host
      const gameQuery = `
        SELECT status, host_id FROM games
        WHERE game_id = $1
      `;
      const gameResult = await client.query(gameQuery, [gameId]);

      if (gameResult.rows.length === 0) {
        throw new Error("Game not found");
      }

      const game = gameResult.rows[0];

      // Check if user is host
      if (game.host_id !== hostUserId) {
        throw new Error("Only the host can kick players");
      }

      // Check if game is in lobby
      if (game.status !== "lobby") {
        throw new Error("Players can only be kicked while in the lobby");
      }

      // Find target player
      const playerQuery = `
        SELECT id FROM player_games
        WHERE game_id = $1 AND user_id = $2
      `;
      const playerResult = await client.query(playerQuery, [
        gameId,
        targetUserId,
      ]);

      if (playerResult.rows.length === 0) {
        throw new Error("Target player not found in this game");
      }

      const playerId = playerResult.rows[0].id;

      // Delete player from game
      const deleteQuery = `
        DELETE FROM player_games
        WHERE id = $1
        RETURNING id
      `;
      const deleteResult = await client.query(deleteQuery, [playerId]);

      // Record kick event
      await client.query(
        `
        INSERT INTO game_events (
          game_id,
          event_type,
          event_data
        )
        VALUES ($1, $2, $3)
      `,
        [
          gameId,
          "player_kicked",
          JSON.stringify({ player_id: playerId, kicked_by: hostUserId }),
        ]
      );

      await client.query("COMMIT");
      return { player_id: playerId };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error kicking player:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Allow a player to leave a game
  static async leaveGame(gameId, userId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verify game exists and get status
      const gameQuery = `
        SELECT status, host_id FROM games
        WHERE game_id = $1
      `;
      const gameResult = await client.query(gameQuery, [gameId]);

      if (gameResult.rows.length === 0) {
        throw new Error("Game not found");
      }

      const game = gameResult.rows[0];

      // Check if user is the host
      if (game.host_id === userId) {
        throw new Error("Host cannot leave the game");
      }

      // Check if game is in lobby
      if (game.status !== "lobby") {
        throw new Error("Cannot leave a game that is in progress");
      }

      // Find player
      const playerQuery = `
        SELECT id FROM player_games
        WHERE game_id = $1 AND user_id = $2
      `;
      const playerResult = await client.query(playerQuery, [gameId, userId]);

      if (playerResult.rows.length === 0) {
        throw new Error("Player not found in this game");
      }

      const playerId = playerResult.rows[0].id;

      // Delete player from game
      const deleteQuery = `
        DELETE FROM player_games
        WHERE id = $1
        RETURNING id
      `;
      const deleteResult = await client.query(deleteQuery, [playerId]);

      // Record leave event
      await client.query(
        `
        INSERT INTO game_events (
          game_id,
          event_type,
          event_data
        )
        VALUES ($1, $2, $3)
      `,
        [
          gameId,
          "player_left",
          JSON.stringify({ player_id: playerId, user_id: userId }),
        ]
      );

      await client.query("COMMIT");
      return { player_id: playerId, game_id: gameId };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error leaving game:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Update game state
  static async updateGameState(gameId, updates) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const updateQuery = `
        UPDATE games
        SET 
          current_phase = COALESCE($1, current_phase),
          time_remaining = COALESCE($2, time_remaining),
          status = COALESCE($3, status),
          winner_faction = COALESCE($4, winner_faction)
        WHERE game_id = $5
        RETURNING *
      `;

      const values = [
        updates.current_phase,
        updates.time_remaining,
        updates.status,
        updates.winner_faction,
        gameId,
      ];

      const result = await client.query(updateQuery, values);
      await client.query("COMMIT");
      return result.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Process night phase actions
  static async processNightActions(gameId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get the latest phase number
      const phaseQuery = `
        SELECT COALESCE(MAX(phase_number), 1) as current_phase_number 
        FROM game_votes 
        WHERE game_id = $1
      `;
      const phaseResult = await client.query(phaseQuery, [gameId]);
      const current_phase_number = phaseResult.rows[0].current_phase_number;

      // Get all night actions and player information
      const actionsQuery = `
        SELECT 
          e.event_data,
          e.event_type,
          pg.id as player_game_id,
          pg.user_id,
          pg.role_id,
          pg.is_alive,
          r.role_name,
          r.faction,
          r.ability_description
        FROM game_events e
        JOIN player_games pg ON (e.event_data->>'player_id')::uuid = pg.id
        JOIN roles r ON pg.role_id = r.role_id
        WHERE e.game_id = $1 
        AND (e.event_data->>'phase' = 'night')
        AND (e.event_data->>'phase_number')::int = $2
        AND pg.is_alive = true
        AND e.event_type = 'player_ability'
      `;

      const actions = await client.query(actionsQuery, [
        gameId,
        current_phase_number,
      ]);

      // Process werewolf kills first
      const werewolfKills = actions.rows.filter(
        (action) =>
          action.role_name === "Werewolf" && action.event_data.action === "kill"
      );

      if (werewolfKills.length > 0) {
        // Count votes for each target
        const killVotes = {};
        werewolfKills.forEach((kill) => {
          const targetId = kill.event_data.target_id;
          killVotes[targetId] = (killVotes[targetId] || 0) + 1;
        });

        // Find most voted target
        const mostVotedTarget = Object.entries(killVotes).sort(
          ([, a], [, b]) => b - a
        )[0];

        if (mostVotedTarget) {
          const [targetId] = mostVotedTarget;

          // Check if target was protected by doctor
          const doctorProtections = actions.rows.filter(
            (action) =>
              action.role_name === "Doctor" &&
              action.event_data.action === "protect" &&
              action.event_data.target_id === targetId
          );

          if (doctorProtections.length === 0) {
            // Get target player info
            const targetInfo = await client.query(
              `SELECT pg.id, pg.user_id, u.username
               FROM player_games pg
               JOIN users u ON pg.user_id = u.user_id
               WHERE pg.id = $1`,
              [targetId]
            );

            if (targetInfo.rows.length > 0) {
              const target = targetInfo.rows[0];

              // Kill the player if not protected
              await client.query(
                `UPDATE player_games 
                 SET is_alive = false, 
                     death_time = NOW(), 
                     death_cause = 'werewolf_kill'
                 WHERE id = $1`,
                [targetId]
              );

              // Record the kill event
              await client.query(
                `INSERT INTO game_events 
                 (game_id, event_type, event_data, phase, phase_number, is_public)
                 VALUES ($1, 'player_killed', $2, 'night', $3, true)`,
                [
                  gameId,
                  JSON.stringify({
                    cause: "werewolf_kill",
                    target_id: targetId,
                    target_user_id: target.user_id,
                    target_username: target.username,
                    votes: killVotes[targetId],
                    killers: werewolfKills.map((k) => ({
                      user_id: k.user_id,
                      player_game_id: k.player_game_id,
                    })),
                  }),
                  current_phase_number,
                ]
              );
            }
          } else {
            // Get protection info
            const protector = doctorProtections[0];
            const targetInfo = await client.query(
              `SELECT u.username
               FROM player_games pg
               JOIN users u ON pg.user_id = u.user_id
               WHERE pg.id = $1`,
              [targetId]
            );

            // Record the protection event
            await client.query(
              `INSERT INTO game_events 
               (game_id, event_type, event_data, phase, phase_number, is_public)
               VALUES ($1, 'player_protected', $2, 'night', $3, false)`,
              [
                gameId,
                JSON.stringify({
                  target_id: targetId,
                  target_username: targetInfo.rows[0]?.username,
                  protected_by: protector.user_id,
                  protector_username: protector.username,
                }),
                current_phase_number,
              ]
            );
          }
        }
      }

      // Process Seer investigations
      const seerActions = actions.rows.filter(
        (action) =>
          action.role_name === "Seer" &&
          action.event_data.action === "investigate"
      );

      for (const action of seerActions) {
        const targetId = action.event_data.target_id;

        // Get target's role information
        const targetInfo = await client.query(
          `SELECT r.faction, r.role_name, u.username
           FROM player_games pg
           JOIN roles r ON pg.role_id = r.role_id
           JOIN users u ON pg.user_id = u.user_id
           WHERE pg.id = $1`,
          [targetId]
        );

        if (targetInfo.rows.length > 0) {
          const { faction, role_name, username } = targetInfo.rows[0];

          // Record the investigation result
          await client.query(
            `INSERT INTO game_events 
             (game_id, event_type, event_data, phase, phase_number, is_public)
             VALUES ($1, 'investigation_result', $2, 'night', $3, false)`,
            [
              gameId,
              JSON.stringify({
                seer_id: action.user_id,
                seer_username: action.username,
                target_id: targetId,
                target_username: username,
                result: {
                  faction: faction,
                  role_name: role_name,
                },
              }),
              current_phase_number,
            ]
          );
        }
      }

      // Check if all players have submitted their actions
      const alivePlayersQuery = `
        SELECT COUNT(*) as count
        FROM player_games pg
        WHERE pg.game_id = $1 
        AND pg.is_alive = true
      `;
      const alivePlayersResult = await client.query(alivePlayersQuery, [
        gameId,
      ]);
      const aliveCount = parseInt(alivePlayersResult.rows[0].count);

      const actionsSubmittedQuery = `
        SELECT COUNT(DISTINCT (event_data->>'player_id')::uuid) as count
        FROM game_events
        WHERE game_id = $1 
        AND (event_data->>'phase' = 'night')
        AND (event_data->>'phase_number')::int = $2
        AND event_type = 'player_ability'
      `;
      const actionsSubmittedResult = await client.query(actionsSubmittedQuery, [
        gameId,
        current_phase_number,
      ]);
      const actionsSubmitted = parseInt(actionsSubmittedResult.rows[0].count);

      // If all actions submitted, prepare for day phase
      if (actionsSubmitted >= aliveCount) {
        await client.query(
          `UPDATE games 
           SET current_phase = 'day'
           WHERE game_id = $1`,
          [gameId]
        );

        // Record phase transition event
        await client.query(
          `INSERT INTO game_events 
           (game_id, event_type, event_data, phase, phase_number, is_public)
           VALUES ($1, 'phase_transition', $2, 'day', $3, true)`,
          [
            gameId,
            JSON.stringify({
              from_phase: "night",
              to_phase: "day",
              phase_number: current_phase_number + 1,
              summary: {
                kills: werewolfKills.length,
                protections: actions.rows.filter(
                  (a) =>
                    a.role_name === "Doctor" &&
                    a.event_data.action === "protect"
                ).length,
                investigations: seerActions.length,
              },
            }),
            current_phase_number + 1,
          ]
        );

        // Check win conditions after night phase
        await Game.checkWinConditions(gameId);
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Process day phase actions
  static async processDayActions(gameId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get the latest phase number
      const phaseQuery = `
        SELECT COALESCE(MAX(phase_number), 1) as current_phase_number 
        FROM game_votes 
        WHERE game_id = $1
      `;
      const phaseResult = await client.query(phaseQuery, [gameId]);
      const current_phase_number = phaseResult.rows[0].current_phase_number;

      // Get all votes for the current phase with voter information
      const votesQuery = `
        SELECT 
          v.*,
          pg.user_id as voter_id,
          pg.is_alive as voter_alive,
          t.user_id as target_user_id,
          t.is_alive as target_alive,
          u.username as target_username
        FROM game_votes v
        JOIN player_games pg ON v.voter_id = pg.id
        JOIN player_games t ON v.target_id = t.id
        JOIN users u ON t.user_id = u.user_id
        WHERE v.game_id = $1 
        AND v.phase_number = $2
        AND v.vote_type = 'lynch'
        AND pg.is_alive = true
      `;

      const votes = await client.query(votesQuery, [
        gameId,
        current_phase_number,
      ]);

      // Only count votes from alive players targeting alive players
      const validVotes = votes.rows.filter(
        (vote) => vote.voter_alive && vote.target_alive
      );

      // Count votes for each target
      const voteCounts = {};
      validVotes.forEach((vote) => {
        const targetId = vote.target_id;
        voteCounts[targetId] = voteCounts[targetId] || {
          count: 0,
          user_id: vote.target_user_id,
          username: vote.target_username,
          voters: [],
        };
        voteCounts[targetId].count += 1;
        voteCounts[targetId].voters.push(vote.voter_id);
      });

      // Find most voted player(s)
      const sortedVotes = Object.entries(voteCounts).sort(
        ([, a], [, b]) => b.count - a.count
      );

      if (sortedVotes.length > 0) {
        const [topTargetId, topVoteInfo] = sortedVotes[0];
        const tiedVotes = sortedVotes.filter(
          ([, info]) => info.count === topVoteInfo.count
        );

        // If there's a clear winner (no tie)
        if (tiedVotes.length === 1) {
          // Eliminate the player
          await client.query(
            `UPDATE player_games 
             SET is_alive = false, 
                 death_time = NOW(), 
                 death_cause = 'lynch'
             WHERE id = $1`,
            [topTargetId]
          );

          // Record the lynch event
          await client.query(
            `INSERT INTO game_events 
             (game_id, event_type, event_data, phase, phase_number, is_public)
             VALUES ($1, 'player_lynched', $2, 'day', $3, true)`,
            [
              gameId,
              JSON.stringify({
                target_id: topTargetId,
                user_id: topVoteInfo.user_id,
                username: topVoteInfo.username,
                vote_count: topVoteInfo.count,
                voters: topVoteInfo.voters,
              }),
              current_phase_number,
            ]
          );
        } else {
          // Record the tie event
          await client.query(
            `INSERT INTO game_events 
             (game_id, event_type, event_data, phase, phase_number, is_public)
             VALUES ($1, 'lynch_tie', $2, 'day', $3, true)`,
            [
              gameId,
              JSON.stringify({
                tied_targets: tiedVotes.map(([id, info]) => ({
                  target_id: id,
                  user_id: info.user_id,
                  username: info.username,
                  vote_count: info.count,
                  voters: info.voters,
                })),
              }),
              current_phase_number,
            ]
          );
        }

        // Transition to night phase
        await client.query(
          `UPDATE games 
           SET current_phase = 'night'
           WHERE game_id = $1`,
          [gameId]
        );

        // Record phase transition
        await client.query(
          `INSERT INTO game_events 
           (game_id, event_type, event_data, phase, phase_number, is_public)
           VALUES ($1, 'phase_transition', $2, 'night', $3, true)`,
          [
            gameId,
            JSON.stringify({
              from_phase: "day",
              to_phase: "night",
              phase_number: current_phase_number + 1,
            }),
            current_phase_number + 1,
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Check win conditions
  static async checkWinConditions(gameId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get alive players by faction
      const playersQuery = `
        SELECT 
          pg.user_id,
          pg.is_alive,
          r.faction,
          r.role_name,
          u.username
        FROM player_games pg
        JOIN roles r ON pg.role_id = r.role_id
        JOIN users u ON pg.user_id = u.user_id
        WHERE pg.game_id = $1
      `;

      const players = await client.query(playersQuery, [gameId]);

      const alivePlayers = players.rows.filter((p) => p.is_alive);
      const aliveWerewolves = alivePlayers.filter(
        (p) => p.faction === "werewolf"
      );
      const aliveVillagers = alivePlayers.filter(
        (p) => p.faction === "village"
      );

      // Get current phase number
      const phaseQuery = `
        SELECT COALESCE(MAX(phase_number), 1) as current_phase_number 
        FROM game_votes 
        WHERE game_id = $1
      `;
      const phaseResult = await client.query(phaseQuery, [gameId]);
      const current_phase_number = phaseResult.rows[0].current_phase_number;

      // Check win conditions
      let winner = null;
      if (aliveWerewolves.length === 0) {
        winner = "village";
      } else if (aliveWerewolves.length >= aliveVillagers.length) {
        winner = "werewolf";
      }

      if (winner) {
        // Update game status
        await client.query(
          `UPDATE games 
           SET status = 'completed', 
               winner_faction = $1,
               ended_at = NOW()
           WHERE game_id = $2`,
          [winner, gameId]
        );

        // Record game end event
        await client.query(
          `INSERT INTO game_events 
           (game_id, event_type, event_data, phase, phase_number, is_public)
           VALUES ($1, 'game_ended', $2, 'end', $3, true)`,
          [
            gameId,
            JSON.stringify({
              winner_faction: winner,
              alive_players: alivePlayers.map((p) => ({
                user_id: p.user_id,
                username: p.username,
                role: p.role_name,
                faction: p.faction,
              })),
              stats: {
                total_players: players.rows.length,
                alive_werewolves: aliveWerewolves.length,
                alive_villagers: aliveVillagers.length,
                total_phases: current_phase_number,
              },
            }),
            current_phase_number,
          ]
        );

        // Record final state for each player
        for (const player of players.rows) {
          await client.query(
            `UPDATE player_games
             SET result = $1
             WHERE game_id = $2 AND user_id = $3`,
            [
              JSON.stringify({
                survived: player.is_alive,
                role: player.role_name,
                faction: player.faction,
                won: player.faction === winner,
              }),
              gameId,
              player.user_id,
            ]
          );
        }
      }

      await client.query("COMMIT");
      return {
        winner,
        stats: winner
          ? {
              total_players: players.rows.length,
              alive_werewolves: aliveWerewolves.length,
              alive_villagers: aliveVillagers.length,
              total_phases: current_phase_number,
            }
          : null,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get role actions for the current phase
   * @param {string} gameId - The game ID
   * @returns {Promise<Object>} - Object with player IDs as keys and boolean values indicating if they've used their actions
   */
  static async getRoleActions(gameId) {
    try {
      // Get current game state
      const { rows: gameState } = await pool.query(
        `SELECT current_phase FROM games WHERE game_id = $1`,
        [gameId]
      );

      if (gameState.length === 0) {
        throw new Error("Game not found");
      }

      const { current_phase } = gameState[0];

      // Get the latest phase number from game_votes
      const { rows: phaseData } = await pool.query(
        `SELECT COALESCE(MAX(phase_number), 1) as current_phase_number 
         FROM game_votes 
         WHERE game_id = $1`,
        [gameId]
      );

      const current_phase_number = phaseData[0].current_phase_number;

      // Get actions from game_events table
      const { rows: events } = await pool.query(
        `SELECT e.event_data, e.event_type
         FROM game_events e
         WHERE e.game_id = $1
         AND e.event_type IN ('player_vote', 'player_ability', 'player_ready')
         AND (e.event_data->>'phase' = $2)
         AND (e.event_data->>'phase_number')::int = $3`,
        [gameId, current_phase, current_phase_number]
      );

      // Get all players in this game
      const { rows: players } = await pool.query(
        `SELECT pg.id, pg.user_id, pg.role_id, r.role_name
         FROM player_games pg
         JOIN roles r ON pg.role_id = r.role_id
         WHERE pg.game_id = $1 AND pg.is_alive = true`,
        [gameId]
      );

      const actionsByPlayer = {};

      // Initialize all players as not having used actions yet
      players.forEach((player) => {
        actionsByPlayer[player.user_id] = {
          hasActed: false,
          role: player.role_name,
        };
      });

      // Mark players who have used actions
      events.forEach((event) => {
        const eventData = event.event_data;
        if (eventData.player_id) {
          const player = players.find((p) => p.id === eventData.player_id);
          if (player) {
            actionsByPlayer[player.user_id].hasActed = true;
            if (event.event_type === "player_ability") {
              actionsByPlayer[player.user_id].ability = eventData.action;
            } else if (event.event_type === "player_vote") {
              actionsByPlayer[player.user_id].vote = eventData.target_id;
            }
          }
        }
      });

      return actionsByPlayer;
    } catch (error) {
      console.error("Error getting role actions:", error);
      throw error;
    }
  }

  /**
   * Get current votes for the game
   * @param {string} gameId - The game ID
   * @returns {Promise<Object>} - Object with target user IDs as keys and arrays of voter IDs as values
   */
  static async getCurrentVotes(gameId) {
    try {
      // Get the current phase
      const { rows: gameData } = await pool.query(
        `SELECT current_phase 
         FROM games 
         WHERE game_id = $1`,
        [gameId]
      );

      if (gameData.length === 0) {
        throw new Error("Game not found");
      }

      const { current_phase } = gameData[0];

      // Get the latest phase number from game_votes
      const { rows: phaseData } = await pool.query(
        `SELECT COALESCE(MAX(phase_number), 1) as current_phase_number 
         FROM game_votes 
         WHERE game_id = $1`,
        [gameId]
      );

      const current_phase_number = phaseData[0].current_phase_number;

      // Get votes from the current phase
      const { rows } = await pool.query(
        `SELECT voter_id, target_id 
         FROM game_votes 
         WHERE game_id = $1 
         AND phase_number = $2 
         AND vote_type = $3`,
        [
          gameId,
          current_phase_number,
          current_phase === "day" ? "lynch" : "night_vote",
        ]
      );

      // Organize votes by target
      const votesByTarget = {};
      rows.forEach((vote) => {
        if (!vote.target_id) return;

        if (!votesByTarget[vote.target_id]) {
          votesByTarget[vote.target_id] = [];
        }
        votesByTarget[vote.target_id].push(vote.voter_id);
      });

      return votesByTarget;
    } catch (error) {
      console.error("Error getting current votes:", error);
      throw error;
    }
  }
}

// Export the Game class
module.exports = {
  Game,
};
