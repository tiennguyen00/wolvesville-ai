const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { pool } = require("../config/mock-db");
const auth = require("../middleware/auth");

// Test route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "Game routes are working" });
});

// Mock game data for demo
const mockGames = [
  {
    session_id: "game-123",
    game_mode: "classic",
    status: "lobby",
    max_players: 12,
    current_players: 5,
    host_username: "alpha_wolf",
    created_at: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    password_protected: false,
  },
  {
    session_id: "game-456",
    game_mode: "quick",
    status: "lobby",
    max_players: 8,
    current_players: 7,
    host_username: "seer_master",
    created_at: new Date(Date.now() - 120000).toISOString(), // 2 minutes ago
    password_protected: true,
  },
  {
    session_id: "game-789",
    game_mode: "custom",
    status: "in_progress",
    max_players: 15,
    current_players: 15,
    host_username: "village_elder",
    created_at: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
    started_at: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
    password_protected: false,
  },
];

// @route   GET /api/games
// @desc    Get list of available games
// @access  Public
router.get("/", (req, res) => {
  const { status } = req.query;

  let filteredGames = [...mockGames];

  // Filter by status if provided
  if (status) {
    filteredGames = filteredGames.filter((game) => game.status === status);
  }

  res.json({
    games: filteredGames,
  });
});

// @route   POST /api/games
// @desc    Create a new game
// @access  Private (in a real app, this would be protected)
router.post("/", (req, res) => {
  const { game_mode, max_players, password, settings } = req.body;

  // Basic validation
  if (!game_mode) {
    return res.status(400).json({ message: "Game mode is required" });
  }

  // Create mock game session
  const newGame = {
    session_id: "game-" + Math.floor(Math.random() * 1000),
    game_mode: game_mode || "classic",
    status: "lobby",
    max_players: max_players || 12,
    current_players: 1, // Host
    host_username: "current_user",
    created_at: new Date().toISOString(),
    password_protected: !!password,
    settings: settings || {},
  };

  // In a real app, this would be saved to the database

  res.status(201).json({
    message: "Game created successfully",
    game: newGame,
  });
});

// @route   GET /api/games/:id
// @desc    Get details of a specific game
// @access  Public
router.get("/:id", (req, res) => {
  const { id } = req.params;

  // Find game in mock data
  const game = mockGames.find((g) => g.session_id === id);

  if (!game) {
    return res.status(404).json({ message: "Game not found" });
  }

  // Add players data for the response
  const mockPlayers = [];
  for (let i = 0; i < game.current_players; i++) {
    mockPlayers.push({
      player_id: `player-${i}-${id}`,
      user_id: `user-${i}`,
      username: `player${i}`,
      position: i,
      join_time: new Date(Date.now() - i * 30000).toISOString(),
      is_alive: true,
    });
  }

  res.json({
    ...game,
    players: mockPlayers,
  });
});

// @route   POST /api/games/:id/join
// @desc    Join a game
// @access  Private (in a real app, this would be protected)
router.post("/:id/join", (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  // Find game in mock data
  const game = mockGames.find((g) => g.session_id === id);

  if (!game) {
    return res.status(404).json({ message: "Game not found" });
  }

  // Check if game is in lobby state
  if (game.status !== "lobby") {
    return res
      .status(400)
      .json({ message: "Cannot join a game that has already started" });
  }

  // Check if password is required
  if (game.password_protected && !password) {
    return res
      .status(400)
      .json({ message: "Password is required to join this game" });
  }

  // Check if game is full
  if (game.current_players >= game.max_players) {
    return res.status(400).json({ message: "Game is full" });
  }

  res.status(201).json({
    message: "Successfully joined the game",
    player_id: `player-${game.current_players}-${id}`,
    game_id: id,
  });
});

// @route   GET /api/games/roles/list
// @desc    Get available roles
// @access  Public
router.get("/roles/list", (req, res) => {
  // Mock roles data
  const roles = [
    {
      role_id: "role-1",
      name: "Villager",
      description:
        "A regular villager with no special abilities. Win by eliminating all werewolves.",
      team: "villager",
      category: "vanilla",
      ability_type: null,
      ability_target: null,
      enabled: true,
    },
    {
      role_id: "role-2",
      name: "Werewolf",
      description:
        "A werewolf who can eliminate one villager each night. Win by outnumbering the villagers.",
      team: "werewolf",
      category: "killer",
      ability_type: "kill",
      ability_target: "single",
      enabled: true,
    },
    {
      role_id: "role-3",
      name: "Seer",
      description:
        "A villager who can check one player each night to learn if they are a werewolf or not.",
      team: "villager",
      category: "investigative",
      ability_type: "investigate",
      ability_target: "single",
      enabled: true,
    },
  ];

  res.json({
    roles,
  });
});

// @route   GET /api/games/:id/events
// @desc    Get game events
// @access  Private (in a real app, this would be protected)
router.get("/:id/events", (req, res) => {
  const { id } = req.params;

  // Mock events data
  const events = [
    {
      event_id: `event-1-${id}`,
      event_type: "game_started",
      event_data: { player_count: 12 },
      phase: "night",
      day_number: 1,
      timestamp: new Date(Date.now() - 600000).toISOString(),
      is_public: true,
    },
    {
      event_id: `event-2-${id}`,
      event_type: "player_killed",
      event_data: { cause: "werewolf_kill" },
      target_ids: ["player-3-" + id],
      phase: "night",
      day_number: 1,
      timestamp: new Date(Date.now() - 590000).toISOString(),
      is_public: true,
    },
    {
      event_id: `event-3-${id}`,
      event_type: "phase_changed",
      event_data: { new_phase: "day" },
      phase: "day",
      day_number: 1,
      timestamp: new Date(Date.now() - 580000).toISOString(),
      is_public: true,
    },
  ];

  res.json({
    events,
  });
});

module.exports = router;
