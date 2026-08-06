import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, getApiErrorMessage, REFRESH_TOKEN_KEY, TOKEN_KEY } from "../api/client";
import { User } from "../types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, res.data.token);
      localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refreshToken);
      setUser(res.data.user);
    } catch (err) {
      throw new Error(getApiErrorMessage(err));
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setUser(null);
    window.location.href = "/login";
  }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
