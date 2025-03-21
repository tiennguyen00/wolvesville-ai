import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import gameService from "../services/gameService";
import { GameSession, GamePlayer, Role } from "../services/gameService";

const GameLobby: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [game, setGame] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isHost, setIsHost] = useState(false);

  const fetchGameData = async () => {
    if (!gameId) {
      setError("Game ID is missing");
      setLoading(false);
      return;
    }

    try {
      const gameData = await gameService.getGameById(gameId);
      setGame(gameData);
      setPlayers(gameData.players || []);

      // Check if current user is the host
      setIsHost(gameData.host_username === user?.username);

      // Check if game has moved to in_progress state
      if (gameData.status === "in_progress") {
        navigate(`/game/play/${gameId}`);
      }

      // Fetch available roles for the role labels
      try {
        const roles = await gameService.getRoles();
        setAvailableRoles(roles);
      } catch (err) {
        console.error("Error fetching roles:", err);
        // Non-critical error, don't set the main error state
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching game data:", err);
      setError("Failed to load game data. The game may no longer exist.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    fetchGameData();

    // Polling interval for game updates
    // const interval = setInterval(fetchGameData, 5000);
    // return () => clearInterval(interval);
  }, [gameId, isAuthenticated, navigate, user?.username]);

  const startCountdown = () => {
    console.log("starting countdown");
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

  const cancelCountdown = () => {
    setCountdown(null);
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

  const handleKickPlayer = async (playerId: string) => {
    if (!gameId) return;

    try {
      // Show confirmation dialog
      if (!window.confirm("Are you sure you want to kick this player?")) {
        return;
      }

      await gameService.kickPlayer(gameId, playerId);

      // Update the player list after kicking
      setPlayers(players.filter((player) => player.user_id !== playerId));

      // Show a temporary notification
      const notification = document.createElement("div");
      notification.className =
        "fixed px-4 py-2 text-white bg-green-800 rounded shadow-lg top-4 right-4";
      notification.textContent = "Player kicked successfully";
      document.body.appendChild(notification);

      // Remove notification after 3 seconds
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 3000);
    } catch (err) {
      console.error("Error kicking player:", err);
      setError("Failed to kick player. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !game) {
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
              Game Lobby:{" "}
              {game.game_name || "Game #" + game.session_id.slice(0, 8)}
            </h1>
            <p className="text-lg text-gray-400">
              Host:{" "}
              <span className="text-purple-400">{game.host_username}</span>
            </p>
          </div>

          <div className="flex flex-col mt-4 space-y-2 md:mt-0 sm:flex-row sm:space-y-0 sm:space-x-2">
            {isHost && countdown === null && (
              <button
                onClick={startCountdown}
                className="flex items-center justify-center btn-primary pixel-button"
                style={{
                  opacity: players.length < 3 ? 0.25 : 1,
                }}
                disabled={players.length < 3} // Require at least 3 players
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

            {isHost && countdown !== null && (
              <button
                onClick={cancelCountdown}
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

            <button onClick={leaveGame} className="btn-secondary pixel-button">
              Leave Game
            </button>
          </div>
        </div>

        {/* Game Information */}
        <div className="grid grid-cols-1 gap-6 mb-8 md:grid-cols-3">
          {/* Players */}
          <div className="md:col-span-2">
            <div className="p-6 bg-gray-800 rounded-lg pixel-container">
              <h2 className="mb-4 text-xl font-bold pixel-text">
                Players ({players.length}/{game.max_players})
              </h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {players.map((player) => (
                  <div
                    key={player.player_id}
                    className={`p-3 rounded-lg flex items-center ${
                      player.user_id === user?.user_id
                        ? "bg-purple-900/30 border border-purple-500"
                        : "bg-gray-700"
                    }`}
                  >
                    <div className="flex items-center justify-center w-10 h-10 font-bold bg-purple-800 rounded-full">
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-3">
                      <div className="font-bold">
                        {player.username}
                        {player.user_id === user?.user_id && (
                          <span className="ml-2 text-xs text-purple-400">
                            (You)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        Joined {new Date(player.join_time).toLocaleTimeString()}
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
                  { length: game.max_players - players.length },
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
                  <div className="font-medium">{game.game_mode}</div>
                </div>

                <div>
                  <div className="mb-1 text-gray-400">Password Protected</div>
                  <div className="font-medium">
                    {game.password_protected ? "Yes" : "No"}
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-gray-400">Day Duration</div>
                  <div className="font-medium">
                    {game.settings?.day_duration || 120} seconds
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-gray-400">Night Duration</div>
                  <div className="font-medium">
                    {game.settings?.night_duration || 60} seconds
                  </div>
                </div>

                <div>
                  <div className="mb-1 text-gray-400">Selected Roles</div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {game.settings?.roles?.length ? (
                      game.settings.roles.map((roleId) => {
                        const role = availableRoles.find(
                          (r) => r.role_id === roleId
                        );
                        return (
                          <div
                            key={roleId}
                            className="px-2 py-1 text-xs bg-gray-700 rounded-full"
                          >
                            {role ? role.name : "Unknown Role"}
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
                    {new Date(game.created_at).toLocaleString()}
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
    </div>
  );
};

export default GameLobby;
