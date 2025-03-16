import axios from "axios";

// Set up default configs for axios
const api = axios.create({
  baseURL: "http://localhost:5432", // Base URL for direct API calls
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor to include the token in every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor to handle common errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { response } = error;

    // Handle common errors here (e.g., 401 Unauthorized, 403 Forbidden)
    if (response && response.status === 401) {
      localStorage.removeItem("token");
      // Optionally redirect to login
    }

    return Promise.reject(error);
  }
);

export default api;
