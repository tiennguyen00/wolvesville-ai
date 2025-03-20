const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const auth = require("../middleware/auth");
const User = require("../models/User");
const Statistics = require("../models/Statistics");

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

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create new user
    const newUser = await User.create(username, email, hashedPassword);

    // Create JWT token
    const token = jwt.sign(
      { user_id: newUser.user_id },
      process.env.JWT_SECRET || "dev-secret-key",
      { expiresIn: "7d" }
    );

    res.status(201).json({
      message: "User registered successfully",
      user: {
        user_id: newUser.user_id,
        username: newUser.username,
        email: newUser.email,
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

    // Check if user exists
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Create JWT token
    const token = jwt.sign(
      { user_id: user.user_id },
      process.env.JWT_SECRET || "dev-secret-key",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        experience_points: user.experience_points,
        gold_coins: user.gold_coins,
        gems: user.gems,
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
// @access  Private
router.get("/me", auth, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const user = await User.getFullProfile(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/users/stats
// @desc    Get user stats
// @access  Private
router.get("/stats", auth, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const stats = await Statistics.getUserStats(userId);

    res.json({ stats });
  } catch (error) {
    console.error("Error fetching user stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   GET /api/users/stats/detailed
// @desc    Get detailed user stats with period filtering
// @access  Private
router.get("/stats/detailed", auth, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const period = req.query.period || "all";

    // Validate period
    if (!["all", "month", "week"].includes(period)) {
      return res.status(400).json({ message: "Invalid period parameter" });
    }

    const stats = await Statistics.getDetailedStats(userId, period);

    res.json({ stats });
  } catch (error) {
    console.error("Error fetching detailed stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put("/profile", auth, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const updateData = req.body;

    // Update user profile
    const updatedUser = await User.updateProfile(userId, updateData);

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
