import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import gameService, { GameSession, GamePlayer } from "../services/gameService";
import chatService, { ChatMessage } from "../services/chatService";

// Define the game result interface
interface GameResult {
  winning_team: string;
  winning_players: string[];
  losing_players: string[];
  mvp_player_id: string | null;
  duration_seconds: number;
  total_events: number;
  roles_distribution: {
    [key: string]: number;
  };
  xp_rewards: {
    [key: string]: number;
  };
  achievements_unlocked: {
    [key: string]: {
      achievement_id: string;
      achievement_name: string;
      description: string;
    }[];
  };
}

const GameSummary: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Game state
  const [game, setGame] = useState<GameSession | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  // Load game data
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const loadGameData = async () => {
      if (!gameId) return;

      try {
        setLoading(true);

        // Load game details
        const gameData = await gameService.getGameById(gameId);
        setGame(gameData);

        // Check if game is complete - if not, redirect to gameplay
        if (gameData.status !== "completed") {
          navigate(`/game/${gameId}`);
          return;
        }

        // Load players
        setPlayers(gameData.players || []);

        // Load game results
        const resultsData = await gameService.getGameResults(gameId);
        setResult(resultsData);

        // Load chat history
        const chatData = await chatService.getMessages(gameId);
        setChatHistory(chatData);

        setError(null);
      } catch (err) {
        console.error("Error loading game summary:", err);
        setError("Failed to load game summary. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadGameData();
  }, [gameId, isAuthenticated, navigate]);

  // Format time from seconds to min:sec
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Format role name for display
  const formatRoleName = (role: string): string => {
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Render error state
  if (error || !game || !result) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white bg-gray-900">
        <div className="max-w-md p-8 text-center bg-gray-800 rounded-lg pixel-container">
          <div className="mb-4 text-4xl">🐺</div>
          <h2 className="mb-2 text-xl font-bold pixel-text">Error</h2>
          <p className="mb-6 text-gray-400">
            {error || "Game summary not found"}
          </p>
          <Link
            to="/games"
            className="px-4 py-2 bg-purple-600 pixel-button hover:bg-purple-500"
          >
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  // Get current player
  const currentPlayer = players.find((p) => p.user_id === user?.user_id);

  // Check if current player won
  const didPlayerWin = currentPlayer
    ? result.winning_players.includes(currentPlayer.player_id)
    : false;

  // Check if current player was MVP
  const isPlayerMVP =
    currentPlayer && result.mvp_player_id === currentPlayer.player_id;

  return (
    <div className="min-h-screen pb-16 text-white bg-gray-900">
      {/* Header */}
      <header className="px-4 py-2 mb-8 bg-gray-800 shadow-md">
        <div className="container flex items-center justify-between mx-auto">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-purple-500 pixel-text">
              Wolvesville - Game Summary
            </h1>
          </div>
          <Link
            to="/games"
            className="px-3 py-1 bg-gray-700 pixel-button hover:bg-gray-600"
          >
            Back to Games
          </Link>
        </div>
      </header>

      {/* Game Result Banner */}
      <div
        className={`container mx-auto mb-10 text-center ${
          result.winning_team === "village"
            ? "bg-green-900/40"
            : result.winning_team === "werewolf"
            ? "bg-red-900/40"
            : "bg-purple-900/40"
        } p-6 rounded-lg pixel-container`}
      >
        <h2 className="mb-4 text-4xl font-bold pixel-text">
          {result.winning_team === "village"
            ? "VILLAGE VICTORY"
            : result.winning_team === "werewolf"
            ? "WEREWOLVES VICTORY"
            : "NEUTRAL VICTORY"}
        </h2>

        <div className="mb-4 text-6xl">
          {result.winning_team === "village"
            ? "🏆"
            : result.winning_team === "werewolf"
            ? "🐺"
            : "🧙"}
        </div>

        <div className="mb-2 text-xl pixel-text">
          {didPlayerWin
            ? "Congratulations! Your team won!"
            : "Better luck next time. Your team lost."}
        </div>

        {isPlayerMVP && (
          <div className="inline-block px-4 py-2 mt-4 border border-yellow-500 rounded-lg bg-yellow-900/50 pixel-container">
            <span className="text-xl font-bold text-yellow-300 pixel-text">
              ✨ MVP ✨
            </span>
          </div>
        )}

        <div className="flex justify-center mt-6 space-x-8">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-400 pixel-text">
              Game Duration
            </div>
            <div className="text-xl">{formatTime(result.duration_seconds)}</div>
          </div>

          <div className="text-center">
            <div className="text-lg font-bold text-gray-400 pixel-text">
              Game Events
            </div>
            <div className="text-xl">{result.total_events}</div>
          </div>

          {currentPlayer && (
            <div className="text-center">
              <div className="text-lg font-bold text-gray-400 pixel-text">
                XP Earned
              </div>
              <div className="text-xl">
                +{result.xp_rewards[currentPlayer.player_id] || 0}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="container grid grid-cols-1 gap-8 px-4 mx-auto md:grid-cols-2">
        {/* Left Column */}
        <div>
          {/* Players Section */}
          <div className="p-6 mb-8 bg-gray-800 rounded-lg pixel-container">
            <h3 className="mb-4 text-xl font-bold pixel-text">Players</h3>

            <div className="mb-6">
              <h4 className="mb-2 text-lg font-bold text-green-400 pixel-text">
                Winners ({result.winning_players.length})
              </h4>
              <div className="space-y-2">
                {players
                  .filter((player) =>
                    result.winning_players.includes(player.player_id)
                  )
                  .map((player) => (
                    <div
                      key={player.player_id}
                      className="flex items-center p-2 rounded-lg bg-gray-700/70"
                    >
                      <div className="flex items-center justify-center w-8 h-8 text-sm font-bold bg-green-900 rounded-full">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 ml-2">
                        <div className="flex items-center">
                          <div className="text-sm font-bold pixel-text">
                            {player.username}
                          </div>
                          {player.player_id === result.mvp_player_id && (
                            <span className="ml-2 text-xs text-yellow-300">
                              MVP
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatRoleName(player.role || "Unknown")}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-lg font-bold text-red-400 pixel-text">
                Losers ({result.losing_players.length})
              </h4>
              <div className="space-y-2">
                {players
                  .filter((player) =>
                    result.losing_players.includes(player.player_id)
                  )
                  .map((player) => (
                    <div
                      key={player.player_id}
                      className="flex items-center p-2 rounded-lg bg-gray-700/70"
                    >
                      <div className="flex items-center justify-center w-8 h-8 text-sm font-bold bg-red-900 rounded-full">
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 ml-2">
                        <div className="text-sm font-bold pixel-text">
                          {player.username}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatRoleName(player.role || "Unknown")}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Role Distribution */}
          <div className="p-6 mb-8 bg-gray-800 rounded-lg pixel-container">
            <h3 className="mb-4 text-xl font-bold pixel-text">
              Roles Distribution
            </h3>
            <div className="space-y-2">
              {Object.entries(result.roles_distribution).map(
                ([role, count]) => (
                  <div key={role} className="flex items-center justify-between">
                    <div className="text-gray-300 pixel-text">
                      {formatRoleName(role)}
                    </div>
                    <div className="px-2 py-1 text-sm bg-gray-700 rounded-full">
                      {count}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Achievements Section */}
          {currentPlayer &&
            result.achievements_unlocked[currentPlayer.player_id]?.length >
              0 && (
              <div className="p-6 mb-8 bg-gray-800 rounded-lg pixel-container">
                <h3 className="mb-4 text-xl font-bold pixel-text">
                  Achievements Unlocked
                </h3>
                <div className="space-y-4">
                  {result.achievements_unlocked[currentPlayer.player_id].map(
                    (achievement) => (
                      <div
                        key={achievement.achievement_id}
                        className="p-3 border rounded-lg bg-yellow-900/30 border-yellow-600/50 pixel-container"
                      >
                        <div className="flex items-center">
                          <span className="mr-2 text-xl">🏆</span>
                          <div>
                            <h4 className="font-bold text-yellow-300 pixel-text">
                              {achievement.achievement_name}
                            </h4>
                            <p className="text-sm text-gray-300">
                              {achievement.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

          {/* Game Stats */}
          <div className="p-6 mb-8 bg-gray-800 rounded-lg pixel-container">
            <h3 className="mb-4 text-xl font-bold pixel-text">
              Game Statistics
            </h3>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 pixel-text">Game ID:</span>
                <span className="font-mono text-sm">{gameId}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 pixel-text">Game Name:</span>
                <span>{game.game_name}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 pixel-text">Created By:</span>
                <span>{game.created_by_username}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 pixel-text">Total Players:</span>
                <span>{players.length}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400 pixel-text">Winning Team:</span>
                <span
                  className={`${
                    result.winning_team === "village"
                      ? "text-green-400"
                      : result.winning_team === "werewolf"
                      ? "text-red-400"
                      : "text-purple-400"
                  } font-bold`}
                >
                  {result.winning_team.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          {/* Chat History */}
          <div className="p-6 bg-gray-800 rounded-lg pixel-container">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold pixel-text">Chat History</h3>
              <button
                className="px-3 py-1 bg-gray-700 pixel-button hover:bg-gray-600"
                onClick={() => setShowChat(!showChat)}
              >
                {showChat ? "Hide Chat" : "Show Chat"}
              </button>
            </div>

            {showChat && (
              <div className="space-y-2 overflow-y-auto max-h-96">
                {chatHistory.length > 0 ? (
                  chatHistory.map((message) => (
                    <div
                      key={message.message_id}
                      className="p-2 rounded-lg bg-gray-700/50"
                    >
                      <div className="flex items-start">
                        <div className="flex-shrink-0 mr-2">
                          <div className="flex items-center justify-center w-6 h-6 text-xs font-bold bg-gray-600 rounded-full">
                            {message.sender_name?.charAt(0).toUpperCase()}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center">
                            <span className="mr-2 text-sm font-bold text-purple-300">
                              {message.sender_name}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({message.message_type})
                            </span>
                            <span className="ml-1 text-xs text-gray-400">
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-200">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-gray-400">
                    No chat messages in this game
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameSummary;
