import axios from "axios";
import {
  useEffect,
  useContext,
  useState,
  createContext,
  useMemo,
  useCallback,
} from "react";

const BACKEND_URL =
  import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";

const AppContext = createContext(undefined);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  const api = useMemo(() => {
    const instance = axios.create({
      baseURL: BACKEND_URL,
    });

    instance.interceptors.request.use((config) => {
      const currentToken = localStorage.getItem("token");

      if (currentToken) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      }

      return config;
    });

    instance.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem("token");
          setToken(null);
          setUser(null);
        }
        return Promise.reject(error);
      }
    );

    return instance;
  }, []);

  // Load the current user, including their role, from the backend.
  const loadUser = useCallback(async () => {
    const savedToken = localStorage.getItem("token");

    if (!savedToken) {
      setUser(null);
      setToken(null);
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get("/api/auth/user");

      if (data.success && data.user) {
        setUser(data.user);
        setToken(savedToken);
      } else {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error(
        "LOAD USER ERROR:",
        error.response?.data || error.message
      );

      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Login
  const login = async (email, password) => {
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/auth/login`,
        { email, password }
      );

      if (!data.success || !data.token) {
        return {
          success: false,
          message: data.message || "Login failed",
        };
      }

      // Save the token before making authenticated requests.
      localStorage.setItem("token", data.token);
      setToken(data.token);

      let loggedInUser = data.user;

      // If login response doesn't contain a role, fetch the user profile.
      if (!loggedInUser?.role) {
        const profileResponse = await axios.get(
          `${BACKEND_URL}/api/auth/user`,
          {
            headers: {
              Authorization: `Bearer ${data.token}`,
            },
          }
        );

        loggedInUser = profileResponse.data.user;
      }

      if (!loggedInUser) {
        throw new Error("User details were not returned by the server.");
      }

      setUser(loggedInUser);

      return {
        success: true,
        user: loggedInUser,
      };
    } catch (error) {
      console.error(
        "LOGIN ERROR:",
        error.response?.data || error.message
      );

      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          "Login failed",
      };
    }
  };

  // Register
  const register = async (name, email, password) => {
    try {
      const { data } = await axios.post(
        `${BACKEND_URL}/api/auth/register`,
        { name, email, password }
      );

      if (!data.success || !data.token) {
        return {
          success: false,
          message: data.message || "Registration failed",
        };
      }

      localStorage.setItem("token", data.token);
      setToken(data.token);

      let registeredUser = data.user;

      if (!registeredUser?.role) {
        const profileResponse = await axios.get(
          `${BACKEND_URL}/api/auth/user`,
          {
            headers: {
              Authorization: `Bearer ${data.token}`,
            },
          }
        );

        registeredUser = profileResponse.data.user;
      }

      setUser(registeredUser);

      return {
        success: true,
        user: registeredUser,
      };
    } catch (error) {
      console.error(
        "REGISTER ERROR:",
        error.response?.data || error.message
      );

      return {
        success: false,
        message:
          error.response?.data?.message || "Registration failed",
      };
    }
  };

  // Logout
  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    api,
    login,
    register,
    logout,
    loadUser,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);

  if (!context) {
    throw new Error("useApp must be used within AppProvider");
  }

  return context;
}