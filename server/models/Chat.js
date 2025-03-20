const { pool } = require("../config/db");

class Chat {
  // Get chat messages for a game session
  static async getMessages(sessionId, messageType = null, since = null) {
    try {
      let query = `
        SELECT 
          cm.message_id,
          cm.sender_id,
          gp.user_id,
          u.username,
          cm.message_type,
          cm.content,
          cm.recipient_id,
          cm.timestamp,
          cm.is_censored,
          cm.reactions
        FROM 
          chat_messages cm
        LEFT JOIN 
          game_players gp ON cm.sender_id = gp.player_id
        LEFT JOIN 
          users u ON gp.user_id = u.user_id
        WHERE 
          cm.session_id = $1
      `;

      const params = [sessionId];
      let paramIndex = 2;

      if (messageType) {
        query += ` AND cm.message_type = $${paramIndex}`;
        params.push(messageType);
        paramIndex++;
      }

      if (since) {
        query += ` AND cm.timestamp > $${paramIndex}`;
        params.push(since);
      }

      query += ` ORDER BY cm.timestamp ASC`;

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      throw error;
    }
  }

  // Send a message in the chat
  static async sendMessage(
    sessionId,
    senderId,
    content,
    messageType = "public",
    recipientId = null
  ) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Verify sender exists in the game
      const senderQuery = `
        SELECT gp.player_id, gp.is_alive, gp.team
        FROM game_players gp
        WHERE gp.player_id = $1 AND gp.session_id = $2
      `;
      const senderResult = await client.query(senderQuery, [
        senderId,
        sessionId,
      ]);

      if (senderResult.rows.length === 0) {
        throw new Error("Sender not found in this game");
      }

      const sender = senderResult.rows[0];

      // Validate message type and recipient if necessary
      if (messageType === "private" && !recipientId) {
        throw new Error("Private messages require a recipient");
      }

      if (messageType === "team") {
        // For team messages, recipient is not needed but validate team chat availability
        if (!sender.team) {
          throw new Error("Player doesn't have a team assigned yet");
        }
      }

      if (recipientId) {
        // Verify recipient exists in the game
        const recipientQuery = `
          SELECT player_id, is_alive
          FROM game_players
          WHERE player_id = $1 AND session_id = $2
        `;
        const recipientResult = await client.query(recipientQuery, [
          recipientId,
          sessionId,
        ]);

        if (recipientResult.rows.length === 0) {
          throw new Error("Recipient not found in this game");
        }
      }

      // Insert the message
      const messageQuery = `
        INSERT INTO chat_messages (
          session_id,
          sender_id,
          message_type,
          content,
          recipient_id
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING message_id, timestamp
      `;

      const messageValues = [
        sessionId,
        senderId,
        messageType,
        content,
        recipientId,
      ];

      const messageResult = await client.query(messageQuery, messageValues);

      await client.query("COMMIT");
      return messageResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error sending message:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Add a reaction to a message
  static async addReaction(messageId, playerId, reactionType) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get the message
      const messageQuery = `
        SELECT message_id, session_id, reactions
        FROM chat_messages
        WHERE message_id = $1
      `;
      const messageResult = await client.query(messageQuery, [messageId]);

      if (messageResult.rows.length === 0) {
        throw new Error("Message not found");
      }

      const message = messageResult.rows[0];

      // Check if player is in the game
      const playerQuery = `
        SELECT player_id
        FROM game_players
        WHERE player_id = $1 AND session_id = $2
      `;
      const playerResult = await client.query(playerQuery, [
        playerId,
        message.session_id,
      ]);

      if (playerResult.rows.length === 0) {
        throw new Error("Player not in this game");
      }

      // Update the reactions JSONB field
      const reactions = message.reactions || {};

      // If player already reacted, update their reaction
      if (!reactions[playerId]) {
        reactions[playerId] = reactionType;
      } else {
        reactions[playerId] = reactionType;
      }

      // Update the message
      const updateQuery = `
        UPDATE chat_messages
        SET reactions = $1
        WHERE message_id = $2
        RETURNING message_id, reactions
      `;
      const updateResult = await client.query(updateQuery, [
        JSON.stringify(reactions),
        messageId,
      ]);

      await client.query("COMMIT");
      return updateResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error adding reaction:", error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Remove a reaction from a message
  static async removeReaction(messageId, playerId) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Get the message
      const messageQuery = `
        SELECT message_id, reactions
        FROM chat_messages
        WHERE message_id = $1
      `;
      const messageResult = await client.query(messageQuery, [messageId]);

      if (messageResult.rows.length === 0) {
        throw new Error("Message not found");
      }

      const message = messageResult.rows[0];

      // Update the reactions JSONB field
      const reactions = message.reactions || {};

      // Remove player's reaction if it exists
      if (reactions[playerId]) {
        delete reactions[playerId];
      }

      // Update the message
      const updateQuery = `
        UPDATE chat_messages
        SET reactions = $1
        WHERE message_id = $2
        RETURNING message_id, reactions
      `;
      const updateResult = await client.query(updateQuery, [
        JSON.stringify(reactions),
        messageId,
      ]);

      await client.query("COMMIT");
      return updateResult.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Error removing reaction:", error);
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = Chat;
