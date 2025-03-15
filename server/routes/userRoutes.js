const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/mock-db");
const auth = require("../middleware/auth");

// Test route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "User routes are working" });
});

// @route   POST /api/users/register
// @desc    Register a new user
// @access  Public
router.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide all required fields" });
    }

    // Mock user creation - in a real app, this would save to the database
    const userId = "mock-user-" + Math.floor(Math.random() * 1000);

    // Create JWT token
    const token = jwt.sign(
      { user_id: userId },
      process.env.JWT_SECRET || "dev-secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        user_id: userId,
        username,
        email,
      },
      token,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   POST /api/users/login
// @desc    Authenticate user & get token
// @access  Public
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Basic validation
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide email and password" });
    }

    // Mock user authentication - in a real app, this would verify credentials
    const userId = "mock-user-" + Math.floor(Math.random() * 1000);

    // Create JWT token
    const token = jwt.sign(
      { user_id: userId },
      process.env.JWT_SECRET || "dev-secret-key",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      user: {
        user_id: userId,
        username: email.split("@")[0],
        email,
        experience_points: 125,
        gold_coins: 100,
        gems: 5,
      },
      token,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/users/me
// @desc    Get current user profile
// @access  Private (in a real app, this would be protected)
router.get("/me", (req, res) => {
  // For demo purposes, return mock user data
  res.json({
    user: {
      user_id: "mock-user-id",
      username: "demouser",
      email: "demo@example.com",
      experience_points: 250,
      gold_coins: 150,
      gems: 10,
      account_status: "active",
      verification_status: true,
    },
    profile: {
      profile_id: "mock-profile-id",
      display_name: "Demo Player",
      bio: "I love playing Wolvesville!",
      country_code: "US",
      preferred_roles: ["Werewolf", "Seer"],
      stats: {
        games_played: 42,
        games_won: 28,
        favorite_role: "Werewolf",
      },
    },
  });
});

// @route   GET /api/users/stats
// @desc    Get user stats
// @access  Private (in a real app, this would be protected)
router.get("/stats", (req, res) => {
  // For demo purposes, return mock stats
  res.json({
    stats: {
      total_games: 42,
      games_won: 28,
      win_rate: 66.7,
      role_stats: {
        Villager: 15,
        Werewolf: 18,
        Seer: 9,
      },
      best_streak: 5,
      total_eliminations: 37,
    },
  });
});

module.exports = router;
