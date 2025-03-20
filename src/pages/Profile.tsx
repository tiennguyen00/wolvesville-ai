import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Profile: React.FC = () => {
  const { user, updateUserProfile } = useAuth();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    username: user?.username || "",
    email: user?.email || "",
    avatar: user?.avatar || "",
    bio: user?.bio || "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Mock user statistics
  const userStats = {
    gamesPlayed: 42,
    gamesWon: 28,
    winRate: "66%",
    bestRole: "Seer",
    killCount: 15,
    savedCount: 8,
    bestStreak: 5,
  };

  // Mock achievements
  const achievements = [
    {
      id: 1,
      name: "First Win",
      description: "Win your first game",
      unlocked: true,
      date: "2023-01-15",
    },
    {
      id: 2,
      name: "Wolf Pack",
      description: "Win 5 games as a Werewolf",
      unlocked: true,
      date: "2023-02-03",
    },
    {
      id: 3,
      name: "Village Hero",
      description: "Save a villager from the werewolves",
      unlocked: true,
      date: "2023-02-10",
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
      unlocked: false,
    },
  ];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    try {
      // In a real app, this would send the data to the server
      // For now, we'll just simulate a success
      setTimeout(() => {
        // Mock function to update user profile
        if (updateUserProfile) {
          updateUserProfile(formData);
        }
        setSuccess("Profile updated successfully!");
        setIsEditing(false);
      }, 1000);
    } catch (err) {
      setError("Failed to update profile. Please try again.");
    }
  };

  const cancelEdit = () => {
    setFormData({
      username: user?.username || "",
      email: user?.email || "",
      avatar: user?.avatar || "",
      bio: user?.bio || "",
    });
    setIsEditing(false);
    setError(null);
  };

  if (!user) {
    navigate("/login");
    return null;
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
          <h1 className="text-3xl font-bold text-white">User Profile</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Details */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg p-6 pixel-container">
              {success && (
                <div className="bg-green-900/30 border border-green-600 text-green-200 px-4 py-3 rounded mb-6">
                  {success}
                </div>
              )}

              {error && (
                <div className="bg-red-900/30 border border-red-500 text-red-300 px-4 py-3 rounded mb-6">
                  {error}
                </div>
              )}

              {isEditing ? (
                <form onSubmit={handleSubmit}>
                  <h2 className="text-xl font-bold mb-4">Edit Profile</h2>

                  <div className="mb-4">
                    <label htmlFor="username" className="form-label">
                      Username
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleChange}
                      className="input-field"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="email" className="form-label">
                      Email
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="input-field"
                      required
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="avatar" className="form-label">
                      Avatar URL
                    </label>
                    <input
                      type="text"
                      id="avatar"
                      name="avatar"
                      value={formData.avatar}
                      onChange={handleChange}
                      className="input-field"
                    />
                  </div>

                  <div className="mb-6">
                    <label htmlFor="bio" className="form-label">
                      Bio
                    </label>
                    <textarea
                      id="bio"
                      name="bio"
                      value={formData.bio}
                      onChange={handleChange}
                      className="input-field min-h-[100px]"
                    />
                  </div>

                  <div className="flex justify-end space-x-4">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="btn-primary">
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center">
                      <div className="w-20 h-20 bg-purple-900 rounded-full flex items-center justify-center text-3xl font-bold mr-4">
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{user.username}</h2>
                        <p className="text-gray-400">{user.email}</p>
                        <div className="mt-2 flex items-center">
                          <span className="text-yellow-400 mr-2">★</span>
                          <span className="text-yellow-400 mr-2">★</span>
                          <span className="text-yellow-400 mr-2">★</span>
                          <span className="text-yellow-400 mr-2">★</span>
                          <span className="text-gray-600">★</span>
                          <span className="ml-2 text-sm text-gray-400">
                            4.2/5 (28 ratings)
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-secondary text-sm px-3 py-1"
                    >
                      Edit Profile
                    </button>
                  </div>

                  {user.bio && (
                    <div className="mb-6">
                      <h3 className="text-lg font-bold mb-2">About Me</h3>
                      <p className="text-gray-300">{user.bio}</p>
                    </div>
                  )}

                  <div className="border-t border-gray-700 pt-4">
                    <h3 className="text-lg font-bold mb-3">Account Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-400">Member Since</p>
                        <p>January 2023</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Status</p>
                        <p className="text-green-400">Active</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Gems</p>
                        <p className="text-purple-400">{user.gems || 0}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Coins</p>
                        <p className="text-yellow-400">
                          {user.gold_coins || 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Stats */}
          <div>
            <div className="bg-gray-800 rounded-lg p-6 pixel-container mb-6">
              <h2 className="text-xl font-bold mb-4">Game Statistics</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Games Played</span>
                  <span className="font-bold">{userStats.gamesPlayed}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Games Won</span>
                  <span className="font-bold">{userStats.gamesWon}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="font-bold text-purple-400">
                    {userStats.winRate}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Best Role</span>
                  <span className="font-bold">{userStats.bestRole}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Werewolf Kills</span>
                  <span className="font-bold text-red-400">
                    {userStats.killCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Villagers Saved</span>
                  <span className="font-bold text-green-400">
                    {userStats.savedCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Best Winning Streak</span>
                  <span className="font-bold">{userStats.bestStreak}</span>
                </div>
              </div>

              <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Statistics Overview</h3>
                  <Link
                    to="/stats"
                    className="pixel-button px-3 py-1 text-sm bg-purple-600 hover:bg-purple-500"
                  >
                    View Full Statistics
                  </Link>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Games Played</span>
                    <span className="font-bold">{userStats.gamesPlayed}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Games Won</span>
                    <span className="font-bold">{userStats.gamesWon}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Win Rate</span>
                    <span className="font-bold text-purple-400">
                      {userStats.winRate}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Best Role</span>
                    <span className="font-bold">{userStats.bestRole}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Werewolf Kills</span>
                    <span className="font-bold text-red-400">
                      {userStats.killCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Villagers Saved</span>
                    <span className="font-bold text-green-400">
                      {userStats.savedCount}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Best Winning Streak</span>
                    <span className="font-bold">{userStats.bestStreak}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-6 pixel-container">
              <h2 className="text-xl font-bold mb-4">Achievements</h2>
              <div className="space-y-4">
                {achievements.map((achievement) => (
                  <div
                    key={achievement.id}
                    className={`p-3 rounded-lg ${
                      achievement.unlocked
                        ? "bg-purple-900/20"
                        : "bg-gray-700/30 opacity-60"
                    }`}
                  >
                    <div className="flex items-center">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                          achievement.unlocked
                            ? "bg-purple-700 text-white"
                            : "bg-gray-600 text-gray-400"
                        }`}
                      >
                        {achievement.unlocked ? "✓" : "?"}
                      </div>
                      <div>
                        <h3 className="font-bold">
                          {achievement.name}
                          {!achievement.unlocked && " (Locked)"}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {achievement.description}
                        </p>
                        {achievement.unlocked && achievement.date && (
                          <p className="text-xs text-gray-500 mt-1">
                            Unlocked: {achievement.date}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
