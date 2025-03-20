import React from "react";
import { Routes, Route } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

// Pages
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import GameList from "./pages/GameList";
import CreateGame from "./pages/CreateGame";
import GameLobby from "./pages/GameLobby";
import GamePlay from "./pages/GamePlay";
import GameSummary from "./pages/GameSummary";
import Profile from "./pages/Profile";
import Stats from "./pages/Stats";
import History from "./pages/History";

// Components
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="w-12 h-12 border-t-2 border-b-2 border-purple-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stats"
        element={
          <ProtectedRoute>
            <Stats />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />

      {/* Game routes */}
      <Route
        path="/games"
        element={
          <ProtectedRoute>
            <GameList />
          </ProtectedRoute>
        }
      />
      <Route
        path="/create-game"
        element={
          <ProtectedRoute>
            <CreateGame />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/lobby/:gameId"
        element={
          <ProtectedRoute>
            <GameLobby />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/play/:gameId"
        element={
          <ProtectedRoute>
            <GamePlay />
          </ProtectedRoute>
        }
      />
      <Route
        path="/game/summary/:gameId"
        element={
          <ProtectedRoute>
            <GameSummary />
          </ProtectedRoute>
        }
      />

      {/* 404 route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
