const { pool } = require("../config/db");

const User = {
  // Create a new user
  create: async (username, email, hashedPassword) => {
    const query = `
      INSERT INTO users (username, email, password_hash) 
      VALUES ($1, $2, $3) 
      RETURNING user_id, username, email, created_at
    `;
    const result = await pool.query(query, [username, email, hashedPassword]);
    return result.rows[0];
  },

  // Find user by email
  findByEmail: async (email) => {
    const query = "SELECT * FROM users WHERE email = $1";
    const result = await pool.query(query, [email]);
    return result.rows[0];
  },

  // Find user by ID
  findById: async (userId) => {
    const query = "SELECT * FROM users WHERE user_id = $1";
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  },

  // Update user profile
  updateProfile: async (userId, profileData) => {
    const { username, email, bio, avatar } = profileData;
    const query = `
      UPDATE users 
      SET username = COALESCE($2, username),
          email = COALESCE($3, email),
          bio = COALESCE($4, bio),
          avatar = COALESCE($5, avatar),
          updated_at = NOW()
      WHERE user_id = $1
      RETURNING user_id, username, email, bio, avatar, experience_points, gold_coins, gems
    `;
    const result = await pool.query(query, [
      userId,
      username,
      email,
      bio,
      avatar,
    ]);
    return result.rows[0];
  },

  // Get full user data with stats
  getFullProfile: async (userId) => {
    const query = `
      SELECT 
        u.user_id, u.username, u.email, u.bio, u.avatar, 
        u.experience_points, u.gold_coins, u.gems,
        u.created_at, u.updated_at,
        COUNT(DISTINCT g.game_id) as games_played,
        SUM(CASE WHEN pg.result = 'victory' THEN 1 ELSE 0 END) as games_won
      FROM users u
      LEFT JOIN player_games pg ON u.user_id = pg.user_id
      LEFT JOIN games g ON pg.game_id = g.game_id
      WHERE u.user_id = $1
      GROUP BY u.user_id
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  },
};

module.exports = User;
