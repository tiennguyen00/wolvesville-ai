const { pool } = require("../config/db");

// Setup chat-related socket event handlers
const setupChatSocketHandlers = (io) => {
  // Create a namespace for chat-related events
  const chatNamespace = io.of("/chat");

  chatNamespace.on("connection", (socket) => {
    console.log(`New connection to chat namespace: ${socket.id}`);

    // Track user data
    let userId = null;
    let sessionId = null;
    let playerId = null;

    // Authenticate user (should be called first)
    socket.on("authenticate", async (data) => {
      try {
        const { user_id, session_id, token } = data;

        // In a real app, verify JWT token here
        userId = user_id;
        sessionId = session_id;

        // Get player ID for this user in this session
        const result = await pool.query(
          `SELECT player_id FROM game_players 
           WHERE session_id = $1 AND user_id = $2`,
          [sessionId, userId]
        );

        if (result.rows.length === 0) {
          throw new Error("Player not found in this game session");
        }

        playerId = result.rows[0].player_id;

        // Join the chat room for this game session
        socket.join(`chat:${sessionId}`);

        // Join a private room for this player (for private messages)
        socket.join(`player:${playerId}`);

        // Acknowledge successful authentication
        socket.emit("authenticated", { success: true, player_id: playerId });
        console.log(
          `User ${userId} authenticated for chat in session ${sessionId}`
        );

        // Send recent chat history
        const chatHistory = await pool.query(
          `SELECT cm.*, u.username as sender_name
           FROM chat_messages cm
           JOIN game_players gp ON cm.sender_id = gp.player_id
           JOIN users u ON gp.user_id = u.user_id
           WHERE cm.session_id = $1 AND cm.message_type = 'public'
           ORDER BY cm.timestamp DESC
           LIMIT 50`,
          [sessionId]
        );

        socket.emit("chat_history", {
          messages: chatHistory.rows.reverse(),
        });
      } catch (error) {
        console.error("Chat authentication error:", error);
        socket.emit("authenticated", { success: false, error: error.message });
      }
    });

    // Send a public message
    socket.on("send_message", async (data) => {
      try {
        const { content } = data;

        if (!sessionId || !userId || !playerId) {
          throw new Error("Not authenticated for chat");
        }

        // Get current game state to determine phase
        const gameResult = await pool.query(
          `SELECT * FROM game_sessions WHERE session_id = $1`,
          [sessionId]
        );

        if (gameResult.rows.length === 0) {
          throw new Error("Game session not found");
        }

        const game = gameResult.rows[0];

        // Get player status to check if alive
        const playerResult = await pool.query(
          `SELECT * FROM game_players WHERE player_id = $1`,
          [playerId]
        );

        if (playerResult.rows.length === 0) {
          throw new Error("Player not found");
        }

        const player = playerResult.rows[0];

        // Dead players can only chat with other dead players
        let messageType = "public";
        if (!player.is_alive && game.status === "in_progress") {
          messageType = "dead";
        }

        // Block chat if game is in night phase and player is alive
        if (
          game.current_phase === "night" &&
          player.is_alive &&
          game.status === "in_progress"
        ) {
          throw new Error("Cannot chat during night phase");
        }

        // Filter the message for inappropriate content (simple example)
        let filteredContent = content;
        const forbiddenWords = ["badword1", "badword2", "badword3"];
        let isCensored = false;

        forbiddenWords.forEach((word) => {
          if (content.toLowerCase().includes(word)) {
            filteredContent = filteredContent.replace(
              new RegExp(word, "gi"),
              "****"
            );
            isCensored = true;
          }
        });

        // Save message to database
        const result = await pool.query(
          `INSERT INTO chat_messages 
           (session_id, sender_id, message_type, content, is_censored)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING message_id, timestamp`,
          [sessionId, playerId, messageType, filteredContent, isCensored]
        );

        // Get sender name for the response
        const userResult = await pool.query(
          `SELECT username FROM users WHERE user_id = $1`,
          [userId]
        );

        const message = {
          message_id: result.rows[0].message_id,
          session_id: sessionId,
          sender_id: playerId,
          sender_name: userResult.rows[0].username,
          message_type: messageType,
          content: filteredContent,
          timestamp: result.rows[0].timestamp,
          is_censored: isCensored,
        };

        // If dead chat, only send to dead players
        if (messageType === "dead") {
          // Get all dead players
          const deadPlayersResult = await pool.query(
            `SELECT gp.player_id
             FROM game_players gp
             WHERE gp.session_id = $1 AND gp.is_alive = false`,
            [sessionId]
          );

          // Emit to each dead player
          deadPlayersResult.rows.forEach((deadPlayer) => {
            socket
              .to(`player:${deadPlayer.player_id}`)
              .emit("new_message", message);
          });

          // Also send back to sender
          socket.emit("new_message", message);
        } else {
          // Broadcast to all players in the room
          chatNamespace.to(`chat:${sessionId}`).emit("new_message", message);
        }
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Send a whisper (private message) to another player
    socket.on("send_whisper", async (data) => {
      try {
        const { content, target_player_id } = data;

        if (!sessionId || !userId || !playerId) {
          throw new Error("Not authenticated for chat");
        }

        // Get current game state
        const gameResult = await pool.query(
          `SELECT * FROM game_sessions WHERE session_id = $1`,
          [sessionId]
        );

        if (gameResult.rows.length === 0) {
          throw new Error("Game session not found");
        }

        const game = gameResult.rows[0];

        // Get player status
        const playerResult = await pool.query(
          `SELECT * FROM game_players WHERE player_id = $1`,
          [playerId]
        );

        if (playerResult.rows.length === 0) {
          throw new Error("Player not found");
        }

        const player = playerResult.rows[0];

        // Check if target player exists and is in the same game
        const targetPlayerResult = await pool.query(
          `SELECT gp.*, u.username 
           FROM game_players gp
           JOIN users u ON gp.user_id = u.user_id
           WHERE gp.player_id = $1 AND gp.session_id = $2`,
          [target_player_id, sessionId]
        );

        if (targetPlayerResult.rows.length === 0) {
          throw new Error("Target player not found");
        }

        const targetPlayer = targetPlayerResult.rows[0];

        // Dead players can't whisper to alive players
        if (!player.is_alive && targetPlayer.is_alive) {
          throw new Error("Dead players cannot whisper to alive players");
        }

        // Can't whisper during night phase
        if (game.current_phase === "night" && game.status === "in_progress") {
          throw new Error("Cannot whisper during night phase");
        }

        // Filter the message
        let filteredContent = content;
        const forbiddenWords = ["badword1", "badword2", "badword3"];
        let isCensored = false;

        forbiddenWords.forEach((word) => {
          if (content.toLowerCase().includes(word)) {
            filteredContent = filteredContent.replace(
              new RegExp(word, "gi"),
              "****"
            );
            isCensored = true;
          }
        });

        // Save message to database
        const result = await pool.query(
          `INSERT INTO chat_messages 
           (session_id, sender_id, message_type, content, recipient_id, is_censored)
           VALUES ($1, $2, 'whisper', $3, $4, $5)
           RETURNING message_id, timestamp`,
          [sessionId, playerId, filteredContent, target_player_id, isCensored]
        );

        // Get sender name
        const userResult = await pool.query(
          `SELECT username FROM users WHERE user_id = $1`,
          [userId]
        );

        const message = {
          message_id: result.rows[0].message_id,
          session_id: sessionId,
          sender_id: playerId,
          sender_name: userResult.rows[0].username,
          recipient_id: target_player_id,
          recipient_name: targetPlayer.username,
          message_type: "whisper",
          content: filteredContent,
          timestamp: result.rows[0].timestamp,
          is_censored: isCensored,
        };

        // Send to recipient
        socket.to(`player:${target_player_id}`).emit("new_whisper", message);

        // Send back to sender
        socket.emit("new_whisper", message);
      } catch (error) {
        console.error("Error sending whisper:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Team chat for werewolves during night
    socket.on("team_chat", async (data) => {
      try {
        const { content } = data;

        if (!sessionId || !userId || !playerId) {
          throw new Error("Not authenticated for chat");
        }

        // Get current game state
        const gameResult = await pool.query(
          `SELECT * FROM game_sessions WHERE session_id = $1`,
          [sessionId]
        );

        if (gameResult.rows.length === 0) {
          throw new Error("Game session not found");
        }

        const game = gameResult.rows[0];

        // Get player with role info
        const playerResult = await pool.query(
          `SELECT gp.*, r.team
           FROM game_players gp
           JOIN roles r ON gp.role_id = r.role_id
           WHERE gp.player_id = $1`,
          [playerId]
        );

        if (playerResult.rows.length === 0) {
          throw new Error("Player not found");
        }

        const player = playerResult.rows[0];

        // Only werewolves can use team chat
        if (player.team !== "werewolf") {
          throw new Error("Only werewolves can use team chat");
        }

        // Team chat is only for night phase
        if (game.current_phase !== "night" && game.status === "in_progress") {
          throw new Error("Team chat is only available during night phase");
        }

        // Filter the message
        let filteredContent = content;
        const forbiddenWords = ["badword1", "badword2", "badword3"];
        let isCensored = false;

        forbiddenWords.forEach((word) => {
          if (content.toLowerCase().includes(word)) {
            filteredContent = filteredContent.replace(
              new RegExp(word, "gi"),
              "****"
            );
            isCensored = true;
          }
        });

        // Save message to database
        const result = await pool.query(
          `INSERT INTO chat_messages 
           (session_id, sender_id, message_type, content, is_censored)
           VALUES ($1, $2, 'team', $3, $4)
           RETURNING message_id, timestamp`,
          [sessionId, playerId, filteredContent, isCensored]
        );

        // Get sender name
        const userResult = await pool.query(
          `SELECT username FROM users WHERE user_id = $1`,
          [userId]
        );

        const message = {
          message_id: result.rows[0].message_id,
          session_id: sessionId,
          sender_id: playerId,
          sender_name: userResult.rows[0].username,
          message_type: "team",
          content: filteredContent,
          timestamp: result.rows[0].timestamp,
          is_censored: isCensored,
        };

        // Get all werewolves
        const werewolvesResult = await pool.query(
          `SELECT gp.player_id
           FROM game_players gp
           JOIN roles r ON gp.role_id = r.role_id
           WHERE gp.session_id = $1 AND r.team = 'werewolf'`,
          [sessionId]
        );

        // Emit to each werewolf
        werewolvesResult.rows.forEach((wolf) => {
          if (wolf.player_id !== playerId) {
            // Don't send to self twice
            socket
              .to(`player:${wolf.player_id}`)
              .emit("new_team_message", message);
          }
        });

        // Send back to sender
        socket.emit("new_team_message", message);
      } catch (error) {
        console.error("Error sending team message:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // React to a message
    socket.on("react_to_message", async (data) => {
      try {
        const { message_id, reaction } = data;

        if (!sessionId || !userId || !playerId) {
          throw new Error("Not authenticated for chat");
        }

        // Validate reaction
        const validReactions = ["like", "dislike", "laugh", "cry", "angry"];
        if (!validReactions.includes(reaction)) {
          throw new Error("Invalid reaction type");
        }

        // Get the message
        const messageResult = await pool.query(
          `SELECT * FROM chat_messages WHERE message_id = $1`,
          [message_id]
        );

        if (messageResult.rows.length === 0) {
          throw new Error("Message not found");
        }

        const message = messageResult.rows[0];

        // Make sure the message is in the current game session
        if (message.session_id !== sessionId) {
          throw new Error("Message is not from the current game session");
        }

        // Update message reactions
        let reactions = message.reactions || {};
        if (!reactions[reaction]) {
          reactions[reaction] = [];
        }

        // Toggle reaction (add if not present, remove if present)
        const playerIndex = reactions[reaction].indexOf(playerId);
        if (playerIndex === -1) {
          reactions[reaction].push(playerId);
        } else {
          reactions[reaction].splice(playerIndex, 1);
        }

        // Update in database
        await pool.query(
          `UPDATE chat_messages
           SET reactions = $1
           WHERE message_id = $2`,
          [JSON.stringify(reactions), message_id]
        );

        // Get user info for the response
        const userResult = await pool.query(
          `SELECT username FROM users WHERE user_id = $1`,
          [userId]
        );

        // Broadcast reaction update to all users
        if (message.message_type === "public") {
          chatNamespace.to(`chat:${sessionId}`).emit("message_reaction", {
            message_id,
            reactions,
            reactor: {
              player_id: playerId,
              username: userResult.rows[0].username,
            },
            reaction,
          });
        } else if (message.message_type === "whisper") {
          // Only send to the sender and recipient of the whisper
          socket.to(`player:${message.sender_id}`).emit("message_reaction", {
            message_id,
            reactions,
            reactor: {
              player_id: playerId,
              username: userResult.rows[0].username,
            },
            reaction,
          });

          socket.to(`player:${message.recipient_id}`).emit("message_reaction", {
            message_id,
            reactions,
            reactor: {
              player_id: playerId,
              username: userResult.rows[0].username,
            },
            reaction,
          });

          // Send back to reactor if they're not the sender or recipient
          if (
            playerId !== message.sender_id &&
            playerId !== message.recipient_id
          ) {
            socket.emit("message_reaction", {
              message_id,
              reactions,
              reactor: {
                player_id: playerId,
                username: userResult.rows[0].username,
              },
              reaction,
            });
          }
        } else if (message.message_type === "team") {
          // Send to all werewolves
          const werewolvesResult = await pool.query(
            `SELECT gp.player_id
             FROM game_players gp
             JOIN roles r ON gp.role_id = r.role_id
             WHERE gp.session_id = $1 AND r.team = 'werewolf'`,
            [sessionId]
          );

          werewolvesResult.rows.forEach((wolf) => {
            socket.to(`player:${wolf.player_id}`).emit("message_reaction", {
              message_id,
              reactions,
              reactor: {
                player_id: playerId,
                username: userResult.rows[0].username,
              },
              reaction,
            });
          });

          // Send back to reactor if they're not a werewolf
          if (!werewolvesResult.rows.some((w) => w.player_id === playerId)) {
            socket.emit("message_reaction", {
              message_id,
              reactions,
              reactor: {
                player_id: playerId,
                username: userResult.rows[0].username,
              },
              reaction,
            });
          }
        }
      } catch (error) {
        console.error("Error reacting to message:", error);
        socket.emit("error", { message: error.message });
      }
    });

    // Handle disconnections
    socket.on("disconnect", () => {
      console.log(`Chat socket disconnected: ${socket.id}`);

      // Clean up
      if (sessionId) {
        socket.leave(`chat:${sessionId}`);
      }

      if (playerId) {
        socket.leave(`player:${playerId}`);
      }
    });
  });

  return chatNamespace;
};

module.exports = {
  setupChatSocketHandlers,
};
