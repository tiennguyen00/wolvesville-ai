import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import gameService, {
  Role,
  GameStatusType,
  GamePhaseType,
} from "../services/gameService";

// Role icons
const roleIcons: Record<string, string> = {
  Villager: "🧑",
  Werewolf: "🐺",
  Seer: "👁️",
  Doctor: "💉",
  Hunter: "🏹",
  Witch: "🧪",
  Guardian: "🛡️",
  Detective: "🔍",
  Mayor: "👑",
  Cupid: "💘",
};

const CreateGame: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    game_mode: "classic",
    max_players: 12,
    game_password: "",
    day_duration: 120,
    night_duration: 60,
    discussion_duration: 60,
    voting_duration: 30,
    is_private: false,
  });

  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchRoles = async () => {
      try {
        setLoading(true);
        const roles = await gameService.getRoles();
        setAvailableRoles(roles);

        // Set default roles
        const defaultRoles = roles
          .filter((role) =>
            ["Villager", "Werewolf", "Seer"].includes(role.role_name)
          )
          .map((role) => role.role_id);
        setSelectedRoles(defaultRoles);

        setError(null);
      } catch (err) {
        console.error("Error fetching roles:", err);
        setError("Failed to load game roles. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchRoles();
    } else {
      navigate("/login");
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRoles.length < 3) {
      setError("Please select at least 3 roles for the game");
      return;
    }

    setIsSubmitting(true);
    try {
      const gameData = {
        game_mode: formData.game_mode,
        host_id: user?.user_id,
        host_username: user?.username,
        status: "lobby" as GameStatusType,
        current_phase: "lobby" as GamePhaseType,
        max_players: formData.max_players,
        game_password: formData.game_password || undefined,
        password_protected: !!formData.game_password,
        settings: {
          roles: selectedRoles,
          day_duration: formData.day_duration,
          night_duration: formData.night_duration,
          discussion_duration: formData.discussion_duration,
          voting_duration: formData.voting_duration,
        },
      };

      const newGame = await gameService.createGame(gameData);
      navigate(`/game/lobby/${newGame.game_id}`);
    } catch (err) {
      console.error("Error creating game:", err);
      setError("Failed to create game. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target as HTMLInputElement;

    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else if (type === "number") {
      setFormData((prev) => ({ ...prev, [name]: parseInt(value, 10) }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoles((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 text-white bg-gray-900">
      <div className="container px-6 py-8 mx-auto">
        <div className="flex items-center mb-8">
          <Link
            to="/games"
            className="mr-4 text-purple-400 hover:text-purple-300"
          >
            ← Back to Games
          </Link>
          <h1 className="text-3xl font-bold text-white pixel-text">
            Create Game
          </h1>
        </div>

        {error && (
          <div className="px-4 py-3 mb-6 text-red-300 border border-red-500 rounded bg-red-900/40">
            {error}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="p-6 bg-gray-800 rounded-lg pixel-container"
        >
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {/* Game Settings Section */}
            <div>
              <h2 className="mb-6 text-xl font-bold pixel-text">
                Game Settings
              </h2>

              <div className="mb-4">
                <label htmlFor="game_mode" className="form-label pixel-text">
                  Game Mode
                </label>
                <select
                  id="game_mode"
                  name="game_mode"
                  value={formData.game_mode}
                  onChange={handleChange}
                  className="input-field"
                >
                  <option value="classic">Classic</option>
                  <option value="quick">Quick Play</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="max_players" className="form-label pixel-text">
                  Max Players
                </label>
                <input
                  type="number"
                  id="max_players"
                  name="max_players"
                  min="5"
                  max="16"
                  value={formData.max_players}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="game_password"
                  className="form-label pixel-text"
                >
                  Password (Optional)
                </label>
                <input
                  type="password"
                  id="game_password"
                  name="game_password"
                  value={formData.game_password}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="Leave empty for public game"
                />
              </div>

              <div className="flex items-center mb-4">
                <input
                  type="checkbox"
                  id="is_private"
                  name="is_private"
                  checked={formData.is_private}
                  onChange={handleChange}
                  className="mr-2 pixel-checkbox"
                />
                <label
                  htmlFor="is_private"
                  className="mb-0 cursor-pointer form-label"
                >
                  Private Game (Only invited players can join)
                </label>
              </div>
            </div>

            {/* Timer Settings Section */}
            <div>
              <h2 className="mb-6 text-xl font-bold pixel-text">
                Timer Settings
              </h2>

              <div className="mb-4">
                <label htmlFor="day_duration" className="form-label pixel-text">
                  Day Duration (seconds)
                </label>
                <input
                  type="number"
                  id="day_duration"
                  name="day_duration"
                  min="30"
                  max="300"
                  value={formData.day_duration}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="night_duration"
                  className="form-label pixel-text"
                >
                  Night Duration (seconds)
                </label>
                <input
                  type="number"
                  id="night_duration"
                  name="night_duration"
                  min="30"
                  max="180"
                  value={formData.night_duration}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="discussion_duration"
                  className="form-label pixel-text"
                >
                  Discussion Duration (seconds)
                </label>
                <input
                  type="number"
                  id="discussion_duration"
                  name="discussion_duration"
                  min="30"
                  max="180"
                  value={formData.discussion_duration}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="voting_duration"
                  className="form-label pixel-text"
                >
                  Voting Duration (seconds)
                </label>
                <input
                  type="number"
                  id="voting_duration"
                  name="voting_duration"
                  min="15"
                  max="120"
                  value={formData.voting_duration}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Role Selection Section */}
          <div className="mt-8">
            <h2 className="mb-6 text-xl font-bold pixel-text">Select Roles</h2>
            <p className="mb-4 text-gray-400">
              Choose at least 3 roles for your game. The number of roles should
              be equal to or greater than the max number of players.
            </p>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {availableRoles.map((role) => (
                <div
                  key={role.role_id}
                  onClick={() => toggleRole(role.role_id)}
                  className={`p-4 rounded-lg cursor-pointer transition-colors ${
                    selectedRoles.includes(role.role_id)
                      ? "bg-purple-900 border border-purple-500"
                      : "bg-gray-700 hover:bg-gray-600"
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <div className="flex items-center justify-center w-8 h-8 mr-2 text-2xl">
                      {roleIcons[role.role_name] || "🎭"}
                    </div>
                    <div className="font-bold">{role.role_name}</div>
                  </div>
                  <div className="text-xs text-gray-400">
                    {role.faction === "Village" && (
                      <span className="text-blue-400">Village Team</span>
                    )}
                    {role.faction === "Werewolves" && (
                      <span className="text-red-400">Werewolf Team</span>
                    )}
                    {role.faction === "neutral" && (
                      <span className="text-yellow-400">Neutral</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {selectedRoles.length < 3 && (
              <div className="p-4 mt-4 text-yellow-200 border border-yellow-600 rounded-lg bg-yellow-900/30">
                Please select at least 3 roles.
              </div>
            )}

            {selectedRoles.length > 0 &&
              selectedRoles.length < formData.max_players && (
                <div className="p-4 mt-4 text-yellow-200 border border-yellow-600 rounded-lg bg-yellow-900/30">
                  Warning: You've selected fewer roles ({selectedRoles.length})
                  than max players ({formData.max_players}). Some roles will be
                  duplicated.
                </div>
              )}
          </div>

          {/* Submit Section */}
          <div className="flex justify-end mt-8">
            <Link to="/games" className="mr-4 btn-secondary pixel-button">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || selectedRoles.length < 3}
              className={`btn-primary pixel-button ${
                isSubmitting ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? "Creating..." : "Create Game"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGame;
