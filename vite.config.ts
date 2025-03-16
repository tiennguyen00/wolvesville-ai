import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5432",
        changeOrigin: true,
        secure: false,
      },
      "/socket.io": {
        target: "http://localhost:5432",
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
