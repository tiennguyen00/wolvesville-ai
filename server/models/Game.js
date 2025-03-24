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
        "SELECT user_id FROM users WHERE user_id = $1",
        [hostUserId]
      );

      if (userCheck.rows.length === 0) {
        throw new Error("Host user not found");
      }

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

      // Check if game exists and is in lobby state
      const gameQuery = `
        SELECT 
          game_id, 
          status, 
          max_players, 
          password_protected, 
          game_password
        FROM 
          games
        WHERE 
          game_id = $1
      `;
      const gameResult = await client.query(gameQuery, [gameId]);

      if (gameResult.rows.length === 0) {
        throw new Error("Game not found");
      }

      const game = gameResult.rows[0];

      if (game.status !== "lobby") {
        throw new Error("Cannot join a game that has already started");
      }

      // Check password if required
      if (game.password_protected) {
        if (!gamePassword) {
          throw new Error("Password is required to join this game");
        }

        if (gamePassword !== game.game_password) {
          throw new Error("Invalid password");
        }
      }

      // Check if player is already in the game
      const playerCheckQuery = `
        SELECT id FROM player_games
        WHERE game_id = $1 AND user_id = $2
      `;
      const playerCheckResult = await client.query(playerCheckQuery, [
        gameId,
        userId,
      ]);

      if (playerCheckResult.rows.length > 0) {
        // Player already in game, return existing id
        await client.query("COMMIT");
        return {
          player_id: playerCheckResult.rows[0].id,
          game_id: gameId,
        };
      }

      // Check if game is full
      const countQuery = `
        SELECT COUNT(*) as player_count FROM player_games
        WHERE game_id = $1
      `;
      const countResult = await client.query(countQuery, [gameId]);

      if (parseInt(countResult.rows[0].player_count) >= game.max_players) {
        throw new Error("Game is full");
      }

      // Add player to game
      const playerInsertQuery = `
        INSERT INTO player_games (game_id, user_id, is_alive)
        VALUES ($1, $2, $3)
        RETURNING id
      `;
      const playerInsertResult = await client.query(playerInsertQuery, [
        gameId,
        userId,
        true,
      ]);

      await client.query("COMMIT");
      return {
        player_id: playerInsertResult.rows[0].id,
        game_id: gameId,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error joining game:", error);
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
        SELECT host_id FROM games
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

      // Get all available roles from the settings
      const gameQuery = `SELECT settings FROM games WHERE game_id = $1`;
      const gameResult = await client.query(gameQuery, [gameId]);
      const settings = gameResult.rows[0].settings || {};

      let roleIds = [];
      if (settings.roles && Array.isArray(settings.roles)) {
        roleIds = settings.roles;
      } else {
        // Fallback - get default roles
        const rolesQuery = `SELECT role_id FROM roles LIMIT 3`;
        const rolesResult = await client.query(rolesQuery);
        roleIds = rolesResult.rows.map((r) => r.role_id);
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
        // Cycle through roles if there are more players than roles
        const roleIndex = i % roleIds.length;
        const roleId = roleIds[roleIndex];

        await client.query(
          `
          UPDATE player_games
          SET role_id = $1
          WHERE id = $2
        `,
          [roleId, players[i]]
        );
      }

      // Record game start event
      await client.query(
        `
        INSERT INTO game_events (
          game_id,
          event_type,
          event_data
        )
        VALUES ($1, $2, $3)
      `,
        [gameId, "game_started", JSON.stringify({ player_count: playerCount })]
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
          pg.id,
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
      const playerId = gameState.id;

      // Check if player is alive
      if (!gameState.is_alive) {
        throw new Error("Dead players cannot perform actions");
      }

      // Validate action type and phase (simplified validation)
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

      const eventValues = [
        gameId,
        `player_${actionType}`,
        JSON.stringify({
          ...actionData,
          player_id: playerId,
          target_ids: targetIds,
        }),
      ];

      const eventResult = await client.query(eventQuery, eventValues);

      // If this is a vote, record in game_votes table
      if (actionType === "vote") {
        const targetId = targetIds[0]; // Assuming single target for votes

        // Check if player already voted
        const voteCheckQuery = `
          SELECT vote_id FROM game_votes
          WHERE game_id = $1 AND voter_id = $2 AND phase_number = 
            (SELECT COALESCE(MAX(phase_number), 1) FROM game_votes WHERE game_id = $1)
        `;
        const voteCheckResult = await client.query(voteCheckQuery, [
          gameId,
          userId,
        ]);

        if (voteCheckResult.rows.length > 0) {
          // Update existing vote
          const updateVoteQuery = `
            UPDATE game_votes
            SET target_id = $1, created_at = NOW()
            WHERE vote_id = $2
            RETURNING vote_id
          `;
          await client.query(updateVoteQuery, [
            targetId,
            voteCheckResult.rows[0].vote_id,
          ]);
        } else {
          // Insert new vote
          const phaseQuery = `
            SELECT COALESCE(MAX(phase_number), 0) + 1 as next_phase 
            FROM game_votes 
            WHERE game_id = $1
          `;
          const phaseResult = await client.query(phaseQuery, [gameId]);
          const phaseNumber = phaseResult.rows[0].next_phase;

          const insertVoteQuery = `
            INSERT INTO game_votes (game_id, voter_id, target_id, vote_type, phase_number)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING vote_id
          `;
          await client.query(insertVoteQuery, [
            gameId,
            userId,
            targetId,
            "day_vote", // Default vote type
            phaseNumber,
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
          day_number = COALESCE($2, day_number),
          time_remaining = COALESCE($3, time_remaining),
          status = COALESCE($4, status),
          winner_faction = COALESCE($5, winner_faction)
        WHERE game_id = $6
        RETURNING *
      `;

      const values = [
        updates.current_phase,
        updates.day_number,
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

      // Get all night actions
      const actionsQuery = `
        SELECT 
          e.*,
          pg.user_id as player_id,
          pg.role_id,
          r.role_name,
          r.faction
        FROM game_events e
        JOIN player_games pg ON e.initiator_id = pg.id
        JOIN roles r ON pg.role_id = r.role_id
        WHERE e.game_id = $1 
        AND e.phase = 'night'
        AND e.day_number = (SELECT current_day FROM games WHERE game_id = $1)
      `;

      const actions = await client.query(actionsQuery, [gameId]);

      // Process werewolf kills
      const werewolfKills = actions.rows.filter(
        (action) => action.role_name === "Werewolf"
      );

      if (werewolfKills.length > 0) {
        // Count votes for each target
        const killVotes = {};
        werewolfKills.forEach((kill) => {
          kill.target_ids.forEach((targetId) => {
            killVotes[targetId] = (killVotes[targetId] || 0) + 1;
          });
        });

        // Find most voted target
        const mostVotedTarget = Object.entries(killVotes).sort(
          ([, a], [, b]) => b - a
        )[0];

        if (mostVotedTarget) {
          const [targetId] = mostVotedTarget;

          // Kill the player
          await client.query(
            `UPDATE player_games 
             SET is_alive = false, death_time = NOW(), death_cause = 'werewolf_kill'
             WHERE id = $1`,
            [targetId]
          );

          // Record the kill event
          await client.query(
            `INSERT INTO game_events 
             (game_id, event_type, event_data, target_ids, phase, day_number, is_public)
             VALUES ($1, 'player_killed', $2, $3, 'night', $4, true)`,
            [
              gameId,
              JSON.stringify({ cause: "werewolf_kill" }),
              [targetId],
              (
                await client.query(
                  "SELECT current_day FROM games WHERE game_id = $1",
                  [gameId]
                )
              ).rows[0].current_day,
            ]
          );
        }
      }

      // Process other night actions (Seer, Doctor, etc.)
      const otherActions = actions.rows.filter(
        (action) => action.role_name !== "Werewolf"
      );

      for (const action of otherActions) {
        // Process based on role
        switch (action.role_name) {
          case "Seer":
            // Record investigation result
            await client.query(
              `INSERT INTO game_events 
               (game_id, event_type, event_data, target_ids, phase, day_number, is_public)
               VALUES ($1, 'investigation_result', $2, $3, 'night', $4, false)`,
              [
                gameId,
                JSON.stringify({
                  investigator_id: action.player_id,
                  target_id: action.target_ids[0],
                  result: action.event_data.result,
                }),
                action.target_ids,
                (
                  await client.query(
                    "SELECT current_day FROM games WHERE game_id = $1",
                    [gameId]
                  )
                ).rows[0].current_day,
              ]
            );
            break;
          case "Doctor":
            // Record protection
            await client.query(
              `INSERT INTO game_events 
               (game_id, event_type, event_data, target_ids, phase, day_number, is_public)
               VALUES ($1, 'protection_applied', $2, $3, 'night', $4, false)`,
              [
                gameId,
                JSON.stringify({
                  doctor_id: action.player_id,
                  protected_id: action.target_ids[0],
                }),
                action.target_ids,
                (
                  await client.query(
                    "SELECT current_day FROM games WHERE game_id = $1",
                    [gameId]
                  )
                ).rows[0].current_day,
              ]
            );
            break;
        }
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

      // Get all votes for the current day
      const votesQuery = `
        SELECT 
          v.*,
          pg.user_id as voter_id
        FROM game_votes v
        JOIN player_games pg ON v.voter_id = pg.id
        WHERE v.game_id = $1 
        AND v.phase_number = (SELECT current_day FROM games WHERE game_id = $1)
      `;

      const votes = await client.query(votesQuery, [gameId]);

      // Count votes for each target
      const voteCounts = {};
      votes.rows.forEach((vote) => {
        voteCounts[vote.target_id] = (voteCounts[vote.target_id] || 0) + 1;
      });

      // Find most voted player
      const mostVoted = Object.entries(voteCounts).sort(
        ([, a], [, b]) => b - a
      )[0];

      if (mostVoted) {
        const [targetId] = mostVoted;

        // Eliminate the player
        await client.query(
          `UPDATE player_games 
           SET is_alive = false, death_time = NOW(), death_cause = 'lynch'
           WHERE id = $1`,
          [targetId]
        );

        // Record the lynch event
        await client.query(
          `INSERT INTO game_events 
           (game_id, event_type, event_data, target_ids, phase, day_number, is_public)
           VALUES ($1, 'player_lynched', $2, $3, 'day', $4, true)`,
          [
            gameId,
            JSON.stringify({
              vote_count: voteCounts[targetId],
              voters: votes.rows
                .filter((v) => v.target_id === targetId)
                .map((v) => v.voter_id),
            }),
            [targetId],
            (
              await client.query(
                "SELECT current_day FROM games WHERE game_id = $1",
                [gameId]
              )
            ).rows[0].current_day,
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
          r.faction
        FROM player_games pg
        JOIN roles r ON pg.role_id = r.role_id
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
           (game_id, event_type, event_data, phase, day_number, is_public)
           VALUES ($1, 'game_ended', $2, 'day', $3, true)`,
          [
            gameId,
            JSON.stringify({
              winner_faction: winner,
              alive_players: alivePlayers.map((p) => p.user_id),
            }),
            (
              await client.query(
                "SELECT current_day FROM games WHERE game_id = $1",
                [gameId]
              )
            ).rows[0].current_day,
          ]
        );
      }

      await client.query("COMMIT");
      return winner;
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
        `SELECT current_phase, day_number FROM games WHERE game_id = $1`,
        [gameId]
      );

      if (gameState.length === 0) {
        throw new Error("Game not found");
      }

      const { current_phase, day_number } = gameState[0];

      // Get actions from game_events table
      const { rows } = await pool.query(
        `SELECT initiator_id, event_type
         FROM game_events
         WHERE game_id = $1
         AND phase = $2
         AND day_number = $3
         AND event_type IN ('player_vote', 'player_ability', 'player_ready')
         GROUP BY initiator_id, event_type`,
        [gameId, current_phase, day_number]
      );

      const actionsByPlayer = {};

      // Get all players in this game
      const { rows: players } = await pool.query(
        `SELECT pg.id, pg.user_id 
         FROM player_games pg
         WHERE pg.game_id = $1 AND pg.is_alive = true`,
        [gameId]
      );

      // Initialize all players as not having used actions yet
      players.forEach((player) => {
        actionsByPlayer[player.user_id] = false;
      });

      // Mark players who have used actions
      rows.forEach((row) => {
        const playerId = row.initiator_id;
        const player = players.find((p) => p.id === playerId);
        if (player) {
          actionsByPlayer[player.user_id] = true;
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
      // Get the current day and phase
      const { rows: gameData } = await pool.query(
        `SELECT day_number, current_phase 
         FROM games 
         WHERE game_id = $1`,
        [gameId]
      );

      if (gameData.length === 0) {
        throw new Error("Game not found");
      }

      const { day_number, current_phase } = gameData[0];

      // Get votes from the current day and phase
      const { rows } = await pool.query(
        `SELECT voter_id, target_id 
         FROM game_votes 
         WHERE game_id = $1 
         AND phase_number = $2 
         AND vote_type = $3`,
        [
          gameId,
          day_number,
          current_phase === "day" ? "day_vote" : "night_vote",
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

module.exports = Game;
