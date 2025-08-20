import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub;

    (async () => {
      try {
      
        const { data: sessionData } = await supabase.auth.getSession();
        setUser(sessionData?.session?.user ?? null);

        const { data: userData } = await supabase.auth.getUser();
        setUser(userData?.user ?? null);
      } catch (e) {
        console.error('[auth] bootstrap error:', e);
      } finally {
        setReady(true);
      }
    })();

    // subscribe to auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    unsub = () => listener?.subscription?.unsubscribe();

    return () => {
      try { unsub?.(); } catch {}
    };
  }, []);

  // helpers with consistent error surfacing
  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const register = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthenticated: !!user,
      login,
      register,
      logout,
    }),
    [user, ready]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
