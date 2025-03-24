import api from "./api";

// Types
export type AccountStatusType = "active" | "suspended" | "banned" | "inactive";
export type GameStatusType =
  | "lobby"
  | "in_progress"
  | "completed"
  | "abandoned";
export type GamePhaseType = "lobby" | "day" | "night" | "voting" | "results";
export type GameResultType = "victory" | "defeat" | "draw" | "abandoned";
export type ChatTypeEnum =
  | "public"
  | "werewolf"
  | "dead"
  | "private"
  | "system";

export interface GameSession {
  game_id: string; // UUID in database
  game_mode: string;
  host_id: string; // References users(user_id)
  status: GameStatusType;
  max_players: number;
  current_phase: GamePhaseType;
  password_protected: boolean;
  game_password?: string;
  created_at: string;
  started_at?: string;
  ended_at?: string;
  winner_faction?: string;
  players?: GamePlayer[];
  settings?: GameSettings;
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
  id: string;
  user_id: string;
  game_id: string;
  role_id?: string; // References roles(role_id)
  is_alive: boolean;
  result?: GameResultType;
  eliminations: number;
  xp_earned: number;
  coins_earned: number;
  played_at: string;
  username?: string; // Joined from users table
  avatar?: string; // Joined from users table
}

export interface GameEvent {
  event_id: string;
  game_id: string;
  event_type: string;
  event_data: Record<string, any>;
  created_at: string;
}

export interface GameVote {
  vote_id: string;
  game_id: string;
  voter_id: string;
  target_id?: string;
  vote_type: string;
  phase_number: number;
  created_at: string;
}

export interface Role {
  role_id: string;
  role_name: string;
  faction: string;
  description: string;
  ability_description?: string;
  icon?: string;
  created_at: string;
}

export interface Item {
  item_id: string;
  name: string;
  description: string;
  price_coins?: number;
  price_gems?: number;
  item_type: string;
  rarity: string;
  icon?: string;
  created_at: string;
}

export interface Achievement {
  achievement_id: string;
  name: string;
  description: string;
  icon?: string;
  points: number;
  difficulty: string;
  created_at: string;
}

export interface PlayerAction {
  action_type: "vote" | "ability" | "chat" | "ready";
  target_id?: string;
  action_data?: Record<string, any>;
}

export interface GameState {
  phase: GamePhaseType;
  day_number: number;
  time_remaining: number;
  current_action: string | null;
  votes: Record<string, string[]>;
  eliminated_players: string[];
  role_actions: Record<string, boolean>;
  events: GameEvent[];
  player: {
    user_id: string;
    username: string;
    role: string;
    team: string;
    is_alive: boolean;
  };
}

export interface ChatMessage {
  message_id: string;
  game_id: string;
  user_id?: string;
  message: string;
  chat_type: ChatTypeEnum;
  sent_at: string;
  username?: string; // Joined from users table
  avatar?: string; // Joined from users table
}

// Game service functions
const gameService = {
  // Get list of available games
  getGames: async (status?: string) => {
    const url = status ? `/api/games?status=${status}` : "/api/games";
    const response = await api.get(url);
    return response.data.games as GameSession[];
  },

  // Alias for getGames to match naming convention in GameList component
  listGames: async (status?: string) => {
    return gameService.getGames(status);
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
  performAction: async (gameId: string, actionData: any) => {
    const response = await api.post(`/api/games/${gameId}/actions`, actionData);
    return response.data;
  },

  // Get current game state
  getGameState: async (gameId: string): Promise<GameState> => {
    const response = await api.get(`/api/games/${gameId}/state`);
    return response.data.state;
  },

  // Transition to next phase (host only)
  transitionPhase: async (
    gameId: string,
    phase: GamePhaseType
  ): Promise<GameSession> => {
    const response = await api.post(`/api/games/${gameId}/phase/transition`, {
      phase,
    });
    return response.data.game;
  },

  // Record a player action
  recordAction: async (
    gameId: string,
    actionType: string,
    targetIds: string[] = [],
    actionData: any = {}
  ): Promise<void> => {
    await api.post(`/api/games/${gameId}/actions`, {
      action_type: actionType,
      target_ids: targetIds,
      action_data: actionData,
    });
  },

  // Vote for a player
  votePlayer: async (gameId: string, targetId: string): Promise<void> => {
    await gameService.recordAction(gameId, "vote", [targetId]);
  },

  // Use role ability
  useAbility: async (
    gameId: string,
    targetId: string,
    abilityType: string
  ): Promise<void> => {
    await gameService.recordAction(gameId, "ability", [targetId], {
      ability_type: abilityType,
    });
  },

  // Skip using ability
  skipAbility: async (gameId: string): Promise<void> => {
    await gameService.recordAction(gameId, "ability", [], { skip: true });
  },

  // Mark player as ready for next phase
  readyForNextPhase: async (gameId: string): Promise<void> => {
    await api.post(`/api/games/${gameId}/ready`);
  },

  // Leave ongoing game
  leaveGame: async (gameId: string) => {
    const response = await api.post(`/api/games/${gameId}/leave`);
    return response.data;
  },

  // Start the game (host only)
  startGame: async (gameId: string) => {
    const response = await api.post(`/api/games/${gameId}/start`);
    return response.data;
  },

  // Kick a player from the game (host only)
  kickPlayer: async (gameId: string, playerId: string) => {
    const response = await api.post(`/api/games/${gameId}/kick`, {
      target_user_id: playerId,
    });
    return response.data;
  },

  // Get role information and abilities
  getRoleInfo: async (roleName: string) => {
    const response = await api.get(`/api/games/roles/${roleName}`);
    return response.data.role;
  },

  // Get game results (only available for completed games)
  getGameResults: async (gameId: string) => {
    const response = await api.get(`/api/games/${gameId}/results`);
    return response.data.results;
  },
};

export default gameService;
