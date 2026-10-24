import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, visitorId } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      try {
        await api.post("/auth/refresh");
        const { data } = await api.get("/auth/me");
        setUser(data);
      } catch (e2) {
        setUser(false);
      }
    }
  }, []);

  useEffect(() => {
    // Skip while returning from Google; AuthCallback exchanges the session first.
    if (window.location.hash?.includes("session_id=")) return;
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password, visitor_id: visitorId() });
    setUser(data);
    return data;
  };
  const register = async (body) => {
    const { data } = await api.post("/auth/register", body);
    setUser(data);
    return data;
  };
  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(false);
  };

  return <AuthCtx.Provider value={{ user, setUser, login, register, logout, checkAuth }}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const homeFor = (u) => (u?.firm_id ? "/project" : "/reviews");
