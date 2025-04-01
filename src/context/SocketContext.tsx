import React, { createContext, useContext, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";
import { useToast } from "../hooks/useToast";
import { useQuery } from "@tanstack/react-query";
import gameService, { GamePlayer } from "../services/gameService";
import SOCKET_EVENTS from "../constants/socketEvents";

interface PlayersUpdatedData {
  players: GamePlayer[];
}

interface SocketContextType {
  socket: Socket | null;
  subscribeToPlayerUpdates: (
    gameId: string,
    playerId: string,
    callback: (data: PlayersUpdatedData) => void
  ) => void;
  unsubscribeFromPlayerUpdates: (
    gameId: string,
    playerId: string,
    callback: (data: PlayersUpdatedData) => void
  ) => void;
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

  const handlePlayersUpdated = (data: PlayersUpdatedData, cb) => {
    console.log("Received players_updated event:", data);
    cb(data);
  };

  const subscribeToPlayerUpdates = (
    gameId: string,
    username: string,
    callback: (data: PlayersUpdatedData) => void
  ) => {
    socket?.emit(SOCKET_EVENTS.JOIN_GAME_ROOM, { gameId, username });
    // socket?.on(SOCKET_EVENTS.PLAYERS_UPDATED, (data) =>
    //   handlePlayersUpdated(data, callback)
    // );
  };

  const unsubscribeFromPlayerUpdates = (
    gameId: string,
    username: string,
    callback: (data: PlayersUpdatedData) => void
  ) => {
    if (socket) {
      console.log("unsubscribing from player updates", gameId, username);
      socket.emit(SOCKET_EVENTS.LEAVE_GAME_ROOM, { gameId, username });
      // socket.off(SOCKET_EVENTS.PLAYERS_UPDATED, (data) =>
      //   handlePlayersUpdated(data, callback)
      // );
    }
  };
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

    // Nofify to all users anytime a new game is created
    newSocket.on(SOCKET_EVENTS.CREATE_GAME, (data) => {
      toast({
        title: "Game created",
        content:
          "A new game has been created by the host: " + data.host_username,
        status: "info",
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
        unsubscribeFromPlayerUpdates,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
