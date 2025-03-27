const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const Chat = require("../models/Chat");
const auth = require("../middleware/auth");

// Test route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "Chat routes are working" });
});

// @route   GET /api/games/:id/messages
// @desc    Get all messages for a game
// @access  Private
router.get("/:id/messages", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get game and player info
    const gameQuery = `
      SELECT g.*, pg.team, pg.is_alive
      FROM games g
      JOIN player_games pg ON g.game_id = pg.game_id
      WHERE g.game_id = $1 AND pg.user_id = $2
    `;
    const gameResult = await pool.query(gameQuery, [id, userId]);

    if (gameResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Game not found or you're not a player" });
    }

    const game = gameResult.rows[0];
    const isAlive = game.is_alive;
    const team = game.team;

    // Get messages based on game phase and player status
    const messagesQuery = `
      SELECT 
        m.message_id,
        m.game_id,
        m.sender_id,
        u.username as sender_name,
        pg.team as sender_team,
        m.message_type,
        m.content,
        m.created_at as timestamp,
        m.recipients
      FROM chat_messages m
      JOIN users u ON m.sender_id = u.user_id
      JOIN player_games pg ON m.sender_id = pg.user_id AND m.game_id = pg.game_id
      WHERE m.game_id = $1
      AND (
        m.message_type = 'public'
        OR (m.message_type = 'team' AND pg.team = $2)
        OR (m.message_type = 'dead' AND $3 = false)
        OR (m.message_type = 'private' AND $4 = ANY(m.recipients))
      )
      ORDER BY m.created_at DESC
      LIMIT 100
    `;

    const { rows: messages } = await pool.query(messagesQuery, [
      id,
      team,
      isAlive,
      userId,
    ]);

    res.json({
      messages: messages.map((msg) => ({
        ...msg,
        content: msg.content,
        sender_name: msg.sender_name,
        sender_team: msg.sender_team,
      })),
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/messages
// @desc    Send a message in a game
// @access  Private
router.post("/:id/messages", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message_type, content, recipients } = req.body;
    const userId = req.user.id;

    // Validate message type
    if (!["public", "team", "dead", "private"].includes(message_type)) {
      return res.status(400).json({ message: "Invalid message type" });
    }

    // Get game and player info
    const gameQuery = `
      SELECT g.*, pg.team, pg.is_alive
      FROM games g
      JOIN player_games pg ON g.game_id = pg.game_id
      WHERE g.game_id = $1 AND pg.user_id = $2
    `;
    const gameResult = await pool.query(gameQuery, [id, userId]);

    if (gameResult.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Game not found or you're not a player" });
    }

    const game = gameResult.rows[0];
    const isAlive = game.is_alive;
    const team = game.team;

    // Validate message permissions
    if (message_type === "team" && game.current_phase === "day") {
      return res
        .status(400)
        .json({ message: "Team chat is only available at night" });
    }

    if (message_type === "dead" && isAlive) {
      return res
        .status(400)
        .json({ message: "Only dead players can use spectator chat" });
    }

    // Insert message
    const insertQuery = `
      INSERT INTO chat_messages (
        game_id,
        sender_id,
        message_type,
        content,
        recipients
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING 
        message_id,
        game_id,
        sender_id,
        message_type,
        content,
        created_at as timestamp
    `;

    const {
      rows: [message],
    } = await pool.query(insertQuery, [
      id,
      userId,
      message_type,
      content,
      recipients || null,
    ]);

    // Get sender info
    const userQuery = `
      SELECT username, pg.team as sender_team
      FROM users u
      JOIN player_games pg ON u.user_id = pg.user_id
      WHERE u.user_id = $1 AND pg.game_id = $2
    `;
    const {
      rows: [user],
    } = await pool.query(userQuery, [userId, id]);

    res.status(201).json({
      message: {
        ...message,
        sender_name: user.username,
        sender_team: user.sender_team,
      },
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
