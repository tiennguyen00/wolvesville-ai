import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import gameService from "../services/gameService";
import { Role } from "../services/gameService";
import { useToast } from "../hooks/useToast";
import { useQuery } from "@tanstack/react-query";
import SOCKET_EVENTS from "../constants/socketEvents";
import { useSocket } from "../context/SocketContext";

// Extend gameService with the new method
const extendedGameService = {
  ...gameService,
  handlePlayerTimeout: async (gameId: string, userId: string) => {
    const response = await gameService.performAction(gameId, {
      action_type: "timeout",
      target_id: userId,
    });
    return response;
  },
};

const GameLobby: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { socket, unsubscribeFromPlayerUpdates, subscribeToPlayerUpdates } =
    useSocket();
  const { toast } = useToast();

  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [hostUsername, setHostUsername] = useState<string>("");
  const [showTransferHostModal, setShowTransferHostModal] = useState(false);
  const [selectedNewHost, setSelectedNewHost] = useState<string | null>(null);
  const [disconnectedPlayers, setDisconnectedPlayers] = useState<
    Record<string, number>
  >({});
  const [reconnectionTimers, setReconnectionTimers] = useState<
    Record<string, NodeJS.Timeout>
  >({});

  const {
    data: gameData,
    isPending: isGameDataPending,
    error: gameDataError,
    refetch: refetchGameData,
  } = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => gameService.getGameById(gameId || ""),
    enabled: !!gameId,
  });

  const fetchRoles = async () => {
    try {
      const roles = await gameService.getRoles();
      setAvailableRoles(roles);
    } catch (err) {
      console.error("Error fetching roles:", err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !gameId || !socket) return;

    subscribeToPlayerUpdates(
      gameId,
      user?.username || user?.user_id || "",
      (data) => {
        refetchGameData();
      }
    );

    // When a user joins the game room, notify to all users on the room
    socket.on(SOCKET_EVENTS.USER_JOINED_ROOM, (data: any) => {
      toast({
        title: "User joined",
        content: `${data?.username} joined the game`,
        status: "success",
      });
    });

    // When a user lefts the game, notify to all users on the room
    socket.on(SOCKET_EVENTS.USER_LEFT_ROOM, (data: any) => {
      toast({
        title: "User left",
        content: `${data?.username} left the game`,
        status: "info",
      });
    });

    // When a player is kicked from the game, notify to all users on the room
    socket.on(SOCKET_EVENTS.USER_WAS_KICKED, (data: any) => {
      refetchGameData();
      if (data.user_id === user?.user_id) navigate("/games");
      toast({
        title: "Player was kicked",
        content: `${data?.username} was kicked from the game`,
        status: "info",
      });
    });

    // When host status is transferred to another player
    socket.on(SOCKET_EVENTS.HOST_TRANSFERRED, (data: any) => {
      refetchGameData();

      const wasIHost = data.previous_host_id === user?.user_id;
      const amINewHost = data.new_host_id === user?.user_id;

      if (wasIHost) {
        toast({
          title: "Host Transfer",
          content: `You transferred host status to ${data?.new_host_username}`,
          status: "info",
        });
      } else if (amINewHost) {
        toast({
          title: "Host Transfer",
          content: "You are now the host of this game",
          status: "success",
        });
      } else {
        toast({
          title: "Host Transfer",
          content: `${data?.new_host_username} is now the host`,
          status: "info",
        });
      }
    });

    // When the game is ended by the host
    socket.on(SOCKET_EVENTS.GAME_ENDED, (data: any) => {
      toast({
        title: "Game Ended",
        content: "The game has been ended by the host",
        status: "warning",
      });
      navigate("/games");
    });

    // When a user temporarily disconnects from the game lobby
    socket.on(SOCKET_EVENTS.PLAYER_DISCONNECTED, (data: any) => {
      // Get the user_id and username from the data (server now sends both)
      const userId = data.userId;
      let username = data.username || "Unknown player";

      // If we don't have user info, try to find it in gameData
      if (!username || username === "Unknown player") {
        const disconnectedPlayer = gameData?.players?.find(
          (player) => player.user_id === userId
        );

        if (disconnectedPlayer?.username) {
          username = disconnectedPlayer.username;
        }
      }

      if (!userId) {
        console.error("Invalid disconnect data - missing userId", data);
        return;
      }

      // Update disconnected players state
      setDisconnectedPlayers((prev) => ({
        ...prev,
        [userId]: Date.now(),
      }));

      toast({
        title: "Player Disconnected",
        content: `${username} has disconnected. Waiting for reconnection...`,
        status: "warning",
      });

      // Start a reconnection timer for this player (2 minute timeout)
      const timeout = setTimeout(() => {
        handlePlayerDisconnectTimeout(userId, username);
      }, 120000); // 2 minutes

      setReconnectionTimers((prev) => ({
        ...prev,
        [userId]: timeout,
      }));
    });

    // When a user reconnects to the game lobby
    socket.on(SOCKET_EVENTS.PLAYER_RECONNECTED, (data: any) => {
      console.log("PLAYER RECONNECTED", data);
      const { user_id, username } = data;

      // Check if this was a disconnected player
      if (disconnectedPlayers[user_id]) {
        // Clear reconnection timer
        if (reconnectionTimers[user_id]) {
          clearTimeout(reconnectionTimers[user_id]);
          setReconnectionTimers((prev) => {
            const newTimers = { ...prev };
            delete newTimers[user_id];
            return newTimers;
          });
        }

        // Remove from disconnected players
        setDisconnectedPlayers((prev) => {
          const newDisconnected = { ...prev };
          delete newDisconnected[user_id];
          return newDisconnected;
        });

        toast({
          title: "Player Reconnected",
          content: `${username} has reconnected to the game`,
          status: "success",
        });
      } else {
        // Handle case where we didn't know they were disconnected
        // (e.g., client just loaded and received a reconnection event)
        toast({
          title: "Player Reconnected",
          content: `${username} has reconnected to the game`,
          status: "info",
        });
      }

      // Refresh game data to ensure UI is updated
      refetchGameData();
    });

    return () => {
      socket.off(SOCKET_EVENTS.USER_JOINED_ROOM);
      socket.off(SOCKET_EVENTS.USER_LEFT_ROOM);
      socket.off(SOCKET_EVENTS.USER_WAS_KICKED);
      socket.off(SOCKET_EVENTS.HOST_TRANSFERRED);
      socket.off(SOCKET_EVENTS.GAME_ENDED);
      socket.off(SOCKET_EVENTS.PLAYER_DISCONNECTED);
      socket.off(SOCKET_EVENTS.PLAYER_RECONNECTED);

      // Clear all timers on component unmount
      Object.values(reconnectionTimers).forEach((timer) => clearTimeout(timer));

      unsubscribeFromPlayerUpdates(
        gameId || "",
        user?.username || user?.user_id || "",
        (data) => {
          refetchGameData();
        }
      );
    };
  }, [isAuthenticated, gameId, socket, disconnectedPlayers]);

  // Update host status when game data changes
  useEffect(() => {
    if (gameData && user) {
      const isCurrentUserHost = gameData.host_id === user.user_id;
      setIsHost(isCurrentUserHost);

      // Find host username
      const hostPlayer = gameData.players?.find(
        (player) => player.user_id === gameData.host_id
      );
      if (hostPlayer) {
        setHostUsername(hostPlayer.username || "Unknown");
      }
    }
  }, [gameData, user]);

  const startCountdown = () => {
    setCountdown(10);

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(timer);
          startGame();
          return null;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  };

  const startGame = async () => {
    if (!gameId) return;

    try {
      // In a real app, this would change the game status to "in_progress"
      await gameService.startGame(gameId);
      navigate(`/game/play/${gameId}`);
    } catch (err) {
      console.error("Error starting game:", err);
      setError("Failed to start the game. Please try again.");
    }
  };

  const leaveGame = async () => {
    if (!gameId) return;

    try {
      // In a real app, this would remove the player from the game
      await gameService.leaveGame(gameId);
      navigate("/games");
    } catch (err) {
      console.error("Error leaving game:", err);
      setError("Failed to leave the game. Please try again.");
    }
  };

  const handleEndGame = async () => {
    if (!gameId) return;

    try {
      // Show confirmation dialog
      if (!window.confirm("Are you sure you want to end this game?")) {
        return;
      }

      await gameService.endGame(gameId);
      toast({
        title: "Game ended",
        content: "The game has been ended successfully",
        status: "info",
      });
      navigate("/games");
    } catch (err) {
      console.error("Error ending game:", err);
      setError("Failed to end the game. Please try again.");
      toast({
        title: "Error",
        content: "Failed to end the game",
        status: "error",
      });
    }
  };

  const handleTransferHost = async () => {
    if (!gameId || !selectedNewHost) return;

    try {
      await gameService.transferHost(gameId, selectedNewHost);
      setShowTransferHostModal(false);
      setSelectedNewHost(null);

      toast({
        title: "Host transferred",
        content: "Host status has been transferred successfully",
        status: "success",
      });

      refetchGameData();
    } catch (err) {
      console.error("Error transferring host:", err);
      setError("Failed to transfer host. Please try again.");
      toast({
        title: "Error",
        content: "Failed to transfer host",
        status: "error",
      });
    }
  };

  const handleKickPlayer = async (playerId: string) => {
    if (!gameId) return;

    try {
      // Show confirmation dialog
      if (!window.confirm("Are you sure you want to kick this player?")) {
        return;
      }

      const result = await gameService.kickPlayer(gameId, playerId);
      socket?.emit(SOCKET_EVENTS.KICK_GAME_ROOM, {
        gameId,
        targetUserId: playerId,
        targetUsername: result.player_username,
      });
    } catch (err) {
      console.error("Error kicking player:", err);
      setError("Failed to kick player. Please try again.");
    }
  };

  // Handler for player disconnect timeout
  const handlePlayerDisconnectTimeout = async (
    userId: string,
    username: string
  ) => {
    try {
      // Remove the player from disconnected players list
      setDisconnectedPlayers((prev) => {
        const newDisconnected = { ...prev };
        delete newDisconnected[userId];
        return newDisconnected;
      });

      // Clean up the timer reference
      setReconnectionTimers((prev) => {
        const newTimers = { ...prev };
        delete newTimers[userId];
        return newTimers;
      });

      // Only attempt to remove if this is still the host and player hasn't already been removed
      if (isHost && gameData?.players?.some((p) => p.user_id === userId)) {
        // Call API to remove timed-out player
        await extendedGameService.handlePlayerTimeout(gameId || "", userId);

        toast({
          title: "Player Removed",
          content: `${username} has been removed due to connection timeout`,
          status: "info",
        });

        // Refresh game data
        refetchGameData();
      }
    } catch (err) {
      console.error("Error handling player disconnect timeout:", err);
    }
  };

  if (isGameDataPending) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || gameDataError || !gameData) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white bg-gray-900">
        <div className="max-w-md p-8 text-center bg-gray-800 rounded-lg">
          <div className="mb-4 text-4xl">🐺</div>
          <h2 className="mb-2 text-xl font-bold">Error</h2>
          <p className="mb-6 text-gray-400">{error || "Game not found"}</p>
          <Link to="/games" className="btn-primary">
            Back to Games
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen pb-12 text-white bg-gray-900">
      <div className="container px-6 py-8 mx-auto">
        <div className="flex flex-col items-start justify-between mb-8 md:flex-row">
          <div>
            <Link
              to="/games"
              className="inline-block mb-2 text-purple-400 hover:text-purple-300"
            >
              ← Back to Games
            </Link>
            <h1 className="mb-2 text-3xl font-bold text-white pixel-text">
              Game Lobby: {"Game #" + gameData.game_id.slice(0, 8)}
            </h1>
            <p className="text-lg text-gray-400">
              Host: <span className="text-purple-400">{hostUsername}</span>
            </p>
          </div>
          <div className="flex flex-col mt-4 space-y-2 md:mt-0 sm:flex-row sm:space-y-0 sm:space-x-2">
            {isHost && countdown === null && (
              <button
                onClick={startCountdown}
                className="flex items-center justify-center btn-primary pixel-button"
                style={{
                  opacity: (gameData?.players?.length ?? 0) < 3 ? 0.25 : 1,
                }}
                disabled={(gameData?.players?.length ?? 0) < 3} // Require at least 3 players
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  ></path>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  ></path>
                </svg>
                Start Game
              </button>
            )}
            {isHost && countdown === null && (
              <>
                <button
                  onClick={() => setShowTransferHostModal(true)}
                  className="flex items-center justify-center btn-secondary pixel-button"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                    ></path>
                  </svg>
                  Transfer Host
                </button>

                <button
                  onClick={handleEndGame}
                  className="flex items-center justify-center text-red-400 btn-secondary hover:text-red-300 pixel-button"
                >
                  <svg
                    className="w-5 h-5 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                  End Game
                </button>
              </>
            )}
            {isHost && countdown !== null && (
              <button
                onClick={() => setCountdown(null)}
                className="flex items-center justify-center btn-secondary pixel-button"
              >
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  ></path>
                </svg>
                Cancel ({countdown}s)
              </button>
            )}
            {!isHost && countdown !== null && (
              <div className="inline-flex items-center px-4 py-2 text-white bg-purple-700 rounded-md">
                <svg
                  className="w-5 h-5 mr-3 -ml-1 text-white animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Game starting in {countdown}s
              </div>
            )}
            {!isHost && (
              <button
                onClick={leaveGame}
                className="btn-secondary pixel-button"
              >
                Leave Game
              </button>
            )}
          </div>
        </div>

        {/* Game Information */}
        <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-3">
          {/* Players */}
          <div className="md:col-span-2">
            <div className="p-6 bg-gray-800 rounded-lg pixel-container">
              <h2 className="mb-4 text-xl font-bold pixel-text">
                Players ({gameData?.players?.length ?? 0}/{gameData.max_players}
                )
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {gameData?.players?.map((player) => (
                  <div
                    key={player.id}
                    className={`p-3 rounded-lg flex items-center ${
                      player.user_id === user?.user_id
                        ? "bg-purple-900/30 border border-purple-500"
                        : disconnectedPlayers[player.user_id]
                        ? "bg-gray-700 border border-yellow-500"
                        : "bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-center w-10 h-10 font-bold bg-purple-800 rounded-full">
                      {player.username?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="ml-3">
                      <div className="font-bold">
                        {player.username}
                        {player.user_id === user?.user_id && (
                          <span className="ml-2 text-xs text-purple-400">
                            (You)
                          </span>
                        )}
                        {disconnectedPlayers[player.user_id] && (
                          <span className="ml-2 text-xs text-yellow-400">
                            (Disconnected)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        Joined {new Date(player.played_at).toLocaleTimeString()}
                      </div>
                    </div>
                    {isHost && player.user_id !== user?.user_id && (
                      <button
                        onClick={() => handleKickPlayer(player.user_id)}
                        className="ml-auto text-red-400 hover:text-red-300"
                        title="Kick Player"
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M6 18L18 6M6 6l12 12"
                          ></path>
                        </svg>
                      </button>
                    )}
                  </div>
                ))}

                {Array.from(
                  {
                    length:
                      gameData.max_players - (gameData?.players?.length ?? 0),
                  },
                  (_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="flex items-center p-3 bg-gray-800 border border-gray-700 border-dashed rounded-lg"
                    >
                      <div className="flex items-center justify-center w-10 h-10 bg-gray-700 rounded-full opacity-50">
                        ?
                      </div>
                      <div className="ml-3 text-gray-500">
                        Waiting for player...
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Game Settings */}
          <div>
            <div className="p-6 bg-gray-800 rounded-lg pixel-container">
              <h2 className="mb-4 text-xl font-bold pixel-text">
                Game Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <div className="mb-1 text-gray-400">Game Mode</div>
                  <div className="font-medium">{gameData.game_mode}</div>
                </div>

                <div>
                  <div className="mb-1 text-gray-400">Password Protected</div>
                  <div className="font-medium">
                    {gameData.password_protected ? "Yes" : "No"}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-gray-400">Day Duration</div>
                  <div className="font-medium">
                    {gameData.settings?.day_duration || 120} seconds
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-gray-400">Night Duration</div>
                  <div className="font-medium">
                    {gameData.settings?.night_duration || 60} seconds
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-gray-400">Selected Roles</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {gameData.settings?.roles?.length ? (
                      gameData.settings.roles.map((roleId) => {
                        const role = availableRoles.find(
                          (r) => r.role_id === roleId
                        );
                        return (
                          <div
                            key={roleId}
                            className="px-2 py-1 text-xs bg-gray-700 rounded-full"
                          >
                            {role ? role.role_name : "Unknown Role"}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-gray-500">Default roles</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 mt-4 bg-gray-800 rounded-lg pixel-container">
              <h2 className="mb-4 text-xl font-bold pixel-text">Game Info</h2>

              <div className="space-y-4">
                <div>
                  <div className="mb-1 text-gray-400">Created</div>
                  <div className="font-medium">
                    {new Date(gameData.created_at).toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-gray-400">Status</div>
                  <div className="font-medium">
                    <span className="text-green-400">Ready to start</span>
                  </div>
                </div>

                <div className="pt-2">
                  <div className="text-sm text-gray-400">
                    {isHost
                      ? "As the host, you can start the game when ready."
                      : "Waiting for the host to start the game..."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Host Modal */}
      {showTransferHostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-gray-800 rounded-lg shadow-lg pixel-container">
            <h2 className="mb-4 text-xl font-bold text-white pixel-text">
              Transfer Host
            </h2>
            <p className="mb-4 text-gray-300">
              Select a player to transfer host status to:
            </p>

            <div className="mb-4 space-y-2 overflow-y-auto max-h-60">
              {gameData?.players
                ?.filter((player) => player.user_id !== user?.user_id)
                .map((player) => (
                  <div
                    key={player.id}
                    className={`p-3 rounded-lg flex items-center cursor-pointer ${
                      selectedNewHost === player.user_id
                        ? "bg-purple-900 border border-purple-500"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                    onClick={() => setSelectedNewHost(player.user_id)}
                  >
                    <div className="flex items-center justify-center w-8 h-8 font-bold bg-purple-800 rounded-full">
                      {player.username?.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div className="ml-3 font-medium">{player.username}</div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowTransferHostModal(false);
                  setSelectedNewHost(null);
                }}
                className="btn-secondary pixel-button"
              >
                Cancel
              </button>
              <button
                onClick={handleTransferHost}
                className="btn-primary pixel-button"
                disabled={!selectedNewHost}
                style={{ opacity: !selectedNewHost ? 0.5 : 1 }}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameLobby;
