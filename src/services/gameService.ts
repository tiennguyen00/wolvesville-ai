import api from "./api";

// Types
export interface GameSession {
  session_id: string;
  game_mode: string;
  status: "lobby" | "in_progress" | "completed";
  max_players: number;
  current_players: number;
  host_username: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  password_protected: boolean;
  settings?: GameSettings;
  players?: GamePlayer[];
}

export interface GameSettings {
  roles?: string[];
  day_duration?: number;
  night_duration?: number;
  discussion_duration?: number;
  voting_duration?: number;
  custom_rules?: Record<string, any>;
}

export interface GamePlayer {
  player_id: string;
  user_id: string;
  username: string;
  position: number;
  join_time: string;
  is_alive: boolean;
  role?: string;
  team?: string;
}

export interface GameEvent {
  event_id: string;
  event_type: string;
  event_data: Record<string, any>;
  target_ids?: string[];
  phase: "day" | "night";
  day_number: number;
  timestamp: string;
  is_public: boolean;
}

export interface Role {
  role_id: string;
  name: string;
  description: string;
  team: string;
  category: string;
  ability_type: string | null;
  ability_target: string | null;
  enabled: boolean;
}

// Game service functions
const gameService = {
  // Get list of available games
  getGames: async (status?: string) => {
    const url = status ? `/api/games?status=${status}` : "/api/games";
    const response = await api.get(url);
    return response.data.games as GameSession[];
  },

  // Get a specific game by ID
  getGameById: async (gameId: string) => {
    const response = await api.get(`/api/games/${gameId}`);
    return response.data as GameSession;
  },

  // Create a new game
  createGame: async (gameData: Partial<GameSession>) => {
    const response = await api.post("/api/games", gameData);
    return response.data.game as GameSession;
  },

  // Join a game
  joinGame: async (gameId: string, password?: string) => {
    const response = await api.post(`/api/games/${gameId}/join`, { password });
    return response.data;
  },

  // Get list of available roles
  getRoles: async () => {
    const response = await api.get("/api/games/roles/list");
    return response.data.roles as Role[];
  },

  // Get game events
  getGameEvents: async (gameId: string) => {
    const response = await api.get(`/api/games/${gameId}/events`);
    return response.data.events as GameEvent[];
  },

  // Perform game action (vote, use ability, etc.)
  performAction: async (
    gameId: string,
    actionType: string,
    actionData: any
  ) => {
    const response = await api.post(`/api/games/${gameId}/action`, {
      action_type: actionType,
      action_data: actionData,
    });
    return response.data;
  },
};

export default gameService;
