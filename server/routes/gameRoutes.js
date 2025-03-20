const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { pool } = require("../config/db");
const auth = require("../middleware/auth");
const Game = require("../models/Game");
const Chat = require("../models/Chat");

// Test route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "Game routes are working" });
});

// @route   GET /api/games
// @desc    Get list of available games
// @access  Public
router.get("/", async (req, res) => {
  try {
    const { status } = req.query;
    const games = await Game.getGames(status);

    res.json({
      games,
    });
  } catch (error) {
    console.error("Error fetching games:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games
// @desc    Create a new game
// @access  Private
router.post("/", auth, async (req, res) => {
  try {
    const { game_mode, max_players, password, settings } = req.body;
    const userId = req.user.id;

    // Basic validation
    if (!game_mode) {
      return res.status(400).json({ message: "Game mode is required" });
    }

    const game = await Game.createGame(
      userId,
      game_mode,
      max_players,
      password,
      settings
    );

    res.status(201).json({
      message: "Game created successfully",
      game,
    });
  } catch (error) {
    console.error("Error creating game:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/games/:id
// @desc    Get details of a specific game
// @access  Public
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const game = await Game.getGameDetails(id);

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    res.json(game);
  } catch (error) {
    console.error("Error fetching game details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/join
// @desc    Join a game
// @access  Private
router.post("/:id/join", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const userId = req.user.id;

    const result = await Game.joinGame(id, userId, password);

    res.status(201).json({
      message: "Successfully joined the game",
      player_id: result.player_id,
      game_id: result.game_id,
    });
  } catch (error) {
    console.error("Error joining game:", error);

    // Handle specific errors with appropriate status codes
    if (error.message === "Game not found") {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === "Cannot join a game that has already started" ||
      error.message === "Password is required to join this game" ||
      error.message === "Invalid password" ||
      error.message === "Game is full"
    ) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/games/roles/list
// @desc    Get available roles
// @access  Public
router.get("/roles/list", async (req, res) => {
  try {
    const roles = await Game.getRoles();

    res.json({
      roles,
    });
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/games/:id/events
// @desc    Get game events
// @access  Private
router.get("/:id/events", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { since } = req.query;

    const events = await Game.getGameEvents(id, since);

    res.json({
      events,
    });
  } catch (error) {
    console.error("Error fetching game events:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/events
// @desc    Record a game event (for testing)
// @access  Private
router.post("/:id/events", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      event_type,
      event_data,
      initiator_id,
      target_ids,
      phase,
      day_number,
      is_public,
    } = req.body;

    // Basic validation
    if (!event_type || !phase || !day_number) {
      return res.status(400).json({
        message: "Event type, phase, and day number are required",
      });
    }

    const result = await Game.recordGameEvent(
      id,
      event_type,
      event_data || {},
      initiator_id,
      target_ids || [],
      phase,
      day_number,
      is_public
    );

    res.status(201).json({
      message: "Event recorded successfully",
      event_id: result.event_id,
      timestamp: result.timestamp,
    });
  } catch (error) {
    console.error("Error recording game event:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/start
// @desc    Start a game
// @access  Private
router.post("/:id/start", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await Game.startGame(id, userId);

    res.json({
      message: "Game started successfully",
      status: result.status,
      started_at: result.started_at,
      current_phase: result.current_phase,
      current_day: result.current_day,
    });
  } catch (error) {
    console.error("Error starting game:", error);

    // Handle specific errors
    if (error.message === "Game not found") {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === "Only the host can start the game" ||
      error.message === "Need at least 3 players to start a game"
    ) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/actions
// @desc    Perform a player action
// @access  Private
router.post("/:id/actions", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { player_id, action_type, target_ids, action_data } = req.body;

    // Basic validation
    if (!player_id || !action_type) {
      return res.status(400).json({
        message: "Player ID and action type are required",
      });
    }

    // For actions that require targets
    if (
      (action_type === "kill" ||
        action_type === "vote" ||
        action_type === "investigate") &&
      (!target_ids || target_ids.length === 0)
    ) {
      return res
        .status(400)
        .json({ message: "Target is required for this action" });
    }

    const result = await Game.recordPlayerAction(
      id,
      player_id,
      action_type,
      target_ids || [],
      action_data || {}
    );

    res.status(201).json({
      message: result.message,
      event_id: result.eventId,
    });
  } catch (error) {
    console.error("Error performing player action:", error);

    // Handle specific errors
    if (error.message === "Game or player not found") {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === "Dead players cannot perform actions" ||
      error.message === "This role cannot perform kill actions" ||
      error.message === "This role cannot perform investigate actions" ||
      error.message === "Kill actions can only be performed at night" ||
      error.message === "Voting can only be performed during the day"
    ) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/games/:id/votes
// @desc    Get current vote tally
// @access  Private
router.get("/:id/votes", auth, async (req, res) => {
  try {
    const { id } = req.params;

    // Get the current day from the game
    const game = await Game.getGameDetails(id);

    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    const votes = await Game.getVoteTally(id, game.current_day);

    res.json({
      day: game.current_day,
      votes,
    });
  } catch (error) {
    console.error("Error fetching vote tally:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/games/:id/chat
// @desc    Get chat messages
// @access  Private
router.get("/:id/chat", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message_type, since } = req.query;

    const messages = await Chat.getMessages(id, message_type, since);

    res.json({
      messages,
    });
  } catch (error) {
    console.error("Error fetching chat messages:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/chat
// @desc    Send a chat message
// @access  Private
router.post("/:id/chat", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { player_id, content, message_type, recipient_id } = req.body;

    // Basic validation
    if (!player_id || !content) {
      return res.status(400).json({
        message: "Player ID and content are required",
      });
    }

    const result = await Chat.sendMessage(
      id,
      player_id,
      content,
      message_type || "public",
      recipient_id
    );

    res.status(201).json({
      message: "Message sent successfully",
      message_id: result.message_id,
      timestamp: result.timestamp,
    });
  } catch (error) {
    console.error("Error sending chat message:", error);

    // Handle specific errors
    if (
      error.message === "Sender not found in this game" ||
      error.message === "Recipient not found in this game"
    ) {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === "Private messages require a recipient" ||
      error.message === "Player doesn't have a team assigned yet"
    ) {
      return res.status(400).json({ message: error.message });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/chat/:message_id/reactions
// @desc    Add a reaction to a chat message
// @access  Private
router.post("/:id/chat/:message_id/reactions", auth, async (req, res) => {
  try {
    const { message_id } = req.params;
    const { player_id, reaction_type } = req.body;

    // Basic validation
    if (!player_id || !reaction_type) {
      return res.status(400).json({
        message: "Player ID and reaction type are required",
      });
    }

    const result = await Chat.addReaction(message_id, player_id, reaction_type);

    res.json({
      message: "Reaction added successfully",
      message_id: result.message_id,
      reactions: result.reactions,
    });
  } catch (error) {
    console.error("Error adding reaction:", error);

    // Handle specific errors
    if (
      error.message === "Message not found" ||
      error.message === "Player not in this game"
    ) {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   DELETE /api/games/:id/chat/:message_id/reactions
// @desc    Remove a reaction from a chat message
// @access  Private
router.delete("/:id/chat/:message_id/reactions", auth, async (req, res) => {
  try {
    const { message_id } = req.params;
    const { player_id } = req.body;

    // Basic validation
    if (!player_id) {
      return res.status(400).json({
        message: "Player ID is required",
      });
    }

    const result = await Chat.removeReaction(message_id, player_id);

    res.json({
      message: "Reaction removed successfully",
      message_id: result.message_id,
      reactions: result.reactions,
    });
  } catch (error) {
    console.error("Error removing reaction:", error);

    // Handle specific errors
    if (error.message === "Message not found") {
      return res.status(404).json({ message: error.message });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
