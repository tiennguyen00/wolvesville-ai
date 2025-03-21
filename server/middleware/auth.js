const jwt = require("jsonwebtoken");

/**
 * Authentication middleware
 * Verifies JWT token and sets req.user if valid
 */
module.exports = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header("Authorization")?.split(" ")[1]; // Bearer TOKEN format

    // Check if token exists
    if (!token) {
      return res
        .status(401)
        .json({ message: "No token, authorization denied" });
    }

    // Verify token
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "dev-secret-key"
      );

      // Ensure both id and user_id are available for backward compatibility
      req.user = {
        ...decoded,
        id: decoded.user_id || decoded.id, // Use user_id field from token, fallback to id
      };

      console.log("Auth middleware - User ID:", req.user.id);

      next();
    } catch (err) {
      return res.status(401).json({ message: "Token is invalid" });
    }
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
};
