import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="bg-gray-800 shadow-md">
        <div className="container mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="text-xl font-bold text-purple-500 mr-6">
                Wolvesville
              </div>
              <div className="hidden md:flex space-x-6">
                <Link
                  to="/dashboard"
                  className="text-white hover:text-purple-400"
                >
                  Dashboard
                </Link>
                <Link
                  to="/games"
                  className="text-gray-300 hover:text-purple-400"
                >
                  Games
                </Link>
                <Link
                  to="/profile"
                  className="text-gray-300 hover:text-purple-400"
                >
                  Profile
                </Link>
                <Link
                  to="/stats"
                  className="text-gray-300 hover:text-purple-400"
                >
                  Stats
                </Link>
                <Link
                  to="/history"
                  className="text-gray-300 hover:text-purple-400"
                >
                  History
                </Link>
                <Link
                  to="/shop"
                  className="text-gray-300 hover:text-purple-400"
                >
                  Shop
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <div className="text-sm mr-2">
                  <span className="hidden md:inline text-gray-300 mr-1">
                    Gems:
                  </span>
                  <span className="text-purple-400 font-medium">
                    {user?.gems || 0}
                  </span>
                </div>
                <div className="text-sm mr-2">
                  <span className="hidden md:inline text-gray-300 mr-1">
                    Coins:
                  </span>
                  <span className="text-yellow-400 font-medium">
                    {user?.gold_coins || 0}
                  </span>
                </div>
              </div>
              <div className="relative group">
                <button className="flex items-center text-gray-300 hover:text-white">
                  <span className="mr-1">{user?.username || "Player"}</span>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    ></path>
                  </svg>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md overflow-hidden shadow-xl z-10 hidden group-hover:block">
                  <Link
                    to="/profile"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    View Profile
                  </Link>
                  <Link
                    to="/stats"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Statistics
                  </Link>
                  <Link
                    to="/history"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Game History
                  </Link>
                  <Link
                    to="/settings"
                    className="block px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={logout}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <div className="container mx-auto px-6 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">
          Welcome back,{" "}
          <span className="text-purple-500">{user?.username || "Player"}</span>!
        </h1>

        {/* Game Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="card transform hover:scale-105 transition-transform">
            <h2 className="text-xl font-bold mb-4 text-white pixel-text">
              Quick Play
            </h2>
            <p className="text-gray-300 mb-6">
              Join a random game with other players. Get matched quickly and
              start playing within seconds.
            </p>
            <Link
              to="/games"
              className="btn-primary w-full block text-center pixel-button"
            >
              Find Game
            </Link>
          </div>
          <div className="card transform hover:scale-105 transition-transform">
            <h2 className="text-xl font-bold mb-4 text-white pixel-text">
              Create Game
            </h2>
            <p className="text-gray-300 mb-6">
              Create a custom game with your own rules and settings. Invite
              friends or open it to the public.
            </p>
            <Link
              to="/create-game"
              className="btn-primary w-full block text-center pixel-button"
            >
              Create New Game
            </Link>
          </div>
          <div className="card transform hover:scale-105 transition-transform">
            <h2 className="text-xl font-bold mb-4 text-white pixel-text">
              Browse Games
            </h2>
            <p className="text-gray-300 mb-6">
              Browse all available game lobbies. Filter by game mode, player
              count, and more.
            </p>
            <Link
              to="/games"
              className="btn-primary w-full block text-center pixel-button"
            >
              Browse Lobbies
            </Link>
          </div>
        </div>

        {/* Player Stats */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-6">Your Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gray-800 rounded-lg p-4 shadow-md">
              <div className="text-4xl font-bold text-white mb-2">42</div>
              <div className="text-gray-400">Games Played</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 shadow-md">
              <div className="text-4xl font-bold text-white mb-2">28</div>
              <div className="text-gray-400">Games Won</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 shadow-md">
              <div className="text-4xl font-bold text-purple-500 mb-2">66%</div>
              <div className="text-gray-400">Win Rate</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 shadow-md">
              <div className="text-4xl font-bold text-white mb-2">5</div>
              <div className="text-gray-400">Best Streak</div>
            </div>
          </div>
          <div className="mt-4 text-right">
            <Link
              to="/stats"
              className="text-purple-500 hover:text-purple-400 text-sm font-medium"
            >
              View detailed statistics →
            </Link>
          </div>
        </div>

        {/* Recent Games */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-6">Recent Games</h2>
          <div className="bg-gray-800 rounded-lg overflow-hidden shadow-md">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Game Mode
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Role
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    Result
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                  >
                    XP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    Today, 2:30 PM
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    Classic
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    Werewolf
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-400">
                    Victory
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    +120 XP
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    Today, 1:15 PM
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    Quick Play
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    Village Elder
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-400">
                    Defeat
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    +45 XP
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    Yesterday, 8:20 PM
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    Custom
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    Seer
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-green-400">
                    Victory
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    +150 XP
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
    </div>
  );
};

export default Dashboard;
