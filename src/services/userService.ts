import api from "./api";

// Types
export interface UserRegisterData {
  username: string;
  email: string;
  password: string;
}

export interface UserLoginData {
  email: string;
  password: string;
}

export interface UserProfile {
  user_id: string;
  username: string;
  email: string;
  experience_points: number;
  gold_coins: number;
  gems: number;
  profile?: {
    display_name: string;
    bio: string;
    country_code: string;
    preferred_roles: string[];
  };
  stats?: {
    games_played: number;
    games_won: number;
    favorite_role: string;
  };
}

export interface UserStats {
  total_games: number;
  games_won: number;
  win_rate: number;
  role_stats: Record<string, number>;
  best_streak: number;
  total_eliminations: number;
}

export type StatPeriod = "all" | "month" | "week";

export interface DetailedUserStats extends UserStats {
  period: StatPeriod;
  average_game_duration: number;
  recent_games: Array<{
    game_id: string;
    date: string;
    game_mode: string;
    role: string;
    result: "victory" | "defeat";
    xp_earned: number;
  }>;
}

export interface GameHistoryItem {
  game_id: string;
  date: string;
  game_mode: string;
  role: string;
  result: "victory" | "defeat";
  xp_earned: number;
}

export interface GameHistoryResponse {
  games: GameHistoryItem[];
}

// User service functions
const userService = {
  // Register a new user
  register: async (userData: UserRegisterData) => {
    const response = await api.post("/api/users/register", userData);
    return response.data;
  },

  // Login user
  login: async (credentials: UserLoginData) => {
    const response = await api.post("/api/users/login", credentials);
    return response.data;
  },

  // Get current user profile
  getCurrentUser: async () => {
    const response = await api.get("/api/users/me");
    return response.data;
  },

  // Get user stats
  getUserStats: async () => {
    const response = await api.get("/api/users/stats");
    return response.data.stats as UserStats;
  },

  // Get detailed user stats by time period
  getUserStatsByPeriod: async (period: StatPeriod = "all") => {
    const response = await api.get(
      `/api/users/stats/detailed?period=${period}`
    );
    return response.data.stats as DetailedUserStats;
  },

  // Update user profile
  updateProfile: async (profileData: Partial<UserProfile>) => {
    const response = await api.put("/api/users/profile", profileData);
    return response.data;
  },

  // Get user game history
  getGameHistory: async (page = 1, limit = 20) => {
    const response = await api.get(
      `/api/users/history?page=${page}&limit=${limit}`
    );
    return response.data as GameHistoryResponse;
  },
};

export default userService;
