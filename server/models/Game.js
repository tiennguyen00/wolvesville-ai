const { pool } = require("../config/db");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

class Game {
  // Get list of available games with optional status filter
  static async getGames(status = null) {
    try {
      let query = `
        SELECT 
          gs.session_id,
          gs.game_mode,
          gs.status,
          gs.max_players,
          COUNT(gp.player_id) as current_players,
          u.username as host_username,
          gs.created_at,
          gs.password_protected
        FROM 
          game_sessions gs
        LEFT JOIN 
          game_players gp ON gs.session_id = gp.session_id
        LEFT JOIN 
          users u ON gs.host_user_id = u.user_id
      `;

      const params = [];
      if (status) {
        query += ` WHERE gs.status = $1`;
        params.push(status);
      }

      query += `
        GROUP BY 
          gs.session_id, u.username
        ORDER BY 
          gs.created_at DESC
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
    password = null,
    settings = {}
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
      let passwordProtected = false;
      if (password) {
        passwordHash = await bcrypt.hash(password, 10);
        passwordProtected = true;
      }

      // Insert new game session
      const gameQuery = `
        INSERT INTO game_sessions (
          host_user_id, 
          game_mode, 
          max_players, 
          password_protected, 
          password_hash,
          settings
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING session_id, created_at, status
      `;
      const gameValues = [
        hostUserId,
        gameMode || "classic",
        maxPlayers || 12,
        passwordProtected,
        passwordHash,
        JSON.stringify(settings),
      ];

      const gameResult = await client.query(gameQuery, gameValues);
      const game = gameResult.rows[0];

      // Add host as first player
      const playerQuery = `
        INSERT INTO game_players (session_id, user_id, position)
        VALUES ($1, $2, 0)
        RETURNING player_id
      `;
      const playerValues = [game.session_id, hostUserId];
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
  static async getGameDetails(sessionId) {
    try {
      // Get game session details
      const gameQuery = `
        SELECT 
          gs.session_id,
          gs.game_mode,
          gs.status,
          gs.current_phase,
          gs.current_day,
          gs.max_players,
          u.username as host_username,
          gs.created_at,
          gs.started_at,
          gs.ended_at,
          gs.password_protected,
          gs.settings
        FROM 
          game_sessions gs
        LEFT JOIN 
          users u ON gs.host_user_id = u.user_id
        WHERE 
          gs.session_id = $1
      `;
      const gameResult = await pool.query(gameQuery, [sessionId]);

      if (gameResult.rows.length === 0) {
        return null;
      }

      const game = gameResult.rows[0];

      // Get players in this game
      const playersQuery = `
        SELECT 
          gp.player_id,
          gp.user_id,
          u.username,
          gp.position,
          gp.join_time,
          gp.is_alive,
          gp.team,
          gp.role_id,
          r.name as role_name
        FROM 
          game_players gp
        JOIN 
          users u ON gp.user_id = u.user_id
        LEFT JOIN 
          roles r ON gp.role_id = r.role_id
        WHERE 
          gp.session_id = $1
        ORDER BY 
          gp.position ASC
      `;
      const playersResult = await pool.query(playersQuery, [sessionId]);

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
  static async joinGame(sessionId, userId, password = null) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check if game exists and is in lobby state
      const gameQuery = `
        SELECT 
          session_id, 
          status, 
          max_players, 
          password_protected, 
          password_hash
        FROM 
          game_sessions
        WHERE 
          session_id = $1
      `;
      const gameResult = await client.query(gameQuery, [sessionId]);

      if (gameResult.rows.length === 0) {
        throw new Error("Game not found");
      }

      const game = gameResult.rows[0];

      if (game.status !== "lobby") {
        throw new Error("Cannot join a game that has already started");
      }

      // Check password if required
      if (game.password_protected) {
        if (!password) {
          throw new Error("Password is required to join this game");
        }

        const passwordValid = await bcrypt.compare(
          password,
          game.password_hash
        );
        if (!passwordValid) {
          throw new Error("Invalid password");
        }
      }

      // Check if player is already in the game
      const playerCheckQuery = `
        SELECT player_id FROM game_players
        WHERE session_id = $1 AND user_id = $2
      `;
      const playerCheckResult = await client.query(playerCheckQuery, [
        sessionId,
        userId,
      ]);

      if (playerCheckResult.rows.length > 0) {
        // Player already in game, return existing player_id
        await client.query("COMMIT");
        return {
          player_id: playerCheckResult.rows[0].player_id,
          game_id: sessionId,
        };
      }

      // Check if game is full
      const countQuery = `
        SELECT COUNT(*) as player_count FROM game_players
        WHERE session_id = $1
      `;
      const countResult = await client.query(countQuery, [sessionId]);

      if (parseInt(countResult.rows[0].player_count) >= game.max_players) {
        throw new Error("Game is full");
      }

      // Get next available position
      const positionQuery = `
        SELECT COALESCE(MAX(position) + 1, 0) as next_position
        FROM game_players
        WHERE session_id = $1
      `;
      const positionResult = await client.query(positionQuery, [sessionId]);
      const position = positionResult.rows[0].next_position;

      // Add player to game
      const playerInsertQuery = `
        INSERT INTO game_players (session_id, user_id, position)
        VALUES ($1, $2, $3)
        RETURNING player_id
      `;
      const playerInsertResult = await client.query(playerInsertQuery, [
        sessionId,
        userId,
        position,
      ]);

      await client.query("COMMIT");
      return {
        player_id: playerInsertResult.rows[0].player_id,
        game_id: sessionId,
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
          name, 
          description, 
          team, 
          category, 
          ability_type, 
          ability_target, 
          icon_url, 
          enabled
        FROM 
          roles
        WHERE 
          enabled = true
        ORDER BY 
          name ASC
      `;

      const { rows } = await pool.query(query);
      return rows;
    } catch (error) {
      console.error("Error fetching roles:", error);
      throw error;
    }
  }

  // Get game events
  static async getGameEvents(sessionId, since = null) {
    try {
      let query = `
        SELECT 
          event_id,
          event_type,
          event_data,
          initiator_id,
          target_ids,
          phase,
          day_number,
          timestamp,
          is_public
        FROM 
          game_events
        WHERE 
          session_id = $1
      `;

      const params = [sessionId];

      if (since) {
        query += ` AND timestamp > $2`;
        params.push(since);
      }

      query += ` ORDER BY timestamp ASC`;

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (error) {
      console.error("Error fetching game events:", error);
      throw error;
    }
  }

  // Record a game event
  static async recordGameEvent(
    sessionId,
    eventType,
    eventData,
    initiatorId = null,
    targetIds = [],
    phase,
    dayNumber,
    isPublic = true
  ) {
    try {
      const query = `
        INSERT INTO game_events (
          session_id,
          event_type,
          event_data,
          initiator_id,
          target_ids,
          phase,
          day_number,
          is_public
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING event_id, timestamp
      `;

      const values = [
        sessionId,
        eventType,
        JSON.stringify(eventData),
        initiatorId,
        targetIds,
        phase,
        dayNumber,
        isPublic,
      ];

      const { rows } = await pool.query(query, values);
      return rows[0];
    } catch (error) {
      console.error("Error recording game event:", error);
      throw error;
    }
  }

  // Start a game
  static async startGame(sessionId, hostUserId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verify user is host
      const hostQuery = `
        SELECT host_user_id FROM game_sessions
        WHERE session_id = $1
      `;
      const hostResult = await client.query(hostQuery, [sessionId]);

      if (hostResult.rows.length === 0) {
        throw new Error("Game not found");
      }

      if (hostResult.rows[0].host_user_id !== hostUserId) {
        throw new Error("Only the host can start the game");
      }

      // Count players
      const countQuery = `
        SELECT COUNT(*) as player_count FROM game_players
        WHERE session_id = $1
      `;
      const countResult = await client.query(countQuery, [sessionId]);
      const playerCount = parseInt(countResult.rows[0].player_count);

      if (playerCount < 3) {
        throw new Error("Need at least 3 players to start a game");
      }

      // Update game status
      const updateQuery = `
        UPDATE game_sessions
        SET 
          status = 'in_progress',
          started_at = NOW(),
          current_phase = 'night',
          current_day = 1
        WHERE session_id = $1
        RETURNING status, started_at, current_phase, current_day
      `;
      const updateResult = await client.query(updateQuery, [sessionId]);

      // Assign roles (simplified for now - assign werewolves to ~1/3 of players)
      // Get all available roles
      const rolesQuery = `
        SELECT role_id, name, team FROM roles WHERE enabled = true
      `;
      const rolesResult = await client.query(rolesQuery);
      const roles = rolesResult.rows;

      // Get werewolf and villager roles
      const werewolfRole = roles.find((r) => r.name === "Werewolf");
      const villagerRole = roles.find((r) => r.name === "Villager");
      const seerRole = roles.find((r) => r.name === "Seer");

      if (!werewolfRole || !villagerRole) {
        throw new Error("Required roles not found in the database");
      }

      // Get all players
      const playersQuery = `
        SELECT player_id FROM game_players
        WHERE session_id = $1
        ORDER BY RANDOM()
      `;
      const playersResult = await client.query(playersQuery, [sessionId]);
      const players = playersResult.rows.map((p) => p.player_id);

      // Assign werewolves (approximately 1/3 of players)
      const werewolfCount = Math.max(1, Math.floor(players.length / 3));
      const werewolves = players.slice(0, werewolfCount);

      // Assign one seer
      const seerPlayer = players[werewolfCount];

      // Assign villagers to the rest
      const villagers = players.slice(werewolfCount + 1);

      // Update player roles
      for (const playerId of werewolves) {
        await client.query(
          `
          UPDATE game_players
          SET role_id = $1, team = $2
          WHERE player_id = $3
        `,
          [werewolfRole.role_id, werewolfRole.team, playerId]
        );
      }

      if (seerRole && seerPlayer) {
        await client.query(
          `
          UPDATE game_players
          SET role_id = $1, team = $2
          WHERE player_id = $3
        `,
          [seerRole.role_id, seerRole.team, seerPlayer]
        );
      }

      for (const playerId of villagers) {
        await client.query(
          `
          UPDATE game_players
          SET role_id = $1, team = $2
          WHERE player_id = $3
        `,
          [villagerRole.role_id, villagerRole.team, playerId]
        );
      }

      // Record game start event
      await client.query(
        `
        INSERT INTO game_events (
          session_id,
          event_type,
          event_data,
          phase,
          day_number,
          is_public
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
        [
          sessionId,
          "game_started",
          JSON.stringify({ player_count: playerCount }),
          "night",
          1,
          true,
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
    sessionId,
    playerId,
    actionType,
    targetIds,
    actionData = {}
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get game state and player role
      const gameStateQuery = `
        SELECT 
          gs.current_phase,
          gs.current_day,
          gp.role_id,
          gp.is_alive,
          r.name as role_name,
          r.ability_type
        FROM 
          game_sessions gs
        JOIN 
          game_players gp ON gs.session_id = gp.session_id
        JOIN 
          roles r ON gp.role_id = r.role_id
        WHERE 
          gs.session_id = $1 
          AND gp.player_id = $2
      `;
      const gameStateResult = await client.query(gameStateQuery, [
        sessionId,
        playerId,
      ]);

      if (gameStateResult.rows.length === 0) {
        throw new Error("Game or player not found");
      }

      const gameState = gameStateResult.rows[0];

      // Check if player is alive
      if (!gameState.is_alive) {
        throw new Error("Dead players cannot perform actions");
      }

      // Validate action type against role ability
      if (actionType === "kill" && gameState.ability_type !== "kill") {
        throw new Error("This role cannot perform kill actions");
      } else if (
        actionType === "investigate" &&
        gameState.ability_type !== "investigate"
      ) {
        throw new Error("This role cannot perform investigate actions");
      }

      // Validate phase for action
      if (actionType === "kill" && gameState.current_phase !== "night") {
        throw new Error("Kill actions can only be performed at night");
      } else if (actionType === "vote" && gameState.current_phase !== "day") {
        throw new Error("Voting can only be performed during the day");
      }

      // Record action as event
      const eventQuery = `
        INSERT INTO game_events (
          session_id,
          event_type,
          event_data,
          initiator_id,
          target_ids,
          phase,
          day_number,
          is_public
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING event_id
      `;

      const eventValues = [
        sessionId,
        `player_${actionType}`,
        JSON.stringify(actionData),
        playerId,
        targetIds,
        gameState.current_phase,
        gameState.current_day,
        false, // Most player actions are private
      ];

      const eventResult = await client.query(eventQuery, eventValues);

      // If this is a vote, record in votes table
      if (actionType === "vote") {
        const targetId = targetIds[0]; // Assuming single target for votes

        // Check if player already voted
        const voteCheckQuery = `
          SELECT vote_id FROM votes
          WHERE session_id = $1 AND voter_id = $2 AND day_number = $3
        `;
        const voteCheckResult = await client.query(voteCheckQuery, [
          sessionId,
          playerId,
          gameState.current_day,
        ]);

        if (voteCheckResult.rows.length > 0) {
          // Update existing vote
          const updateVoteQuery = `
            UPDATE votes
            SET target_id = $1, timestamp = NOW(), changed_count = changed_count + 1
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
            INSERT INTO votes (session_id, day_number, voter_id, target_id, vote_type)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING vote_id
          `;
          await client.query(insertVoteQuery, [
            sessionId,
            gameState.current_day,
            playerId,
            targetId,
            "lynch", // Default vote type
          ]);
        }
      }

      await client.query("COMMIT");
      return {
        eventId: eventResult.rows[0].event_id,
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
  static async getVoteTally(sessionId, dayNumber) {
    try {
      const query = `
        SELECT 
          v.target_id,
          COUNT(v.vote_id) as vote_count,
          gp.user_id,
          u.username,
          ARRAY_AGG(v.voter_id) as voters
        FROM 
          votes v
        JOIN 
          game_players gp ON v.target_id = gp.player_id
        JOIN 
          users u ON gp.user_id = u.user_id
        WHERE 
          v.session_id = $1 
          AND v.day_number = $2
          AND v.target_id IS NOT NULL
        GROUP BY 
          v.target_id, gp.user_id, u.username
        ORDER BY 
          vote_count DESC
      `;

      const { rows } = await pool.query(query, [sessionId, dayNumber]);
      return rows;
    } catch (error) {
      console.error("Error getting vote tally:", error);
      throw error;
    }
  }
}

module.exports = Game;
