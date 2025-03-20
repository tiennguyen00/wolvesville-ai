const express = require("express");
const router = express.Router();
const { pool } = require("../config/db");
const Chat = require("../models/Chat");
const auth = require("../middleware/auth");

// Test route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "Chat routes are working" });
});

// @route   GET /api/chat/:sessionId
// @desc    Get chat messages for a game session
// @access  Private
router.get("/:sessionId", auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message_type, since, limit } = req.query;

    // Use the Chat model to get messages
    const messages = await Chat.getMessages(sessionId, message_type, since);

    // Apply limit if provided
    const limitedMessages = limit
      ? messages.slice(0, parseInt(limit))
      : messages;

    res.json({
      messages: limitedMessages,
    });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/chat/:sessionId/history
// @desc    Get chat history for a completed game
// @access  Private
router.get("/:sessionId/history", auth, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Get game status first to ensure it's completed
    const gameQuery = `
      SELECT status FROM game_sessions
      WHERE session_id = $1
    `;
    const gameResult = await pool.query(gameQuery, [sessionId]);

    if (gameResult.rows.length === 0) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (gameResult.rows[0].status !== "completed") {
      return res.status(400).json({
        message: "Chat history is only available for completed games",
      });
    }

    // Get all messages for the completed game
    const messages = await Chat.getMessages(sessionId);

    res.json({
      messages,
    });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
