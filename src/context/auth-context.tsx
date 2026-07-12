import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { setAuthToken } from '@/api/client';
import { login } from '@/services/auth-service';
import type { AuthSession, AuthUser, LoginCredentials } from '@/types/auth';
import { clearStoredSession, getStoredSession, storeSession } from '@/utils/auth-storage';

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoadingSession: boolean;
  token: string | null;
  user: AuthUser | null;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getStoredSession()
      .then((storedSession) => {
        if (!isMounted) return;
        setSession(storedSession);
        setAuthToken(storedSession?.token ?? null);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const nextSession = await login(credentials);
    await storeSession(nextSession);
    setAuthToken(nextSession.token);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredSession();
    setAuthToken(null);
    setSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: Boolean(session?.token),
      isLoadingSession,
      token: session?.token ?? null,
      user: session?.user ?? null,
      signIn,
      signOut,
    }),
    [isLoadingSession, session, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
