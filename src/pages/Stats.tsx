import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import userService, {
  DetailedUserStats,
  StatPeriod,
} from "../services/userService";
import RolePopularity from "../components/RolePopularity";
import WinLossChart from "../components/WinLossChart";
import Achievements from "../components/Achievements";

const Stats: React.FC = () => {
  const { user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<StatPeriod>("all");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DetailedUserStats | null>(null);

  // Fetch stats data based on the selected period
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const statsData = await userService.getUserStatsByPeriod(
          selectedPeriod
        );
        setStats(statsData);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch stats:", err);
        setError("Failed to load statistics. Please try again later.");
        // Use mock data as fallback when API fails
        setStats(getMockStats(selectedPeriod));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [selectedPeriod]);

  // Mock data function for development/fallback
  const getMockStats = (period: StatPeriod): DetailedUserStats => {
    // Base mock data for all periods
    const baseMockData: DetailedUserStats = {
      period,
      total_games: period === "all" ? 42 : period === "month" ? 15 : 5,
      games_won: period === "all" ? 28 : period === "month" ? 10 : 3,
      win_rate: period === "all" ? 66.7 : period === "month" ? 66.7 : 60,
      role_stats: {
        Villager: period === "all" ? 12 : period === "month" ? 5 : 2,
        Werewolf: period === "all" ? 10 : period === "month" ? 4 : 1,
        Seer: period === "all" ? 8 : period === "month" ? 3 : 1,
        Doctor: period === "all" ? 6 : period === "month" ? 2 : 1,
        Hunter: period === "all" ? 6 : period === "month" ? 1 : 0,
      },
      best_streak: period === "all" ? 5 : period === "month" ? 3 : 2,
      total_eliminations: period === "all" ? 15 : period === "month" ? 7 : 2,
      average_game_duration:
        period === "all" ? 15.5 : period === "month" ? 14.2 : 13.8, // In minutes
      recent_games: [
        {
          game_id: "g1",
          date: "2023-05-15",
          game_mode: "Classic",
          role: "Werewolf",
          result: "victory" as "victory" | "defeat",
          xp_earned: 120,
        },
        {
          game_id: "g2",
          date: "2023-05-14",
          game_mode: "Quick Play",
          role: "Villager",
          result: "defeat" as "victory" | "defeat",
          xp_earned: 45,
        },
        {
          game_id: "g3",
          date: "2023-05-13",
          game_mode: "Custom",
          role: "Seer",
          result: "victory" as "victory" | "defeat",
          xp_earned: 150,
        },
        {
          game_id: "g4",
          date: "2023-05-12",
          game_mode: "Classic",
          role: "Doctor",
          result: "victory" as "victory" | "defeat",
          xp_earned: 135,
        },
        {
          game_id: "g5",
          date: "2023-05-11",
          game_mode: "Quick Play",
          role: "Hunter",
          result: "defeat" as "victory" | "defeat",
          xp_earned: 50,
        },
      ].slice(0, period === "all" ? 5 : period === "month" ? 3 : 2),
    };

    return baseMockData;
  };

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
            Game Statistics
          </h1>
          <p className="text-gray-400">
            Detailed statistics for {user?.username || "Player"}
          </p>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        {/* Period Selection */}
        <div className="flex space-x-4 mb-8">
          <button
            className={`px-4 py-2 rounded ${
              selectedPeriod === "all"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300"
            } pixel-button`}
            onClick={() => setSelectedPeriod("all")}
          >
            All Time
          </button>
          <button
            className={`px-4 py-2 rounded ${
              selectedPeriod === "month"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300"
            } pixel-button`}
            onClick={() => setSelectedPeriod("month")}
          >
            This Month
          </button>
          <button
            className={`px-4 py-2 rounded ${
              selectedPeriod === "week"
                ? "bg-purple-600 text-white"
                : "bg-gray-700 text-gray-300"
            } pixel-button`}
            onClick={() => setSelectedPeriod("week")}
          >
            This Week
          </button>
        </div>

        {stats && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Statistics Overview */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-lg p-6 pixel-container mb-8">
                <h2 className="text-xl font-bold mb-6 text-white">
                  Statistics Overview
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Games Played</p>
                    <p className="text-2xl font-bold">{stats.total_games}</p>
                  </div>
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Games Won</p>
                    <p className="text-2xl font-bold">{stats.games_won}</p>
                  </div>
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Win Rate</p>
                    <p className="text-2xl font-bold text-purple-400">
                      {typeof stats.win_rate === "number"
                        ? `${stats.win_rate}%`
                        : `${parseFloat(stats.win_rate as string).toFixed(1)}%`}
                    </p>
                  </div>
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Avg. Game Duration</p>
                    <p className="text-2xl font-bold">
                      {typeof stats.average_game_duration === "number"
                        ? `${stats.average_game_duration} min`
                        : `${parseFloat(
                            stats.average_game_duration as string
                          ).toFixed(1)} min`}
                    </p>
                  </div>
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Best Win Streak</p>
                    <p className="text-2xl font-bold">{stats.best_streak}</p>
                  </div>
                  <div className="bg-gray-700/50 p-4 rounded-lg">
                    <p className="text-gray-400 text-sm">Total Eliminations</p>
                    <p className="text-2xl font-bold text-red-400">
                      {stats.total_eliminations}
                    </p>
                  </div>
                </div>
              </div>

              {/* Role Popularity Visualization */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <RolePopularity
                  roleStats={stats.role_stats}
                  totalGames={Number(stats.total_games)}
                />
                <WinLossChart
                  wins={Number(stats.games_won)}
                  total={Number(stats.total_games)}
                />
              </div>

              {/* Role Performance */}
              <div className="bg-gray-800 rounded-lg p-6 pixel-container mb-8">
                <h2 className="text-xl font-bold mb-6 text-white">
                  Role Performance
                </h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="bg-gray-700">
                        <th className="px-4 py-2 text-left text-sm text-gray-300">
                          Role
                        </th>
                        <th className="px-4 py-2 text-left text-sm text-gray-300">
                          Times Played
                        </th>
                        <th className="px-4 py-2 text-left text-sm text-gray-300">
                          % of Games
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {Object.entries(stats.role_stats)
                        .sort(([, a], [, b]) => b - a)
                        .map(([role, count]) => (
                          <tr key={role} className="hover:bg-gray-700/50">
                            <td className="px-4 py-3">{role}</td>
                            <td className="px-4 py-3">{count}</td>
                            <td className="px-4 py-3">
                              {typeof stats.total_games === "number" &&
                              stats.total_games > 0
                                ? Math.round((count / stats.total_games) * 100)
                                : typeof stats.total_games === "string" &&
                                  parseInt(stats.total_games) > 0
                                ? Math.round(
                                    (count / parseInt(stats.total_games)) * 100
                                  )
                                : 0}
                              %
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Recent Games */}
              <div className="bg-gray-800 rounded-lg p-6 pixel-container">
                <h2 className="text-xl font-bold mb-6 text-white">
                  Recent Games
                </h2>
                {stats.recent_games.length === 0 ? (
                  <p className="text-gray-400">
                    No games played during this period.
                  </p>
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {stats.recent_games.map((game) => (
                          <tr
                            key={game.game_id}
                            className="hover:bg-gray-700/50"
                          >
                            <td className="px-4 py-3">{game.date}</td>
                            <td className="px-4 py-3">{game.game_mode}</td>
                            <td className="px-4 py-3">{game.role}</td>
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="mt-4 text-right">
                  <Link
                    to="/history"
                    className="text-purple-500 hover:text-purple-400 text-sm font-medium"
                  >
                    View all games →
                  </Link>
                </div>
              </div>
            </div>

            {/* Achievement Progress */}
            <div>
              <WinLossChart wins={stats.games_won} total={stats.total_games} />

              <div className="bg-gray-800 rounded-lg p-6 pixel-container mb-8">
                <h2 className="text-xl font-bold mb-6 text-white">
                  Achievement Progress
                </h2>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-300">Games Played</span>
                      <span className="text-gray-300">
                        {stats.total_games}/100
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-purple-600 h-2.5 rounded-full"
                        style={{
                          width: `${Math.min(
                            (Number(stats.total_games) / 100) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-300">Win Streak</span>
                      <span className="text-gray-300">
                        {stats.best_streak}/10
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-purple-600 h-2.5 rounded-full"
                        style={{
                          width: `${Math.min(
                            (Number(stats.best_streak) / 10) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-gray-300">Eliminations</span>
                      <span className="text-gray-300">
                        {stats.total_eliminations}/50
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-purple-600 h-2.5 rounded-full"
                        style={{
                          width: `${Math.min(
                            (Number(stats.total_eliminations) / 50) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Achievements Section */}
              <Achievements
                achievements={[
                  {
                    id: 1,
                    name: "First Win",
                    description: "Win your first game",
                    unlocked: Number(stats.games_won) > 0,
                    date: stats.recent_games.find((g) => g.result === "victory")
                      ?.date,
                  },
                  {
                    id: 2,
                    name: "Wolf Pack",
                    description: "Win 5 games as a Werewolf",
                    unlocked: (stats.role_stats["Werewolf"] || 0) >= 5,
                    date: "2023-05-10",
                  },
                  {
                    id: 3,
                    name: "Village Hero",
                    description: "Save a villager from the werewolves",
                    unlocked: (stats.role_stats["Doctor"] || 0) >= 1,
                    date: "2023-05-15",
                  },
                  {
                    id: 4,
                    name: "Perfect Detective",
                    description: "Correctly identify 3 werewolves in one game",
                    unlocked: false,
                  },
                  {
                    id: 5,
                    name: "Mastermind",
                    description: "Win 10 games in a row",
                    unlocked: Number(stats.best_streak) >= 10,
                    date:
                      Number(stats.best_streak) >= 10
                        ? "2023-06-01"
                        : undefined,
                  },
                  {
                    id: 6,
                    name: "Seasoned Player",
                    description: "Play 50 games",
                    unlocked: Number(stats.total_games) >= 50,
                    date:
                      Number(stats.total_games) >= 50
                        ? "2023-06-05"
                        : undefined,
                  },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Stats;
