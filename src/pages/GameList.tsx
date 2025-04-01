import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import gameService, { GameSession } from "../services/gameService";
import { useQuery } from "@tanstack/react-query";

const GameList: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<
    "all" | "lobby" | "in_progress" | "completed"
  >("all");
  const [passwordInput, setPasswordInput] = useState("");
  const [selectedGame, setSelectedGame] = useState<GameSession | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const {
    data: dataListGames,
    isLoading: isLoadingListGames,
    error: errorListGames,
  } = useQuery({
    queryKey: ["list-games"],
    queryFn: () => gameService.getGames(),
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const handleJoinGame = async (game: GameSession) => {
    if (game.password_protected) {
      setSelectedGame(game);
      return;
    }

    try {
      await gameService.joinGame(game.game_id);
      navigate(`/game/lobby/${game.game_id}`);
    } catch (err) {
      console.error("Error joining game:", err);
      setJoinError(
        err.response.data.error ||
          "Failed to join game. It might be full or no longer available."
      );
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedGame) return;

    try {
      await gameService.joinGame(selectedGame.game_id, passwordInput);
      setPasswordInput("");
      setSelectedGame(null);
      navigate(`/game/lobby/${selectedGame.game_id}`);
    } catch (err) {
      console.error("Error joining password-protected game:", err);
      setJoinError("Incorrect password or the game is no longer available.");
    }
  };

  // Helper function to get host username from players array
  const getHostUsername = (game: GameSession) => {
    if (!game.players || game.players.length === 0) return "Unknown";

    const hostPlayer = game.players.find((p) => p.user_id === game.host_id);
    return hostPlayer?.username || "Unknown";
  };

  // Helper function to get current players count
  const getCurrentPlayersCount = (game: GameSession) => {
    return game.players?.length || 0;
  };

  // Helper function to get game display name
  const getGameDisplayName = (game: GameSession) => {
    return `Game #${game.game_id.slice(0, 8)}`;
  };

  const getStatusBadge = (game: GameSession) => {
    switch (game.status) {
      case "lobby":
        return (
          <span className="px-2 py-1 text-xs bg-blue-500 rounded pixel-text">
            Lobby
          </span>
        );
      case "in_progress":
        return (
          <span className="px-2 py-1 text-xs bg-green-500 rounded pixel-text">
            In Progress
          </span>
        );
      case "completed":
        return (
          <span className="px-2 py-1 text-xs bg-gray-500 rounded pixel-text">
            Completed
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoadingListGames) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 text-white bg-gray-900">
      <div className="container px-4 py-8 mx-auto">
        <header className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-center text-purple-500 pixel-text">
            Available Games
          </h1>
          <p className="mb-6 text-center text-gray-400 pixel-text">
            Join an existing game or create your own
          </p>

          <div className="flex items-center justify-between">
            <div className="flex space-x-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded ${
                  filter === "all" ? "bg-purple-600" : "bg-gray-700"
                } pixel-button`}
              >
                All
              </button>
              <button
                onClick={() => setFilter("lobby")}
                className={`px-4 py-2 rounded ${
                  filter === "lobby" ? "bg-purple-600" : "bg-gray-700"
                } pixel-button`}
              >
                Lobby
              </button>
              <button
                onClick={() => setFilter("in_progress")}
                className={`px-4 py-2 rounded ${
                  filter === "in_progress" ? "bg-purple-600" : "bg-gray-700"
                } pixel-button`}
              >
                In Progress
              </button>
              <button
                onClick={() => setFilter("completed")}
                className={`px-4 py-2 rounded ${
                  filter === "completed" ? "bg-purple-600" : "bg-gray-700"
                } pixel-button`}
              >
                Completed
              </button>
            </div>

            <Link
              to="/create-game"
              className="px-4 py-2 font-medium text-white bg-purple-600 rounded hover:bg-purple-700 pixel-button"
            >
              Create Game
            </Link>
          </div>
        </header>

        {errorListGames && (
          <div className="px-4 py-3 mb-4 text-red-100 border border-red-500 rounded bg-red-500/20">
            {errorListGames.message}
          </div>
        )}

        {joinError && (
          <div className="px-4 py-3 mb-4 text-red-100 border border-red-500 rounded bg-red-500/20">
            {joinError}
            <button
              onClick={() => setJoinError(null)}
              className="ml-2 text-sm underline"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {dataListGames && dataListGames?.length > 0 ? (
            dataListGames?.map((game) => (
              <div
                key={game.game_id}
                className="overflow-hidden bg-gray-800 border-2 border-gray-700 rounded-lg pixel-container"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h2 className="text-xl font-bold text-purple-400 truncate pixel-text">
                      {getGameDisplayName(game)}
                    </h2>
                    {getStatusBadge(game)}
                  </div>

                  <div className="mb-4 text-sm text-gray-400">
                    <div className="flex justify-between mb-1">
                      <span>Host:</span>
                      <span className="font-medium text-gray-300">
                        {getHostUsername(game)}
                      </span>
                    </div>
                    <div className="flex justify-between mb-1">
                      <span>Players:</span>
                      <span className="font-medium text-gray-300">
                        {getCurrentPlayersCount(game)} / {game.max_players}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Created:</span>
                      <span className="font-medium text-gray-300">
                        {new Date(game.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="mb-3">
                    {game.password_protected && (
                      <div className="flex items-center mb-2 text-xs text-yellow-500">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-4 h-4 mr-1"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path
                            fillRule="evenodd"
                            d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Password Protected
                      </div>
                    )}

                    <div className="flex space-x-2">
                      {game.status === "lobby" &&
                        getCurrentPlayersCount(game) < game.max_players && (
                          <button
                            onClick={() => handleJoinGame(game)}
                            className="w-full px-3 py-2 font-medium text-white bg-purple-600 rounded hover:bg-purple-700 pixel-button"
                          >
                            Join Game
                          </button>
                        )}

                      {game.status === "in_progress" &&
                        user?.user_id &&
                        game.players?.some(
                          (p) => p.user_id === user.user_id
                        ) && (
                          <Link
                            to={`/game/play/${game.game_id}`}
                            className="w-full px-3 py-2 font-medium text-center text-white bg-green-600 rounded hover:bg-green-700 pixel-button"
                          >
                            Rejoin Game
                          </Link>
                        )}

                      {game.status === "completed" && (
                        <Link
                          to={`/game/summary/${game.game_id}`}
                          className="w-full px-3 py-2 font-medium text-center text-white bg-gray-600 rounded hover:bg-gray-700 pixel-button"
                        >
                          View Summary
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-12 text-center col-span-full">
              <div className="mb-4 text-5xl">🐺</div>
              <h3 className="mb-2 text-xl font-bold pixel-text">
                No Games Found
              </h3>
              <p className="mb-6 text-gray-400 pixel-text">
                {filter !== "all"
                  ? `No ${filter.replace("_", " ")} games available.`
                  : "No games available at the moment."}
              </p>
              <Link
                to="/create-game"
                className="px-4 py-2 font-medium text-white bg-purple-600 rounded hover:bg-purple-700 pixel-button"
              >
                Create a Game
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Password Modal */}
      {selectedGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
          <div className="w-full max-w-md p-6 bg-gray-800 border-2 border-purple-500 rounded-lg pixel-container">
            <h3 className="mb-4 text-xl font-bold pixel-text">
              Enter Password for "{getGameDisplayName(selectedGame)}"
            </h3>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="password"
                  className="block mb-1 text-sm font-medium text-gray-400 pixel-text"
                >
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  autoFocus
                  required
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGame(null);
                    setPasswordInput("");
                  }}
                  className="px-4 py-2 text-white bg-gray-700 rounded hover:bg-gray-600 pixel-button"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-purple-600 rounded hover:bg-purple-700 pixel-button"
                >
                  Join Game
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameList;
