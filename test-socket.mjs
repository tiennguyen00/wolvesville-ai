import { io } from "socket.io-client";

const token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNmEyMGYyMzQtNzkzNS00MWFjLWFiNzgtYTE3OWY3MDk5ODRiIiwiaWF0IjoxNzQzMDYwMTY3LCJleHAiOjE3NDM2NjQ5Njd9.Gb2NemsEPSD3zzmNFuqr9PBwzXUEdN9P5uOTv6UFDKQ";

// Connect to socket server
const socket = io("http://localhost:5001/game", {
  auth: { token },
});

// Handle connection events
socket.on("connect", () => {
  console.log("Connected to socket server");

  // Authenticate first
  socket.emit("authenticate", {
    user_id: "6a20f234-7935-41ac-ab78-a179f709984b",
    token,
  });
});

socket.on("authenticated", (data) => {
  console.log("Authentication response:", data);

  if (data.success) {
    // Create a game after successful authentication
    const gameSettings = {
      game_id: "450c50fa-3f33-420a-837d-f3891ef78499",
      settings: {
        game_mode: "classic",
        max_players: 8,
        password_protected: false,
      },
      host_info: {
        user_id: "6a20f234-7935-41ac-ab78-a179f709984b",
      },
    };

    socket.emit("create_game", gameSettings);
  }
});

socket.on("game_created", (data) => {
  console.log("Game created:", data);
});

socket.on("room_joined", (data) => {
  console.log("Room joined:", data);
});

socket.on("error", (error) => {
  console.error("Socket error:", error);
});

socket.on("disconnect", () => {
  console.log("Disconnected from socket server");
});

// Keep the script running
process.on("SIGINT", () => {
  socket.disconnect();
  process.exit();
});
