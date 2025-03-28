import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { useToast } from "../hooks/useToast";
import { useQuery } from "@tanstack/react-query";
import gameService, { GamePlayer } from "../services/gameService";

interface PlayersUpdatedData {
  players: GamePlayer[];
}

interface SocketContextType {
  socket: Socket | null;
  subscribeToPlayerUpdates: (
    gameId: string,
    callback: (data: PlayersUpdatedData) => void
  ) => () => void;
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
  const socketRef = useRef<Socket | null>(null);
  const { toast } = useToast();

  // Subscribe to the games query
  const { refetch: refetchListGames } = useQuery({
    queryKey: ["list-games"],
    queryFn: () => gameService.getGames(),
  });

  const subscribeToPlayerUpdates = useCallback(
    (gameId: string, callback: (data: PlayersUpdatedData) => void) => {
      const handlePlayersUpdated = (data: PlayersUpdatedData) => {
        callback(data);
      };

      socketRef.current?.on("players_updated", handlePlayersUpdated);

      return () => {
        socketRef.current?.off("players_updated", handlePlayersUpdated);
      };
    },
    []
  );

  useEffect(() => {
    if (!isAuthenticated) return;

    // Connect to socket with correct namespace
    socketRef.current = io("http://localhost:5001/game", {
      auth: {
        token: localStorage.getItem("token"),
      },
      transports: ["polling", "websocket"],
      forceNew: true,
    });

    // Log socket state after connection events
    socketRef.current?.on("connect", () => {
      console.log("Socket connected:", socketRef.current?.connected);
      console.log("Socket ID:", socketRef.current?.id);
    });

    socketRef.current?.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    socketRef.current?.on("connect_error", (error) => {
      console.error("Socket connection error:", error.message);
    });

    socketRef.current?.on("error", (error) => {
      console.error("Socket error:", error);
    });

    // ===========================================
    socketRef.current?.on("create_game", (data) => {
      console.log("create_game", data);
      toast({
        title: "Game created",
        content: "A new game has been created",
        status: "success",
      });
      refetchListGames();
    });

    // Clean up function
    return () => {
      if (socketRef.current?.connected) {
        socketRef.current?.disconnect();
      }
    };
  }, [isAuthenticated, toast, refetchListGames]);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        subscribeToPlayerUpdates,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
