import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import userService, { GameHistoryItem } from "../services/userService";

const History: React.FC = () => {
  const { user } = useAuth();
  const [games, setGames] = useState<GameHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [resultFilter, setResultFilter] = useState<string>("all");
  const [gameModeFilter, setGameModeFilter] = useState<string>("all");

  // Mock game history data (will be replaced with API call)
  const mockGames: GameHistoryItem[] = [
    {
      game_id: "g1",
      date: "2023-05-20",
      game_mode: "Classic",
      role: "Werewolf",
      result: "victory",
      xp_earned: 120,
    },
    {
      game_id: "g2",
      date: "2023-05-19",
      game_mode: "Quick Play",
      role: "Villager",
      result: "defeat",
      xp_earned: 45,
    },
    {
      game_id: "g3",
      date: "2023-05-18",
      game_mode: "Custom",
      role: "Seer",
      result: "victory",
      xp_earned: 150,
    },
    {
      game_id: "g4",
      date: "2023-05-17",
      game_mode: "Classic",
      role: "Doctor",
      result: "victory",
      xp_earned: 135,
    },
    {
      game_id: "g5",
      date: "2023-05-16",
      game_mode: "Quick Play",
      role: "Hunter",
      result: "defeat",
      xp_earned: 50,
    },
    {
      game_id: "g6",
      date: "2023-05-15",
      game_mode: "Ranked",
      role: "Werewolf",
      result: "victory",
      xp_earned: 200,
    },
    {
      game_id: "g7",
      date: "2023-05-14",
      game_mode: "Custom",
      role: "Bodyguard",
      result: "defeat",
      xp_earned: 60,
    },
    {
      game_id: "g8",
      date: "2023-05-13",
      game_mode: "Classic",
      role: "Villager",
      result: "victory",
      xp_earned: 100,
    },
    {
      game_id: "g9",
      date: "2023-05-12",
      game_mode: "Quick Play",
      role: "Seer",
      result: "victory",
      xp_earned: 110,
    },
    {
      game_id: "g10",
      date: "2023-05-11",
      game_mode: "Classic",
      role: "Witch",
      result: "defeat",
      xp_earned: 70,
    },
  ];

  useEffect(() => {
    const fetchGames = async () => {
      try {
        setLoading(true);

        // In development with mock backend, use mock data
        if (process.env.NODE_ENV === "development") {
          setTimeout(() => {
            setGames(mockGames);
            setLoading(false);
          }, 1000);
          return;
        }

        // In production, use the API
        const response = await userService.getGameHistory();
        setGames(response.games);
        setLoading(false);
      } catch (err) {
        console.error("Failed to fetch game history:", err);
        setError("Failed to load game history. Please try again later.");
        // Fallback to mock data if API fails
        setGames(mockGames);
        setLoading(false);
      }
    };

    fetchGames();
  }, []);

  // Get unique roles, game modes for filters
  const uniqueRoles = [...new Set(games.map((game) => game.role))];
  const uniqueGameModes = [...new Set(games.map((game) => game.game_mode))];

  // Apply filters
  const filteredGames = games.filter((game) => {
    return (
      (roleFilter === "all" || game.role === roleFilter) &&
      (resultFilter === "all" || game.result === resultFilter) &&
      (gameModeFilter === "all" || game.game_mode === gameModeFilter)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-12">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="text-purple-400 hover:text-purple-300 mb-2 inline-block"
          >
            ← Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white pixel-text">
            Game History
          </h1>
          <p className="text-gray-400">
            View all your past games and filter by role, result, or game mode
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8 pixel-container">
          <h2 className="text-xl font-bold mb-4">Filter Games</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="role-filter" className="block text-gray-400 mb-2">
                Role
              </label>
              <select
                id="role-filter"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="all">All Roles</option>
                {uniqueRoles.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="result-filter"
                className="block text-gray-400 mb-2"
              >
                Result
              </label>
              <select
                id="result-filter"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                value={resultFilter}
                onChange={(e) => setResultFilter(e.target.value)}
              >
                <option value="all">All Results</option>
                <option value="victory">Victory</option>
                <option value="defeat">Defeat</option>
              </select>
            </div>

            <div>
              <label htmlFor="mode-filter" className="block text-gray-400 mb-2">
                Game Mode
              </label>
              <select
                id="mode-filter"
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white"
                value={gameModeFilter}
                onChange={(e) => setGameModeFilter(e.target.value)}
              >
                <option value="all">All Game Modes</option>
                {uniqueGameModes.map((mode) => (
                  <option key={mode} value={mode}>
                    {mode}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Game History Table */}
        <div className="bg-gray-800 rounded-lg p-6 pixel-container">
          <h2 className="text-xl font-bold mb-4">Your Games</h2>

          {filteredGames.length === 0 ? (
            <p className="text-gray-400">No games match your filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-700">
                    <th className="px-4 py-2 text-left text-sm text-gray-300">
                      Date
                    </th>
                    <th className="px-4 py-2 text-left text-sm text-gray-300">
                      Game Mode
                    </th>
                    <th className="px-4 py-2 text-left text-sm text-gray-300">
                      Role
                    </th>
                    <th className="px-4 py-2 text-left text-sm text-gray-300">
                      Result
                    </th>
                    <th className="px-4 py-2 text-left text-sm text-gray-300">
                      XP
                    </th>
                    <th className="px-4 py-2 text-left text-sm text-gray-300">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredGames.map((game) => (
                    <tr key={game.game_id} className="hover:bg-gray-700/50">
                      <td className="px-4 py-3">{game.date}</td>
                      <td className="px-4 py-3">{game.game_mode}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`${
                            game.role === "Werewolf"
                              ? "text-red-400"
                              : game.role === "Seer" || game.role === "Doctor"
                              ? "text-blue-400"
                              : "text-white"
                          }`}
                        >
                          {game.role}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 font-medium ${
                          game.result === "victory"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {game.result === "victory" ? "Victory" : "Defeat"}
                      </td>
                      <td className="px-4 py-3">+{game.xp_earned} XP</td>
                      <td className="px-4 py-3">
                        <Link
                          to={`/game/summary/${game.game_id}`}
                          className="text-purple-400 hover:text-purple-300 underline text-sm"
                        >
                          View Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default History;
