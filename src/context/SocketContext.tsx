import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { useToast } from "../hooks/useToast";
import { useQuery } from "@tanstack/react-query";
import gameService, { GamePlayer } from "../services/gameService";
import SOCKET_EVENTS from "../../constants/socketEvents";

interface PlayersUpdatedData {
  players: GamePlayer[];
}

interface PlayerJoinedData {
  userId: string;
  player: {
    user_id: string;
    username: string;
    is_alive: boolean;
  };
}

interface SocketContextType {
  socket: Socket | null;
  subscribeToPlayerUpdates: (
    gameId: string,
    callback: (data: PlayersUpdatedData) => void
  ) => () => void;
  joinGameRoom: (gameId: string, username?: string) => void;
  leaveGameRoom: (gameId: string, username?: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
};

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const { toast } = useToast();

  // Subscribe to the games query
  const { refetch: refetchListGames } = useQuery({
    queryKey: ["list-games"],
    queryFn: () => gameService.getGames(),
  });

  const joinGameRoom = (gameId: string, username?: string) => {
    if (socket) {
      socket.emit(SOCKET_EVENTS.JOIN_GAME_ROOM, { gameId, username });
      console.log("Emitted join_game_room for gameId:", gameId);
    }
  };

  const leaveGameRoom = (gameId: string, username?: string) => {
    if (socket) {
      socket.emit(SOCKET_EVENTS.LEAVE_GAME_ROOM, { gameId, username });
    }
  };

  const subscribeToPlayerUpdates = useCallback(
    (gameId: string, callback: (data: PlayersUpdatedData) => void) => {
      const handlePlayersUpdated = (data: PlayersUpdatedData) => {
        console.log("Received players_updated event:", data);
        callback(data);
      };

      if (socket) {
        // Join the game room
        joinGameRoom(gameId);

        // Listen for updates
        socket.on(SOCKET_EVENTS.PLAYERS_UPDATED, handlePlayersUpdated);
      }

      // Return cleanup function
      return () => {
        if (socket) {
          socket.off(SOCKET_EVENTS.PLAYERS_UPDATED, handlePlayersUpdated);
          leaveGameRoom(gameId);
        }
      };
    },
    [joinGameRoom, leaveGameRoom]
  );

  useEffect(() => {
    if (!isAuthenticated) {
      // If not authenticated, clean up any existing socket
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    // Connect to socket with correct namespace
    const newSocket = io("http://localhost:5001/game", {
      auth: {
        token: localStorage.getItem("token"),
      },
      transports: ["polling", "websocket"],
      forceNew: true,
    });

    setSocket(newSocket);

    // Log socket state after connection events
    newSocket.on(SOCKET_EVENTS.CONNECT, () => {
      console.log("Socket connected:", newSocket.connected);
      console.log("Socket ID:", newSocket.id);
    });

    newSocket.on(SOCKET_EVENTS.DISCONNECT, () => {
      console.log("Socket disconnected");
    });

    newSocket.on(SOCKET_EVENTS.CONNECT_ERROR, (error) => {
      console.error("Socket connection error:", error.message);
    });

    newSocket.on(SOCKET_EVENTS.ERROR, (error) => {
      console.error("Socket error:", error);
    });

    // ===========================================
    newSocket.on(SOCKET_EVENTS.CREATE_GAME, (data) => {
      toast({
        title: "Game created",
        content: "A new game has been created",
        status: "success",
      });
      refetchListGames();
    });

    // Clean up function
    return () => {
      if (newSocket.connected) {
        newSocket.disconnect();
        setSocket(null);
      }
    };
  }, [isAuthenticated]);

  return (
    <SocketContext.Provider
      value={{
        socket,
        subscribeToPlayerUpdates,
        joinGameRoom,
        leaveGameRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
