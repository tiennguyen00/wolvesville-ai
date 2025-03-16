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

  // Update user profile
  updateProfile: async (profileData: Partial<UserProfile>) => {
    const response = await api.put("/api/users/profile", profileData);
    return response.data;
  },
};

export default userService;
