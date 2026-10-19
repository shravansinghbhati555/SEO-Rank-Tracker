import axios from "axios";
import { useEffect, useContext, useState, createContext } from "react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const AppContext = createContext(undefined);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const api = axios.create({
    baseURL: BACKEND_URL,
  });

  // Add token to every API request
  api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  });

  // Load logged-in user
  const loadUser = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get("/api/auth/user");

      if (data.success) {
        setUser(data.user);
      }
    } catch (error) {
    console.error(error.message)
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  // Login
  const login = async (email, password) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email,
        password,
      });
        console.log("LOGIN RESPONSE:", res.data);

      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem("token", res.data.token);

        return { success: true };
      }

      return {
        success: false,
        message: res.data.message || "Login failed"
      };
    } catch (error) {
      console.log("LOGIN ERROR:", error.response?.data);
    console.log("STATUS:", error.response?.status);
    
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
      };
    }
  };

  // Register
  const register = async (name, email, password) => {
    try {
      const res = await axios.post(`${BACKEND_URL}/api/auth/register`, {
        name,
        email,
        password,
      });

      if (res.data.success) {
        setToken(res.data.token);
        setUser(res.data.user);
        localStorage.setItem("token", res.data.token);

        return { success: true };
      }

      return {
        success: false,
        message: res.data.message,
      };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || "Registration failed",
      };
    }
  };

  // Logout
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  };

  const value = {
    user,
    token,
    loading,
    api,
    login,
    register,
    logout,
  };

  return <AppContext.Provider value={value}>
    {children}
  </AppContext.Provider>;
}

// Custom hook
export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
}
