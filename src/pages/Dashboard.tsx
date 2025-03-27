import React from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Navigation */}
      <nav className="bg-gray-800 shadow-md">
        <div className="container px-6 py-3 mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="mr-6 text-xl font-bold text-purple-500">
                Wolvesville
              </div>
              <div className="hidden space-x-6 md:flex">
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
                <div className="mr-2 text-sm">
                  <span className="hidden mr-1 text-gray-300 md:inline">
                    Gems:
                  </span>
                  <span className="font-medium text-purple-400">
                    {user?.gems || 0}
                  </span>
                </div>
                <div className="mr-2 text-sm">
                  <span className="hidden mr-1 text-gray-300 md:inline">
                    Coins:
                  </span>
                  <span className="font-medium text-yellow-400">
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
                <div className="absolute right-0 z-10 block w-48 mt-2 overflow-hidden bg-gray-800 rounded-md shadow-xl group-hover:block">
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
                    className="block w-full px-4 py-2 text-sm text-left text-gray-300 hover:bg-gray-700"
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
      <div className="container px-6 py-8 mx-auto">
        <h1 className="mb-8 text-3xl font-bold text-white">
          Welcome back,{" "}
          <span className="text-purple-500">{user?.username || "Player"}</span>!
        </h1>

        {/* Game Options */}
        <div className="grid grid-cols-1 gap-6 mb-12 md:grid-cols-2 lg:grid-cols-3">
          <div className="transition-transform transform card hover:scale-105">
            <h2 className="mb-4 text-xl font-bold text-white pixel-text">
              Quick Play
            </h2>
            <p className="mb-6 text-gray-300">
              Join a random game with other players. Get matched quickly and
              start playing within seconds.
            </p>
            <Link
              to="/games"
              className="block w-full text-center btn-primary pixel-button"
            >
              Find Game
            </Link>
          </div>
          <div className="transition-transform transform card hover:scale-105">
            <h2 className="mb-4 text-xl font-bold text-white pixel-text">
              Create Game
            </h2>
            <p className="mb-6 text-gray-300">
              Create a custom game with your own rules and settings. Invite
              friends or open it to the public.
            </p>
            <Link
              to="/create-game"
              className="block w-full text-center btn-primary pixel-button"
            >
              Create New Game
            </Link>
          </div>
          <div className="transition-transform transform card hover:scale-105">
            <h2 className="mb-4 text-xl font-bold text-white pixel-text">
              Browse Games
            </h2>
            <p className="mb-6 text-gray-300">
              Browse all available game lobbies. Filter by game mode, player
              count, and more.
            </p>
            <Link
              to="/games"
              className="block w-full text-center btn-primary pixel-button"
            >
              Browse Lobbies
            </Link>
          </div>
        </div>

        {/* Player Stats */}
        <div className="mb-12">
          <h2 className="mb-6 text-2xl font-bold text-white">Your Stats</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <div className="p-4 bg-gray-800 rounded-lg shadow-md">
              <div className="mb-2 text-4xl font-bold text-white">42</div>
              <div className="text-gray-400">Games Played</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg shadow-md">
              <div className="mb-2 text-4xl font-bold text-white">28</div>
              <div className="text-gray-400">Games Won</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg shadow-md">
              <div className="mb-2 text-4xl font-bold text-purple-500">66%</div>
              <div className="text-gray-400">Win Rate</div>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg shadow-md">
              <div className="mb-2 text-4xl font-bold text-white">5</div>
              <div className="text-gray-400">Best Streak</div>
            </div>
          </div>
          <div className="mt-4 text-right">
            <Link
              to="/stats"
              className="text-sm font-medium text-purple-500 hover:text-purple-400"
            >
              View detailed statistics →
            </Link>
          </div>
        </div>

        {/* Recent Games */}
        <div>
          <h2 className="mb-6 text-2xl font-bold text-white">Recent Games</h2>
          <div className="overflow-hidden bg-gray-800 rounded-lg shadow-md">
            <table className="min-w-full divide-y divide-gray-700">
              <thead className="bg-gray-700">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase"
                  >
                    Game Mode
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase"
                  >
                    Role
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase"
                  >
                    Result
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-xs font-medium tracking-wider text-left text-gray-300 uppercase"
                  >
                    XP
                  </th>
                </tr>
              </thead>
              <tbody className="bg-gray-800 divide-y divide-gray-700">
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    Today, 2:30 PM
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    Classic
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    Werewolf
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-400 whitespace-nowrap">
                    Victory
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    +120 XP
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    Today, 1:15 PM
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    Quick Play
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    Village Elder
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-red-400 whitespace-nowrap">
                    Defeat
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    +45 XP
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    Yesterday, 8:20 PM
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    Custom
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    Seer
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-green-400 whitespace-nowrap">
                    Victory
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300 whitespace-nowrap">
                    +150 XP
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-right">
            <Link
              to="/history"
              className="text-sm font-medium text-purple-500 hover:text-purple-400"
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
