const { pool } = require("../config/db");

const Statistics = {
  // Get basic user statistics
  getUserStats: async (userId) => {
    const query = `
      SELECT 
        COUNT(DISTINCT pg.game_id) as total_games,
        SUM(CASE WHEN pg.result = 'victory' THEN 1 ELSE 0 END) as games_won,
        CASE 
          WHEN COUNT(DISTINCT pg.game_id) > 0 
          THEN ROUND((SUM(CASE WHEN pg.result = 'victory' THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT pg.game_id)), 1)
          ELSE 0
        END as win_rate,
        MAX(streak_data.streak) as best_streak,
        SUM(pg.eliminations) as total_eliminations
      FROM player_games pg
      JOIN games g ON pg.game_id = g.game_id
      LEFT JOIN (
        -- Subquery to calculate winning streaks
        WITH streaks AS (
          SELECT 
            pg.user_id,
            pg.result,
            pg.game_id, 
            ROW_NUMBER() OVER (PARTITION BY pg.user_id ORDER BY g.ended_at) as game_num,
            SUM(CASE WHEN pg.result = 'victory' THEN 0 ELSE 1 END) OVER (PARTITION BY pg.user_id ORDER BY g.ended_at) as streak_group
          FROM player_games pg
          JOIN games g ON pg.game_id = g.game_id
          WHERE pg.user_id = $1
        )
        SELECT 
          user_id,
          MAX(COUNT(*)) OVER () as streak
        FROM streaks
        WHERE result = 'victory'
        GROUP BY user_id, streak_group
      ) streak_data ON true
      WHERE pg.user_id = $1
      GROUP BY pg.user_id
    `;

    const roleStatsQuery = `
      SELECT 
        pg.role,
        COUNT(*) as times_played
      FROM player_games pg
      JOIN games g ON pg.game_id = g.game_id
      WHERE pg.user_id = $1
      GROUP BY pg.role
      ORDER BY times_played DESC
    `;

    const [statsResult, roleResult] = await Promise.all([
      pool.query(query, [userId]),
      pool.query(roleStatsQuery, [userId]),
    ]);

    const stats = statsResult.rows[0] || {
      total_games: 0,
      games_won: 0,
      win_rate: 0,
      best_streak: 0,
      total_eliminations: 0,
    };

    // Convert role stats to object format
    const role_stats = {};
    roleResult.rows.forEach((row) => {
      role_stats[row.role] = parseInt(row.times_played);
    });

    return { ...stats, role_stats };
  },

  // Get detailed user stats with time period filtering
  getDetailedStats: async (userId, period = "all") => {
    let timeFilter = "";
    let params = [userId];

    if (period === "month") {
      timeFilter = "AND g.ended_at >= NOW() - INTERVAL '30 days'";
    } else if (period === "week") {
      timeFilter = "AND g.ended_at >= NOW() - INTERVAL '7 days'";
    }

    const query = `
      SELECT 
        COUNT(DISTINCT pg.game_id) as total_games,
        SUM(CASE WHEN pg.result = 'victory' THEN 1 ELSE 0 END) as games_won,
        CASE 
          WHEN COUNT(DISTINCT pg.game_id) > 0 
          THEN ROUND((SUM(CASE WHEN pg.result = 'victory' THEN 1 ELSE 0 END) * 100.0 / COUNT(DISTINCT pg.game_id)), 1)
          ELSE 0
        END as win_rate,
        MAX(streak_data.streak) as best_streak,
        SUM(pg.eliminations) as total_eliminations,
        AVG(EXTRACT(EPOCH FROM (g.ended_at - g.started_at)) / 60) as average_game_duration
      FROM player_games pg
      JOIN games g ON pg.game_id = g.game_id
      LEFT JOIN (
        -- Subquery to calculate winning streaks within the period
        WITH streaks AS (
          SELECT 
            pg.user_id,
            pg.result,
            pg.game_id, 
            ROW_NUMBER() OVER (PARTITION BY pg.user_id ORDER BY g.ended_at) as game_num,
            SUM(CASE WHEN pg.result = 'victory' THEN 0 ELSE 1 END) OVER (PARTITION BY pg.user_id ORDER BY g.ended_at) as streak_group
          FROM player_games pg
          JOIN games g ON pg.game_id = g.game_id
          WHERE pg.user_id = $1 ${timeFilter}
        )
        SELECT 
          user_id,
          MAX(COUNT(*)) OVER () as streak
        FROM streaks
        WHERE result = 'victory'
        GROUP BY user_id, streak_group
      ) streak_data ON true
      WHERE pg.user_id = $1 ${timeFilter}
      GROUP BY pg.user_id
    `;

    const roleStatsQuery = `
      SELECT 
        pg.role,
        COUNT(*) as times_played
      FROM player_games pg
      JOIN games g ON pg.game_id = g.game_id
      WHERE pg.user_id = $1 ${timeFilter}
      GROUP BY pg.role
      ORDER BY times_played DESC
    `;

    const recentGamesQuery = `
      SELECT 
        g.game_id,
        TO_CHAR(g.ended_at, 'YYYY-MM-DD') as date,
        g.game_mode,
        pg.role,
        pg.result,
        pg.xp_earned
      FROM player_games pg
      JOIN games g ON pg.game_id = g.game_id
      WHERE pg.user_id = $1 ${timeFilter}
      ORDER BY g.ended_at DESC
      LIMIT 5
    `;

    const [statsResult, roleResult, gamesResult] = await Promise.all([
      pool.query(query, params),
      pool.query(roleStatsQuery, params),
      pool.query(recentGamesQuery, params),
    ]);

    // Default values for empty results
    const stats = statsResult.rows[0] || {
      total_games: 0,
      games_won: 0,
      win_rate: 0,
      best_streak: 0,
      total_eliminations: 0,
      average_game_duration: 0,
    };

    // Convert role stats to object format
    const role_stats = {};
    roleResult.rows.forEach((row) => {
      role_stats[row.role] = parseInt(row.times_played);
    });

    return {
      period,
      ...stats,
      role_stats,
      recent_games: gamesResult.rows,
    };
  },
};

module.exports = Statistics;
