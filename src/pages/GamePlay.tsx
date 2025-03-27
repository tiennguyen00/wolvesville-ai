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
import io from "socket.io-client";

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

  // Add new state for phase transition
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [phaseTimer, setPhaseTimer] = useState<number | null>(null);

  // Check if player was kicked
  const checkIfKicked = (currentPlayers: GamePlayer[]) => {
    if (!user) return false;

    const isStillInGame = currentPlayers.some(
      (player) => player.user_id === user.user_id
    );

    if (!isStillInGame) {
      console.log("Player was kicked from the game");
      navigate("/games", {
        state: { message: "You have been removed from the game" },
      });
      return true;
    }

    return false;
  };

  // Add WebSocket connection
  useEffect(() => {
    if (!gameId) return;

    const socket = io(`/game/${gameId}`);

    socket.on("connect", () => {
      console.log("Connected to game socket");
    });

    socket.on("phase_changed", (data) => {
      setGameState((prev) => ({
        ...prev!,
        phase: data.phase,
        time_remaining: data.phase === "night" ? 120 : 180,
      }));

      // Update players
      setPlayers(data.players);

      // Handle killed/lynched player
      if (data.killed_player) {
        setActionFeedback(
          `${data.killed_player.player.username} was killed by werewolves!`
        );
      } else if (data.lynched_player) {
        setActionFeedback(
          `${data.lynched_player.player.username} was lynched by the village!`
        );
      }

      // Reset phase timer
      if (phaseTimer) {
        clearInterval(phaseTimer);
      }
      startPhaseTimer(data.phase === "night" ? 120 : 180);
    });

    socket.on("game_ended", (data) => {
      navigate(`/game/summary/${gameId}`, {
        state: { winner: data.winner_faction },
      });
    });

    socket.on("error", (error) => {
      setActionFeedback(error.message);
    });

    return () => {
      socket.disconnect();
      if (phaseTimer) {
        clearInterval(phaseTimer);
      }
    };
  }, [gameId, navigate]);

  // Add phase timer
  const startPhaseTimer = (duration: number) => {
    setPhaseTimer(
      window.setInterval(() => {
        setGameState((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            time_remaining: Math.max(0, prev.time_remaining - 1),
          };
        });
      }, 1000)
    );
  };

  // Add phase transition handler
  const handlePhaseTransition = async () => {
    if (!gameId || !gameState) return;

    setIsTransitioning(true);
    try {
      const nextPhase = gameState.phase === "night" ? "day" : "night";
      await gameService.transitionPhase(gameId, nextPhase);
      setActionFeedback(`Phase transitioned to ${nextPhase}`);
    } catch (err) {
      console.error("Error transitioning phase:", err);
      setActionFeedback("Failed to transition phase");
    } finally {
      setIsTransitioning(false);
    }
  };

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
        console.log("loadGameData", gameData);

        // Check if player was kicked
        if (gameData.players && checkIfKicked(gameData.players)) {
          return;
        }

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
        console.log("stateData", stateData);
        setGameState(stateData);

        // Start phase timer if game is in progress
        if (gameData.status === "in_progress") {
          startPhaseTimer(stateData.time_remaining);
        }

        // Load game events
        const eventsData = await gameService.getGameEvents(gameId);
        console.log("eventsData", eventsData);
        setEvents(eventsData);

        // Load chat messages
        const messagesData = await chatService.getMessages(gameId);
        console.log("messagesData", messagesData);
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
        message: messageInput,
        chat_type: gameState?.phase === "day" ? "public" : "team",
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
      const targetPlayer = players.find((p) => p.user_id === targetId);

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
        await gameService.useAbility(gameId, targetId, currentPlayer.role);
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
      const targetPlayer = players.find((p) => p.user_id === targetId);

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

  // Add phase transition button for host
  const renderPhaseTransitionButton = () => {
    if (!game || game.host_id !== user?.user_id) return null;

    return (
      <button
        onClick={handlePhaseTransition}
        disabled={isTransitioning}
        className="px-4 py-2 bg-purple-600 pixel-button hover:bg-purple-500 disabled:opacity-50"
      >
        {isTransitioning ? "Transitioning..." : `End ${gameState?.phase} Phase`}
      </button>
    );
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
  if (error || !game || !gameState) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white bg-gray-900">
        <div className="max-w-md p-8 text-center bg-gray-800 rounded-lg pixel-container">
          <div className="mb-4 text-4xl">🐺</div>
          <h2 className="mb-2 text-xl font-bold pixel-text">Error</h2>
          <p className="mb-6 text-gray-400">{error || "Game not found"}</p>
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

  // Get the live/dead status of the current player
  const isPlayerAlive = currentPlayer?.is_alive ?? false;

  // Check if player can use ability this phase
  const canUseAbility =
    gameState.phase === "night" &&
    isPlayerAlive &&
    currentPlayer?.role &&
    !gameState.role_actions[currentPlayer.user_id || ""];

  // Check if player can vote this phase
  const canVote = gameState.phase === "day" && isPlayerAlive;

  return (
    <div className="min-h-screen pb-12 text-white bg-gray-900">
      {/* Game UI Container */}
      <div className="flex flex-col h-screen">
        {/* Header */}
        <header className="px-4 py-2 bg-gray-800 shadow-md pixel-container">
          <div className="container flex items-center justify-between mx-auto">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-purple-500 pixel-text">
                Wolvesville
              </h1>
              <div className="flex items-center ml-6 space-x-2">
                <div className="px-3 py-1 bg-gray-700 rounded-lg pixel-border">
                  <span className="mr-1 text-gray-400">Phase:</span>
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
                <div className="px-3 py-1 bg-gray-700 rounded-lg pixel-border">
                  <span className="mr-1 text-gray-400">Day:</span>
                  <span className="font-bold text-white pixel-text">
                    {gameState.day_number}
                  </span>
                </div>
                <div className="px-3 py-1 bg-gray-700 rounded-lg pixel-border">
                  <span className="mr-1 text-gray-400">Time:</span>
                  <span className="font-bold text-white pixel-text">
                    {Math.floor(gameState.time_remaining / 60)}:
                    {(gameState.time_remaining % 60)
                      .toString()
                      .padStart(2, "0")}
                  </span>
                </div>
                <div
                  className="px-3 py-1 bg-gray-700 rounded-lg pixel-border cursor-help"
                  onMouseEnter={() => setShowRoleInfo(true)}
                  onMouseLeave={() => setShowRoleInfo(false)}
                >
                  <span className="mr-1 text-gray-400">Role:</span>
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
                    <div className="absolute z-50 max-w-xs p-3 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg pixel-border">
                      <p className="text-sm">{roleDescription}</p>
                    </div>
                  )}
                </div>
                {!isPlayerAlive && (
                  <div className="px-3 py-1 rounded-lg bg-red-900/50 pixel-border">
                    <span className="font-bold text-red-400 pixel-text">
                      ELIMINATED
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {renderPhaseTransitionButton()}
              <button
                onClick={() => {
                  setConfirmationMessage(
                    "Are you sure you want to leave this game?"
                  );
                  setConfirmationAction(() => handleLeaveGame);
                  setShowConfirmation(true);
                }}
                className="px-3 py-1 bg-gray-700 pixel-button hover:bg-gray-600"
              >
                Leave Game
              </button>
            </div>
          </div>
        </header>

        {/* Action feedback toast */}
        {actionFeedback && (
          <div className="fixed z-50 p-3 bg-gray-800 border border-purple-500 rounded-lg shadow-lg top-4 right-4 pixel-container">
            <p className="text-white pixel-text">{actionFeedback}</p>
          </div>
        )}

        {/* Confirmation modal */}
        {showConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="max-w-md p-6 bg-gray-800 border border-purple-500 rounded-lg pixel-container">
              <h3 className="mb-4 text-lg font-bold pixel-text">
                Confirm Action
              </h3>
              <p className="mb-6 text-gray-300">{confirmationMessage}</p>
              <div className="flex justify-end space-x-3">
                <button
                  className="px-3 py-1 bg-gray-700 pixel-button hover:bg-gray-600"
                  onClick={() => setShowConfirmation(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-3 py-1 bg-purple-600 pixel-button hover:bg-purple-500"
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
        <div className="container flex flex-1 px-4 py-6 mx-auto overflow-hidden">
          {/* Players Panel */}
          <div className="w-1/4 mr-4 overflow-auto bg-gray-800 rounded-lg pixel-container">
            <div className="p-4">
              <h2 className="mb-3 text-lg font-bold pixel-text">Players</h2>
              <div className="space-y-2">
                {players.map((player) => (
                  <div
                    key={player.user_id}
                    onClick={() => {
                      if (player.is_alive && player.user_id !== user?.user_id) {
                        setSelectedPlayer(player.user_id);
                      }
                    }}
                    className={`p-2 rounded-lg flex items-center ${
                      player.is_alive
                        ? "bg-gray-700 hover:bg-gray-600 cursor-pointer"
                        : "bg-gray-800 opacity-60"
                    } ${
                      player.user_id === user?.user_id
                        ? "border border-purple-500"
                        : player.user_id === selectedPlayer
                        ? "border border-yellow-500"
                        : ""
                    } pixel-border transition-all`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 text-sm font-bold bg-purple-900 rounded-full">
                      {player.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 ml-2">
                      <div className="text-sm font-bold truncate pixel-text">
                        {player.username}
                        {!player.is_alive && (
                          <span className="ml-2 text-red-500">☠️</span>
                        )}
                      </div>
                      {gameState.phase === "day" &&
                        gameState.votes[player.user_id] && (
                          <div className="text-xs text-gray-400">
                            Votes: {gameState.votes[player.user_id].length}
                          </div>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Game Area */}
          <div className="flex flex-col flex-1 h-full">
            {/* Game View */}
            <div className="relative flex-1 mb-4 overflow-hidden bg-gray-800 rounded-lg pixel-container">
              <div
                className={`absolute inset-0 ${
                  gameState.phase === "day"
                    ? "bg-gradient-to-b from-blue-900/30 to-purple-900/30"
                    : "bg-gradient-to-b from-gray-900/50 to-indigo-900/30"
                }`}
              ></div>

              <div className="relative z-10 flex flex-col items-center justify-center h-full p-6">
                {/* Phase header */}
                <h2 className="mb-6 text-4xl font-bold pixel-text">
                  {gameState.phase === "day" ? "DAY PHASE" : "NIGHT PHASE"}
                </h2>
                <div className="mb-8 text-8xl">
                  {gameState.phase === "day" ? "☀️" : "🌙"}
                </div>

                {/* Timer and phase info */}
                <div className="mb-8 text-center">
                  <div className="mb-2 text-xl pixel-text">
                    Time remaining: {Math.floor(gameState.time_remaining / 60)}:
                    {(gameState.time_remaining % 60)
                      .toString()
                      .padStart(2, "0")}
                  </div>
                  <p className="mb-4 text-gray-300 pixel-text">
                    {gameState.phase === "day"
                      ? "Discuss with other players and vote to eliminate a suspected werewolf."
                      : "Use your special abilities under the cover of darkness."}
                  </p>
                </div>

                {/* Action area */}
                <div className="w-full max-w-md p-4 rounded-lg bg-gray-700/80 pixel-container">
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
                                    (p) => p.user_id === selectedPlayer
                                  )?.username
                                }
                              </p>
                              <div className="flex justify-center space-x-3">
                                <button
                                  onClick={() => setSelectedPlayer(null)}
                                  className="px-3 py-1 bg-gray-600 pixel-button hover:bg-gray-500"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => handleVote(selectedPlayer)}
                                  className="px-3 py-1 bg-yellow-600 pixel-button hover:bg-yellow-500"
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
                            currentPlayer?.user_id || ""
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
                                    (p) => p.user_id === selectedPlayer
                                  )?.username
                                }
                              </p>
                              <div className="flex justify-center space-x-3">
                                <button
                                  onClick={() => setSelectedPlayer(null)}
                                  className="px-3 py-1 bg-gray-600 pixel-button hover:bg-gray-500"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() =>
                                    handleUseAbility(selectedPlayer)
                                  }
                                  className="px-3 py-1 bg-blue-600 pixel-button hover:bg-blue-500"
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
                                  className="px-3 py-1 bg-gray-600 pixel-button hover:bg-gray-500"
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
                              currentPlayer?.user_id || ""
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
                <div className="w-full max-w-md mt-8">
                  <h3 className="mb-2 text-lg font-bold pixel-text">
                    Event Log
                  </h3>
                  <div className="p-3 overflow-y-auto rounded-lg bg-gray-700/80 max-h-40 pixel-container">
                    {events
                      .filter(
                        (e) =>
                          e.is_public ||
                          !isPlayerAlive ||
                          e.target_ids?.includes(currentPlayer?.user_id || "")
                      )
                      .slice(-5)
                      .map((event, index) => (
                        <div key={index} className="mb-1 text-sm last:mb-0">
                          <span className="text-gray-400">
                            [{event.event_data.phase || gameState.phase}]
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
            <div className="overflow-hidden bg-gray-800 rounded-lg h-1/3 pixel-container">
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-2 bg-gray-700">
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
                  className="flex-1 p-2 space-y-2 overflow-y-auto"
                >
                  {messages.map((message) => {
                    // Only show messages that the player should see based on game state
                    const shouldShowMessage =
                      message.chat_type === "public" ||
                      (message.chat_type === "team" &&
                        currentPlayer?.team === message.sender_team) ||
                      (message.chat_type === "dead" && !isPlayerAlive);

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
                                {new Date(message.sent_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-200 break-words whitespace-pre-wrap">
                              {message.message}
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
                    className="flex p-2 border-t border-gray-700"
                  >
                    <input
                      type="text"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      placeholder="Type your message..."
                      className="flex-1 px-3 py-2 text-gray-200 bg-gray-700 rounded-l-lg focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-purple-600 rounded-r-lg hover:bg-purple-500 pixel-button"
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
