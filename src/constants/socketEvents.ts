/**
 * Socket event name constants for use throughout the client
 * This ensures consistency between client components
 */

const SOCKET_EVENTS = {
  // Connection events
  CONNECT: "connect",
  DISCONNECT: "disconnect",
  CONNECT_ERROR: "connect_error",
  ERROR: "error",
  AUTHENTICATED: "authenticated",

  // Room management
  JOIN_GAME_ROOM: "join_game_room",
  LEAVE_GAME_ROOM: "leave_game_room",
  USER_JOINED_ROOM: "user_joined_room",
  USER_LEFT_ROOM: "user_left_room",
  ROOM_JOINED: "room_joined",

  // Game management
  CREATE_GAME: "create_game",
  GAME_CREATED: "game_created",
  JOIN_GAME: "join_game",
  JOIN_GAME_SUCCESS: "join_game_success",
  LEAVE_GAME: "leave_game",
  LEAVE_GAME_SUCCESS: "leave_game_success",
  START_GAME: "start_game",
  GAME_STARTED: "game_started",

  // Player events
  PLAYER_JOINED: "player_joined",
  PLAYER_LEFT: "player_left",
  PLAYER_READY: "player_ready",
  PLAYER_READY_UPDATE: "player_ready_update",
  PLAYER_DISCONNECTED: "player_disconnected",
  PLAYERS_UPDATED: "players_updated",

  // Game phases
  PHASE_CHANGED: "phase_changed",

  // Game actions
  GAME_ACTION: "game_action",
  VOTE_CAST: "vote_cast",
  ABILITY_USED: "ability_used",

  // Game completion
  GAME_ENDED: "game_ended",
};

export default SOCKET_EVENTS;
