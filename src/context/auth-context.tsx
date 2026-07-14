import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { apiClient, setAuthToken } from '@/api/client';
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
  const isShowingExpiredAlert = useRef(false);

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

  useEffect(() => {
    const interceptorId = apiClient.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = error?.response?.status;
        const hasActiveSession = Boolean(session?.token);
        const isSessionExpired = status === 401 || status === 419;

        if (hasActiveSession && isSessionExpired && !isShowingExpiredAlert.current) {
          isShowingExpiredAlert.current = true;
          await signOut();

          Alert.alert(
            'Session expired',
            'Your login session has expired. Please sign in again to continue.',
            [
              {
                text: 'OK',
                onPress: () => {
                  isShowingExpiredAlert.current = false;
                  router.replace('/login');
                },
              },
            ],
            {
              cancelable: false,
              onDismiss: () => {
                isShowingExpiredAlert.current = false;
                router.replace('/login');
              },
            },
          );
        }

        return Promise.reject(error);
      },
    );

    return () => {
      apiClient.interceptors.response.eject(interceptorId);
    };
  }, [session?.token, signOut]);

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
