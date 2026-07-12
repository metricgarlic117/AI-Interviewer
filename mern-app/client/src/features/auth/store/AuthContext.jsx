import React, { createContext, useCallback, useEffect, useState } from 'react';
import * as authApi from '../services/authApi';
import { refreshSession, setOnSessionExpired } from '../../../lib/axios';
import { setAccessToken, clearAccessToken } from '../../../lib/authToken';

export const AuthContext = createContext(null);

/**
 * Global auth store. On mount it tries the refresh-cookie flow once so a
 * page reload silently restores the session; `initializing` gates protected
 * routes until that finishes.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    setOnSessionExpired(() => setUser(null));

    refreshSession()
      .then(({ user: restored }) => setUser(restored))
      .catch(() => {
        // No valid session — stay logged out.
      })
      .finally(() => setInitializing(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const { user: loggedIn, accessToken } = await authApi.login(credentials);
    setAccessToken(accessToken);
    setUser(loggedIn);
    return loggedIn;
  }, []);

  const register = useCallback(async (details) => {
    const { user: created, accessToken } = await authApi.register(details);
    setAccessToken(accessToken);
    setUser(created);
    return created;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the server call fails, drop the local session.
    }
    clearAccessToken();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await authApi.fetchMe();
    setUser(fresh);
    return fresh;
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, setUser, initializing, login, register, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}
