import React, { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import gameService, {
  GameSession,
  GamePlayer,
  GameEvent,
  GameState,
} from "../services/gameService";
import chatService, { ChatMessage } from "../services/chatService";

const GamePlay: React.FC = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Game state
  const [game, setGame] = useState<GameSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<GamePlayer | null>(null);

  // UI state
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  const [roleDescription, setRoleDescription] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<
    () => Promise<void>
  >(() => Promise.resolve());
  const [confirmationMessage, setConfirmationMessage] = useState("");

  // Fetch game data
  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    const fetchGameData = async () => {
      if (!gameId) return;

      try {
        setLoading(true);

        // Load game details
        const gameData = await gameService.getGameById(gameId);
        setGame(gameData);

        // Check if game is complete - redirect to summary if yes
        if (gameData.status === "completed") {
          navigate(`/game/summary/${gameId}`);
          return;
        }

        // Load players
        setPlayers(gameData.players || []);

        // Find current player
        const player =
          gameData.players?.find((p) => p.user_id === user?.user_id) || null;
        setCurrentPlayer(player);

        // Load game state
        const stateData = await gameService.getGameState(gameId);
        setGameState(stateData);

        // Load game events
        const eventsData = await gameService.getGameEvents(gameId);
        setEvents(eventsData);

        // Load chat messages
        const messagesData = await chatService.getMessages(gameId);
        setMessages(messagesData);

        // Get role description
        if (player?.role) {
          try {
            const roleInfo = await gameService.getRoleInfo(player.role);
            setRoleDescription(roleInfo.description);
          } catch (err) {
            console.error("Error loading role info:", err);
            setRoleDescription("Information about your role is not available.");
          }
        }

        setError(null);
      } catch (err) {
        console.error("Error fetching game data:", err);
        setError("Failed to load game data. The game may no longer exist.");
      } finally {
        setLoading(false);
      }
    };

    fetchGameData();

    // Set up polling for game updates (every 3 seconds)
    const interval = setInterval(fetchGameData, 3000);
    return () => clearInterval(interval);
  }, [gameId, isAuthenticated, navigate, user?.user_id]);

  // Scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Clear action feedback after 3 seconds
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => {
        setActionFeedback(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  // Handle sending a chat message
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || !gameId) return;

    try {
      await chatService.sendMessage(gameId, {
        message_type: gameState?.phase === "day" ? "public" : "team",
        content: messageInput,
      });

      setMessageInput("");

      // In a real app, new messages would be received via WebSocket
      // For demo, we'll just fetch messages again
      const messagesData = await chatService.getMessages(gameId);
      setMessages(messagesData);
    } catch (err) {
      console.error("Error sending message:", err);
      setActionFeedback("Failed to send message");
    }
  };

  // Handle voting for a player
  const handleVote = (targetId: string) => {
    // Store the actual vote function
    const performVote = async () => {
      if (!gameId) return;

      try {
        await gameService.votePlayer(gameId, targetId);
        setActionFeedback("Vote submitted successfully");
        setSelectedPlayer(targetId);

        // Refresh game state
        const stateData = await gameService.getGameState(gameId);
        setGameState(stateData);
      } catch (err) {
        console.error("Error submitting vote:", err);
        setActionFeedback("Failed to submit vote");
      }
    };

    // Check if this is during day phase
    if (gameState?.phase === "day") {
      // Get player name for confirmation
      const targetPlayer = players.find((p) => p.player_id === targetId);

      // Set up confirmation
      setConfirmationMessage(
        `Are you sure you want to vote for ${targetPlayer?.username}?`
      );
      setConfirmationAction(() => performVote);
      setShowConfirmation(true);
    } else {
      setActionFeedback("Voting is only allowed during the day phase");
    }
  };

  // Handle using abilities
  const handleUseAbility = (targetId: string) => {
    if (!currentPlayer?.role || !gameId) return;

    // Store the actual ability function
    const performAbility = async () => {
      try {
        await gameService.useAbility(
          gameId,
          targetId,
          currentPlayer.role || ""
        );
        setActionFeedback("Ability used successfully");
        setSelectedPlayer(targetId);

        // Refresh game state
        const stateData = await gameService.getGameState(gameId);
        setGameState(stateData);
      } catch (err) {
        console.error("Error using ability:", err);
        setActionFeedback("Failed to use ability");
      }
    };

    // Check if this is during night phase
    if (gameState?.phase === "night") {
      // Get player name for confirmation
      const targetPlayer = players.find((p) => p.player_id === targetId);

      // Set up confirmation
      setConfirmationMessage(
        `Use your ${currentPlayer.role} ability on ${targetPlayer?.username}?`
      );
      setConfirmationAction(() => performAbility);
      setShowConfirmation(true);
    } else {
      setActionFeedback(
        "Special abilities can only be used during the night phase"
      );
    }
  };

  // Handle skipping ability use
  const handleSkipAbility = async () => {
    if (!gameId) return;

    try {
      await gameService.skipAbility(gameId);
      setActionFeedback("You decided to skip using your ability tonight");

      // Refresh game state
      const stateData = await gameService.getGameState(gameId);
      setGameState(stateData);
    } catch (err) {
      console.error("Error skipping ability:", err);
      setActionFeedback("Failed to skip ability");
    }
  };

  // Handle ready for next phase
  const handleReady = async () => {
    if (!gameId) return;

    try {
      await gameService.readyForNextPhase(gameId);
      setActionFeedback("Marked as ready for next phase");

      // Refresh game state
      const stateData = await gameService.getGameState(gameId);
      setGameState(stateData);
    } catch (err) {
      console.error("Error marking as ready:", err);
      setActionFeedback("Failed to mark as ready");
    }
  };

  // Handle leaving the game
  const handleLeaveGame = async () => {
    if (!gameId) return;

    try {
      await gameService.leaveGame(gameId);
      navigate("/games");
    } catch (err) {
      console.error("Error leaving game:", err);
      setActionFeedback("Failed to leave the game");
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  // Render error state
  if (error || !game || !gameState) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="bg-gray-800 rounded-lg p-8 max-w-md text-center pixel-container">
          <div className="text-4xl mb-4">🐺</div>
          <h2 className="text-xl font-bold mb-2 pixel-text">Error</h2>
          <p className="text-gray-400 mb-6">{error || "Game not found"}</p>
          <Link
            to="/games"
            className="pixel-button bg-purple-600 hover:bg-purple-500 px-4 py-2"
          >
            Back to Games
          </Link>
        </div>
      </div>
    );
  }

  // Get the live/dead status of the current player
  const isPlayerAlive = currentPlayer?.is_alive ?? false;

  // Check if player can use ability this phase
  const canUseAbility =
    gameState.phase === "night" &&
    isPlayerAlive &&
    currentPlayer?.role &&
    !gameState.role_actions[currentPlayer.player_id || ""];

  // Check if player can vote this phase
  const canVote = gameState.phase === "day" && isPlayerAlive;

  return (
    <div className="min-h-screen bg-gray-900 text-white pb-12">
      {/* Game UI Container */}
      <div className="h-screen flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 shadow-md py-2 px-4 pixel-container">
          <div className="container mx-auto flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-purple-500 pixel-text">
                Wolvesville
              </h1>
              <div className="ml-6 flex items-center space-x-2">
                <div className="bg-gray-700 px-3 py-1 rounded-lg pixel-border">
                  <span className="text-gray-400 mr-1">Phase:</span>
                  <span
                    className={`font-bold ${
                      gameState.phase === "day"
                        ? "text-yellow-400"
                        : "text-blue-400"
                    } pixel-text`}
                  >
                    {gameState.phase.toUpperCase()}
                  </span>
                </div>
                <div className="bg-gray-700 px-3 py-1 rounded-lg pixel-border">
                  <span className="text-gray-400 mr-1">Day:</span>
                  <span className="font-bold text-white pixel-text">
                    {gameState.day_number}
                  </span>
                </div>
                <div className="bg-gray-700 px-3 py-1 rounded-lg pixel-border">
                  <span className="text-gray-400 mr-1">Time:</span>
                  <span className="font-bold text-white pixel-text">
                    {Math.floor(gameState.time_remaining / 60)}:
                    {(gameState.time_remaining % 60)
                      .toString()
                      .padStart(2, "0")}
                  </span>
                </div>
                <div
                  className="bg-gray-700 px-3 py-1 rounded-lg pixel-border cursor-help"
                  onMouseEnter={() => setShowRoleInfo(true)}
                  onMouseLeave={() => setShowRoleInfo(false)}
                >
                  <span className="text-gray-400 mr-1">Role:</span>
                  <span
                    className={`font-bold ${
                      currentPlayer?.team === "village"
                        ? "text-green-400"
                        : currentPlayer?.team === "werewolf"
                        ? "text-red-400"
                        : "text-purple-400"
                    } pixel-text`}
                  >
                    {currentPlayer?.role || "Unknown"}
                  </span>

                  {/* Role info tooltip */}
                  {showRoleInfo && (
                    <div className="absolute mt-2 bg-gray-800 p-3 rounded-lg shadow-lg z-50 max-w-xs pixel-border border border-gray-600">
                      <p className="text-sm">{roleDescription}</p>
                    </div>
                  )}
                </div>
                {!isPlayerAlive && (
                  <div className="bg-red-900/50 px-3 py-1 rounded-lg pixel-border">
                    <span className="font-bold text-red-400 pixel-text">
                      ELIMINATED
                    </span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setConfirmationMessage(
                  "Are you sure you want to leave this game?"
                );
                setConfirmationAction(() => handleLeaveGame);
                setShowConfirmation(true);
              }}
              className="pixel-button bg-gray-700 hover:bg-gray-600 px-3 py-1"
            >
              Leave Game
            </button>
          </div>
        </header>

        {/* Action feedback toast */}
        {actionFeedback && (
          <div className="fixed top-4 right-4 bg-gray-800 border border-purple-500 rounded-lg p-3 z-50 shadow-lg pixel-container">
            <p className="text-white pixel-text">{actionFeedback}</p>
          </div>
        )}

        {/* Confirmation modal */}
        {showConfirmation && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-gray-800 p-6 rounded-lg border border-purple-500 max-w-md pixel-container">
              <h3 className="text-lg font-bold mb-4 pixel-text">
                Confirm Action
              </h3>
              <p className="mb-6 text-gray-300">{confirmationMessage}</p>
              <div className="flex justify-end space-x-3">
                <button
                  className="pixel-button bg-gray-700 hover:bg-gray-600 px-3 py-1"
                  onClick={() => setShowConfirmation(false)}
                >
                  Cancel
                </button>
                <button
                  className="pixel-button bg-purple-600 hover:bg-purple-500 px-3 py-1"
                  onClick={() => {
                    confirmationAction();
                    setShowConfirmation(false);
                  }}
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Game Content */}
        <div className="flex-1 container mx-auto px-4 py-6 overflow-hidden flex">
          {/* Players Panel */}
          <div className="w-1/4 bg-gray-800 rounded-lg overflow-auto mr-4 pixel-container">
            <div className="p-4">
              <h2 className="text-lg font-bold mb-3 pixel-text">Players</h2>
              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.player_id}
                    onClick={() => {
                      if (player.is_alive && player.user_id !== user?.user_id) {
                        setSelectedPlayer(player.player_id);
                      }
                    }}
                    className={`p-2 rounded-lg flex items-center ${
                      player.is_alive
                        ? "bg-gray-700 hover:bg-gray-600 cursor-pointer"
                        : "bg-gray-800 opacity-60"
                    } ${
                      player.user_id === user?.user_id
                        ? "border border-purple-500"
                        : player.player_id === selectedPlayer
                        ? "border border-yellow-500"
                        : ""
                    } pixel-border transition-all`}
                  >
                    <div className="w-8 h-8 bg-purple-900 rounded-full flex items-center justify-center text-sm font-bold">
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-2 flex-1">
                      <div className="font-bold text-sm truncate pixel-text">
                        {player.username}
                        {!player.is_alive && (
                          <span className="ml-2 text-red-500">☠️</span>
                        )}
                      </div>
                      {gameState.phase === "day" &&
                        gameState.votes[player.player_id] && (
                          <div className="text-xs text-gray-400">
                            Votes: {gameState.votes[player.player_id].length}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Game Area */}
          <div className="flex-1 flex flex-col h-full">
            {/* Game View */}
            <div className="flex-1 bg-gray-800 rounded-lg mb-4 overflow-hidden pixel-container relative">
              <div
                className={`absolute inset-0 ${
                  gameState.phase === "day"
                    ? "bg-gradient-to-b from-blue-900/30 to-purple-900/30"
                    : "bg-gradient-to-b from-gray-900/50 to-indigo-900/30"
                }`}
              ></div>

              <div className="h-full p-6 flex flex-col items-center justify-center relative z-10">
                {/* Phase header */}
                <h2 className="text-4xl font-bold mb-6 pixel-text">
                  {gameState.phase === "day" ? "DAY PHASE" : "NIGHT PHASE"}
                </h2>
                <div className="text-8xl mb-8">
                  {gameState.phase === "day" ? "☀️" : "🌙"}
                </div>

                {/* Timer and phase info */}
                <div className="mb-8 text-center">
                  <div className="text-xl mb-2 pixel-text">
                    Time remaining: {Math.floor(gameState.time_remaining / 60)}:
                    {(gameState.time_remaining % 60)
                      .toString()
                      .padStart(2, "0")}
                  </div>
                  <p className="text-gray-300 mb-4 pixel-text">
                    {gameState.phase === "day"
                      ? "Discuss with other players and vote to eliminate a suspected werewolf."
                      : "Use your special abilities under the cover of darkness."}
                  </p>
                </div>

                {/* Action area */}
                <div className="bg-gray-700/80 p-4 rounded-lg pixel-container max-w-md w-full">
                  {/* Role info */}
                  <div className="mb-4 text-center">
                    <p
                      className={`text-xl font-bold pixel-text ${
                        currentPlayer?.team === "village"
                          ? "text-green-400"
                          : currentPlayer?.team === "werewolf"
                          ? "text-red-400"
                          : "text-purple-400"
                      }`}
                    >
                      {isPlayerAlive
                        ? `You are a ${currentPlayer?.role}`
                        : "You have been eliminated"}
                    </p>
                  </div>

                  {/* Actions */}
                  {isPlayerAlive && (
                    <div className="space-y-4">
                      {/* Day phase voting */}
                      {gameState.phase === "day" && (
                        <div>
                          {selectedPlayer ? (
                            <div className="text-center">
                              <p className="mb-2 pixel-text">
                                Selected:{" "}
                                {
                                  players.find(
                                    (p) => p.player_id === selectedPlayer
                                  )?.username
                                }
                              </p>
                              <div className="flex justify-center space-x-3">
                                <button
                                  onClick={() => setSelectedPlayer(null)}
                                  className="pixel-button bg-gray-600 hover:bg-gray-500 px-3 py-1"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleVote(selectedPlayer)}
                                  className="pixel-button bg-yellow-600 hover:bg-yellow-500 px-3 py-1"
                                  disabled={!canVote}
                                >
                                  Vote Out
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-center pixel-text">
                              Select a player to vote out
                            </p>
                          )}
                        </div>
                      )}

                      {/* Night phase abilities */}
                      {gameState.phase === "night" && (
                        <div>
                          {gameState.role_actions[
                            currentPlayer?.player_id || ""
                          ] ? (
                            <div className="text-center">
                              <p className="text-green-400 pixel-text">
                                You've already used your ability for tonight
                              </p>
                            </div>
                          ) : selectedPlayer ? (
                            <div className="text-center">
                              <p className="mb-2 pixel-text">
                                Target:{" "}
                                {
                                  players.find(
                                    (p) => p.player_id === selectedPlayer
                                  )?.username
                                }
                              </p>
                              <div className="flex justify-center space-x-3">
                                <button
                                  onClick={() => setSelectedPlayer(null)}
                                  className="pixel-button bg-gray-600 hover:bg-gray-500 px-3 py-1"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() =>
                                    handleUseAbility(selectedPlayer)
                                  }
                                  className="pixel-button bg-blue-600 hover:bg-blue-500 px-3 py-1"
                                  disabled={!canUseAbility}
                                >
                                  Use Ability
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="mb-2 pixel-text">
                                {canUseAbility
                                  ? "Select a player to use your ability on"
                                  : "You don't have an ability to use tonight"}
                              </p>
                              {canUseAbility && (
                                <button
                                  onClick={handleSkipAbility}
                                  className="pixel-button bg-gray-600 hover:bg-gray-500 px-3 py-1"
                                >
                                  Skip Using Ability
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Ready button */}
                      <div className="flex justify-center mt-4">
                        <button
                          onClick={handleReady}
                          className={`pixel-button ${
                            gameState.role_actions[
                              currentPlayer?.player_id || ""
                            ] || !canUseAbility
                              ? "bg-green-600 hover:bg-green-500"
                              : "bg-gray-600 hover:bg-gray-500"
                          } px-4 py-2`}
                        >
                          Ready for Next Phase
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Spectator mode for eliminated players */}
                  {!isPlayerAlive && (
                    <div className="text-center">
                      <p className="text-gray-300 pixel-text">
                        You are now spectating the game. You can still chat with
                        other eliminated players.
                      </p>
                    </div>
                  )}
                </div>

                {/* Event log */}
                <div className="mt-8 max-w-md w-full">
                  <h3 className="text-lg font-bold mb-2 pixel-text">
                    Event Log
                  </h3>
                  <div className="bg-gray-700/80 p-3 rounded-lg max-h-40 overflow-y-auto pixel-container">
                    {events
                      .filter(
                        (e) =>
                          e.is_public ||
                          !isPlayerAlive ||
                          e.target_ids?.includes(currentPlayer?.player_id || "")
                      )
                      .slice(-5)
                      .map((event, index) => (
                        <div key={index} className="mb-1 last:mb-0 text-sm">
                          <span className="text-gray-400">
                            [Day {event.day_number}]
                          </span>{" "}
                          <span className="text-gray-200">
                            {event.event_data.message || "An event occurred"}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Chat Area */}
            <div className="h-1/3 bg-gray-800 rounded-lg overflow-hidden pixel-container">
              <div className="h-full flex flex-col">
                <div className="p-2 bg-gray-700 flex justify-between items-center">
                  <div className="font-bold pixel-text">
                    {gameState.phase === "day"
                      ? "Public Chat"
                      : isPlayerAlive
                      ? currentPlayer?.team === "werewolf"
                        ? "Werewolf Chat"
                        : "You cannot chat at night"
                      : "Spectator Chat"}
                  </div>
                  <div className="text-xs text-gray-400 pixel-text">
                    {gameState.phase === "day"
                      ? "Everyone can see messages"
                      : isPlayerAlive
                      ? currentPlayer?.team === "werewolf"
                        ? "Only werewolves can see"
                        : ""
                      : "Only other spectators can see"}
                  </div>
                </div>

                {/* Chat messages */}
                <div
                  ref={chatContainerRef}
                  className="flex-1 overflow-y-auto p-2 space-y-2"
                >
                  {messages.map((message) => {
                    // Only show messages that the player should see based on game state
                    const shouldShowMessage =
                      message.message_type === "public" ||
                      (message.message_type === "team" &&
                        currentPlayer?.team === message.sender_team) ||
                      (message.message_type === "dead" && !isPlayerAlive);

                    if (!shouldShowMessage) return null;

                    return (
                      <div
                        key={message.message_id}
                        className={`rounded-lg p-2 pixel-border ${
                          message.sender_id === user?.user_id
                            ? "bg-purple-900/50 ml-8"
                            : "bg-gray-700/50 mr-8"
                        }`}
                      >
                        <div className="flex items-start">
                          <div className="flex-shrink-0 mr-2">
                            <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs font-bold">
                              {message.sender_name?.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center">
                              <span className="font-bold text-sm mr-2 text-purple-300">
                                {message.sender_name}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(
                                  message.timestamp
                                ).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Chat input - only show when player can chat */}
                {(gameState.phase === "day" ||
                  (!isPlayerAlive && gameState.phase === "night") ||
                  (isPlayerAlive &&
                    currentPlayer?.team === "werewolf" &&
                    gameState.phase === "night")) && (
                  <form
                    onSubmit={sendMessage}
                    className="p-2 border-t border-gray-700 flex"
                  >
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 bg-gray-700 rounded-l-lg px-3 py-2 text-gray-200 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-purple-600 hover:bg-purple-500 rounded-r-lg px-4 py-2 pixel-button"
                    >
                      Send
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePlay;
