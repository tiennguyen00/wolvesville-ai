const jwt = require("jsonwebtoken");

/**
 * Authentication middleware
 * This is a simplified version for the demo that doesn't actually require a token
 */
module.exports = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.split(" ")[1]; // Bearer TOKEN format

    // For demo, allow requests without a token
    if (!token) {
      // Set mock user for testing
      req.user = { user_id: "mock-user-id" };
      return next();
    }

    // If token is provided, verify it
    try {
      // Verify token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "dev-secret-key"
      );
      req.user = decoded;
    } catch (tokenError) {
      // If token verification fails, still use mock user for demo
      console.log("Token verification failed, using mock user");
      req.user = { user_id: "mock-user-id" };
    }

    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
