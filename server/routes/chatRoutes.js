const express = require("express");
const router = express.Router();
const { pool } = require("../config/mock-db");

// Test route to verify the router is working
router.get("/test", (req, res) => {
  res.json({ message: "Chat routes are working" });
});

// Mock chat messages for demo
const generateMockMessages = (sessionId, count = 10) => {
  const messages = [];
  const messageTypes = [
    "public",
    "public",
    "public",
    "public",
    "whisper",
    "team",
  ];
  const usernames = [
    "alpha_wolf",
    "seer_master",
    "village_elder",
    "hunter",
    "guard",
    "detective",
  ];

  for (let i = 0; i < count; i++) {
    const messageType = messageTypes[Math.floor(Math.random() * 4)]; // Biased toward public messages
    const sender = usernames[Math.floor(Math.random() * usernames.length)];
    const timestamp = new Date(Date.now() - i * 60000).toISOString(); // Each message 1 minute apart

    const message = {
      message_id: `message-${i}-${sessionId}`,
      session_id: sessionId,
      sender_id: `player-${sender}-${sessionId}`,
      sender_name: sender,
      message_type: messageType,
      content: `This is a ${messageType} message from ${sender}`,
      timestamp,
      is_censored: false,
      reactions: {},
    };

    // Add recipient for whisper messages
    if (messageType === "whisper") {
      const recipient = usernames.filter((u) => u !== sender)[0];
      message.recipient_id = `player-${recipient}-${sessionId}`;
      message.recipient_name = recipient;
      message.content = `Whisper to ${recipient}: I think you're the werewolf!`;
    }

    // Add team info for team messages
    if (messageType === "team") {
      message.content = "Team message: Let's target the guard tonight!";
    }

    messages.push(message);
  }

  return messages;
};

// @route   GET /api/chat/:sessionId
// @desc    Get chat messages for a game session
// @access  Private (in a real app, this would be protected)
router.get("/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const { limit } = req.query;

  // Generate mock messages
  const messages = generateMockMessages(
    sessionId,
    limit ? parseInt(limit) : 20
  );

  res.json({
    messages,
  });
});

// @route   GET /api/chat/:sessionId/history
// @desc    Get chat history for a completed game
// @access  Private (in a real app, this would be protected)
router.get("/:sessionId/history", (req, res) => {
  const { sessionId } = req.params;

  // Generate more messages for history
  const messages = generateMockMessages(sessionId, 50);

  res.json({
    messages,
  });
});

module.exports = router;
