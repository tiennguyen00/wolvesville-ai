const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");

let io;

module.exports = {
  init: (server) => {
    io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
        allowedHeaders: ["Content-Type", "Authorization"],
      },
      transports: ["polling", "websocket"],
    });

    // Log all socket events in development
    if (process.env.NODE_ENV !== "production") {
      io.on("connection", (socket) => {
        // console.log("New socket connection:", socket.id);

        socket.on("disconnect", (reason) => {
          console.log("Socket disconnected:", socket.id, "Reason:", reason);
        });

        socket.on("error", (error) => {
          console.error("Socket error:", error);
        });
      });
    }

    // Middleware to authenticate socket connections
    io.use((socket, next) => {
      // console.log("Authenticating socket connection:", socket.id);
      const token = socket.handshake.auth.token;

      if (!token) {
        console.log("No token provided for socket:", socket.id);
        return next(new Error("Authentication token required"));
      }

      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || "dev-secret-key"
        );
        socket.user = decoded;
        // console.log("Socket authenticated successfully:", socket.id);
        next();
      } catch (err) {
        console.error("Socket authentication failed:", socket.id, err.message);
        next(new Error("Invalid authentication token"));
      }
    });

    return io;
  },
  getIO: () => {
    if (!io) {
      throw new Error("Socket.io not initialized");
    }
    return io;
  },
};
