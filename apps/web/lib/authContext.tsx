"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getAccessToken, setAccessToken } from "./accessToken";
import { apiLogin, apiMe, apiRefresh, apiRegister, type AuthUser } from "./authApi";

type AuthContextValue = {
  accessToken: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (body: { email: string; password: string }) => Promise<void>;
  register: (body: { email: string; password: string; firstName: string; lastName: string }) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessTokenState, setAccessTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const syncTokenFromStorage = useCallback(() => {
    const t = getAccessToken();
    setAccessTokenState(t);
    return t;
  }, []);

  const refreshUser = useCallback(async () => {
    let token = syncTokenFromStorage();
    if (!token) {
      try {
        const res = await apiRefresh();
        token = res.accessToken;
        setAccessToken(token);
        setAccessTokenState(token);
      } catch {
        setUser(null);
        return;
      }
    }

    try {
      const { user: me } = await apiMe();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, [syncTokenFromStorage]);

  useEffect(() => {
    (async () => {
      syncTokenFromStorage();
      await refreshUser();
      setLoading(false);
    })();
  }, [refreshUser, syncTokenFromStorage]);

  const login = useCallback(
    async (body: { email: string; password: string }) => {
      const { accessToken } = await apiLogin(body);
      setAccessToken(accessToken);
      setAccessTokenState(accessToken);
      await refreshUser();
    },
    [refreshUser]
  );

  const register = useCallback(
    async (body: { email: string; password: string; firstName: string; lastName: string }) => {
      const { accessToken } = await apiRegister(body);
      setAccessToken(accessToken);
      setAccessTokenState(accessToken);
      await refreshUser();
    },
    [refreshUser]
  );

  const logout = useCallback(() => {
    setAccessToken(null);
    setAccessTokenState(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: accessTokenState,
      user,
      loading,
      login,
      register,
      logout,
      refreshUser
    }),
    [accessTokenState, loading, login, logout, refreshUser, register, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
