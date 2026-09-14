import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch, setAuthToken, setUnauthorizedHandler } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
  }, []);

  const login = useCallback(async (phone, password, totpCode) => {
    setLoading(true);
    setAuthError(null);
    try {
      // Phase 16: if this browser/tablet has a saved device code
      // (set once by an admin during device provisioning — not
      // something the app invents on its own), it's sent along so
      // the session is tied to that device for independent revocation.
      const deviceCode = localStorage.getItem('susupro_device_code') || undefined;
      const result = await apiFetch('/api/auth/login', { method: 'POST', body: { phone, password, deviceCode, totpCode } });
      setAuthToken(result.token);
      const me = await apiFetch('/api/auth/me');
      setUser(me);
      return me;
    } catch (err) {
      if (err.code === 'MFA_REQUIRED') throw err; // let the login screen show the code field, not a generic error
      setAuthError(err.error || 'Login failed.');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await apiFetch('/api/auth/logout', { method: 'POST' }); } catch { /* proceed regardless */ }
    setAuthToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
