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
    const {
      game_mode,
      max_players,
      game_password,
      password_protected,
      settings,
      current_phase,
    } = req.body;

    const userId = req.user.id;

    // Basic validation
    if (!game_mode) {
      return res.status(400).json({ message: "Game mode is required" });
    }

    const game = await Game.createGame(
      userId,
      game_mode,
      max_players,
      game_password,
      password_protected,
      settings,
      current_phase || "lobby"
    );

    // Get the io instance
    const { io } = require("../index");

    // Emit socket event for game creation
    io.of("/game").emit("create_game", {
      game_id: game.game_id,
      host_id: userId,
      settings: {
        game_mode,
        max_players,
        password_protected,
        current_phase: current_phase || "lobby",
        ...settings,
      },
    });

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
    const { game_password } = req.body;
    const userId = req.user.id;

    const result = await Game.joinGame(id, userId, game_password);

    // Get the socket server instance
    const io = req.app.get("io");
    if (io) {
      // Broadcast to game room that a new player joined
      io.of("/game")
        .to(`game:${id}`)
        .emit("player_joined", {
          userId,
          player: {
            user_id: userId,
            username: req.user.username,
            is_alive: true,
          },
        });

      // Send updated player list to all clients
      const gameDetails = await Game.getGameDetails(id);
      io.of("/game").to(`game:${id}`).emit("players_updated", {
        players: gameDetails.players,
      });
    }

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
    const { event_type, event_data } = req.body;

    // Basic validation
    if (!event_type) {
      return res.status(400).json({
        message: "Event type is required",
      });
    }

    const result = await Game.recordGameEvent(id, event_type, event_data || {});

    res.status(201).json({
      message: "Event recorded successfully",
      event_id: result.event_id,
      created_at: result.created_at,
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
    console.log("reqbody: ", req.body);
    console.log("requser: ", req.user);

    const result = await Game.startGame(id, userId);

    res.json({
      message: "Game started successfully",
      status: result.status,
      started_at: result.started_at,
      current_phase: result.current_phase,
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
    const { user_id, action_type, target_ids, action_data } = req.body;

    // Basic validation
    if (!user_id || !action_type) {
      return res.status(400).json({
        message: "User ID and action type are required",
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
      user_id,
      action_type,
      target_ids || [],
      action_data || {}
    );

    res.status(201).json({
      message: result.message,
      event_id: result.event_id,
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

    // Get votes from the game_votes table
    const votes = await Game.getVoteTally(id);

    res.json({
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
    const { chat_type, since } = req.query;

    const messages = await Chat.getMessages(id, chat_type, since);

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
    const { user_id, message, chat_type } = req.body;

    // Basic validation
    if (!user_id || !message) {
      return res.status(400).json({
        message: "User ID and message content are required",
      });
    }

    const result = await Chat.sendMessage(
      id,
      user_id,
      message,
      chat_type || "public"
    );

    res.status(201).json({
      message: "Message sent successfully",
      message_id: result.message_id,
      sent_at: result.sent_at,
    });
  } catch (error) {
    console.error("Error sending chat message:", error);

    // Handle specific errors
    if (error.message === "User not found in this game") {
      return res.status(404).json({ message: error.message });
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

// @route   POST /api/games/:id/kick
// @desc    Kick a player from the game (host only)
// @access  Private
router.post("/:id/kick", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { target_user_id } = req.body;
    const hostUserId = req.user.id;

    // Basic validation
    if (!target_user_id) {
      return res.status(400).json({
        message: "Target user ID is required",
      });
    }

    const result = await Game.kickPlayer(id, hostUserId, target_user_id);

    res.json({
      message: "Player kicked successfully",
      player_id: result.player_id,
    });
  } catch (error) {
    console.error("Error kicking player:", error);

    // Handle specific errors
    if (
      error.message === "Game not found" ||
      error.message === "Target player not found in this game"
    ) {
      return res.status(404).json({ message: error.message });
    } else if (
      error.message === "Only the host can kick players" ||
      error.message === "Players can only be kicked while in the lobby"
    ) {
      return res.status(403).json({ message: error.message });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/leave
// @desc    Leave a game
// @access  Private
router.post("/:id/leave", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Call the Game model to leave the game
    // We'll use the kickPlayer method but with the player kicking themselves
    await Game.leaveGame(id, userId);

    res.json({
      message: "Successfully left the game",
      game_id: id,
    });
  } catch (error) {
    console.error("Error leaving game:", error);

    // Handle specific errors
    if (
      error.message === "Game not found" ||
      error.message === "Player not found in this game"
    ) {
      return res.status(404).json({ message: error.message });
    } else if (error.message === "Cannot leave a game that is in progress") {
      return res.status(400).json({ message: error.message });
    } else if (error.message === "Host cannot leave the game") {
      return res.status(403).json({
        message:
          "As the host, you cannot leave the game. Transfer host or end the game instead.",
      });
    }

    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/phase/transition
// @desc    Transition to next game phase
// @access  Private
router.post("/:id/phase/transition", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { phase } = req.body;

    // Verify user is host
    const game = await Game.getGameDetails(id);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    if (game.host_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Only the host can transition phases" });
    }

    // Process current phase actions
    if (game.current_phase === "night") {
      await Game.processNightActions(id);
    } else if (game.current_phase === "day") {
      await Game.processDayActions(id);
    }

    // Update game state
    const updates = {
      current_phase: phase,
      time_remaining: phase === "night" ? 120 : 180, // 2 minutes for night, 3 for day
    };

    const updatedGame = await Game.updateGameState(id, updates);

    // Check win conditions
    const winner = await Game.checkWinConditions(id);
    if (winner) {
      return res.json({
        message: "Game ended",
        winner_faction: winner,
        game: updatedGame,
      });
    }

    res.json({
      message: "Phase transition successful",
      game: updatedGame,
    });
  } catch (error) {
    console.error("Error transitioning phase:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/games/:id/state
// @desc    Get current game state
// @access  Private
router.get("/:id/state", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get game details
    const game = await Game.getGameDetails(id);
    if (!game) {
      return res.status(404).json({ message: "Game not found" });
    }

    // Get current votes
    const votes = await Game.getCurrentVotes(id);

    // Get role actions
    const role_actions = await Game.getRoleActions(id);

    // Get recent events
    const events = await Game.getGameEvents(id);

    // Find current player
    const player = game.players.find((p) => p.user_id === userId);

    const gameState = {
      phase: game.current_phase,
      time_remaining: game.time_remaining || 0,
      current_action: null,
      votes,
      eliminated_players: game.players
        .filter((p) => !p.is_alive)
        .map((p) => p.user_id),
      role_actions,
      events,
      player: player
        ? {
            user_id: player.user_id,
            username: player.username,
            role: player.role_name,
            team: player.faction,
            is_alive: player.is_alive,
          }
        : null,
    };

    res.json(gameState);
  } catch (error) {
    console.error("Error getting game state:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/games/roles/:id
// @desc    Get role information
// @access  Private
router.get("/roles/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const roleQuery = `
      SELECT 
        role_id,
        role_name,
        faction,
        description,
        ability_description,
        icon,
        created_at
      FROM roles
      WHERE role_id = $1
    `;

    const { rows } = await pool.query(roleQuery, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error("Error getting role info:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/vote
// @desc    Vote for a player
// @access  Private
router.post("/:id/vote", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { target_id } = req.body;
    const userId = req.user.id;

    if (!target_id) {
      return res.status(400).json({ message: "Target ID is required" });
    }

    await Game.recordPlayerAction(id, userId, "vote", [target_id]);

    res.json({ message: "Vote recorded successfully" });
  } catch (error) {
    console.error("Error recording vote:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/ability
// @desc    Use role ability
// @access  Private
router.post("/:id/ability", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { target_id, role_id } = req.body;
    const userId = req.user.id;

    if (!target_id || !role_id) {
      return res
        .status(400)
        .json({ message: "Target ID and role ID are required" });
    }

    await Game.recordPlayerAction(id, userId, "ability", [target_id], {
      role_id,
    });

    res.json({ message: "Ability used successfully" });
  } catch (error) {
    console.error("Error using ability:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/ability/skip
// @desc    Skip using ability
// @access  Private
router.post("/:id/ability/skip", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await Game.recordPlayerAction(id, userId, "ability", [], { skip: true });

    res.json({ message: "Ability skipped successfully" });
  } catch (error) {
    console.error("Error skipping ability:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/games/:id/ready
// @desc    Mark player as ready for next phase
// @access  Private
router.post("/:id/ready", auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    await Game.recordPlayerAction(id, userId, "ready", []);

    res.json({ message: "Marked as ready successfully" });
  } catch (error) {
    console.error("Error marking as ready:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
