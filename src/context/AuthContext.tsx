import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import api from "../services/api";

// Define types
type User = {
  user_id: string;
  username: string;
  email: string;
  experience_points: number;
  gold_coins: number;
  gems: number;
};

type AuthContextType = {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    username: string,
    email: string,
    password: string
  ) => Promise<void>;
  logout: () => void;
  error: string | null;
};

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider component
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    localStorage.getItem("token")
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load user if token exists
    const loadUser = async () => {
      if (token) {
        try {
          const res = await api.get("/api/users/me");
          setUser(res.data.user);
        } catch (err) {
          localStorage.removeItem("token");
          setToken(null);
        }
      }
      setLoading(false);
    };

    loadUser();
  }, [token]);

  // Login function
  const login = async (email: string, password: string) => {
    try {
      setError(null);
      const res = await api.post("/api/users/login", { email, password });
      const { token, user } = res.data;

      // Save to local storage and state
      localStorage.setItem("token", token);
      setToken(token);
      setUser(user);
    } catch (err: any) {
      setError(err.response?.data?.message || "Login failed");
      throw err;
    }
  };

  // Register function
  const register = async (
    username: string,
    email: string,
    password: string
  ) => {
    try {
      setError(null);
      const res = await api.post("/api/users/register", {
        username,
        email,
        password,
      });
      const { token, user } = res.data;

      // Save to local storage and state
      localStorage.setItem("token", token);
      setToken(token);
      setUser(user);
    } catch (err: any) {
      setError(err.response?.data?.message || "Registration failed");
      throw err;
    }
  };

  // Logout function
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token,
        loading,
        login,
        register,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
