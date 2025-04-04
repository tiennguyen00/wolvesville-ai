/**
 * Socket event name constants for use throughout the server
 * This ensures consistency between server components
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
  KICK_GAME_ROOM: "kick_game_room",
  USER_WAS_KICKED: "user_was_kicked",

  // Game management
  CREATE_GAME: "create_game",
  GAME_CREATED: "game_created",
  START_GAME: "start_game",
  GAME_STARTED: "game_started",

  // Player events
  PLAYER_JOINED: "player_joined",
  PLAYER_LEFT: "player_left",
  PLAYER_READY: "player_ready",
  PLAYER_READY_UPDATE: "player_ready_update",
  PLAYER_DISCONNECTED: "player_disconnected",
  PLAYER_RECONNECTED: "player_reconnected",
  PLAYERS_UPDATED: "players_updated",

  // Game phases
  PHASE_CHANGED: "phase_changed",

  // Game actions
  GAME_ACTION: "game_action",
  VOTE_CAST: "vote_cast",
  ABILITY_USED: "ability_used",

  // Host management
  HOST_TRANSFERRED: "host_transferred",

  // Game completion
  GAME_ENDED: "game_ended",
};

module.exports = SOCKET_EVENTS;
