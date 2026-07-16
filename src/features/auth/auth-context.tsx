import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { apiClient, setAuthToken } from '@/services/api/client';
import {
  clearDeviceRegistration,
  getStoredDeviceRegistration,
} from '@/services/device/device-registration-service';
import { login } from '@/services/auth-service';
import type { AuthSession, AuthUser, LoginCredentials } from '@/types/auth';
import type { DeviceRegistrationStatus, RegisteredDevice } from '@/types/device-registration';
import { clearStoredSession, getStoredSession, storeSession } from '@/services/storage/auth-storage';

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoadingSession: boolean;
  token: string | null;
  user: AuthUser | null;
  deviceRegistrationStatus: DeviceRegistrationStatus;
  registeredDevice: RegisteredDevice | null;
  signIn: (credentials: LoginCredentials) => Promise<void>;
  signOut: () => Promise<void>;
  refreshDeviceRegistration: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getDeviceStatus(device: RegisteredDevice | null): DeviceRegistrationStatus {
  return device?.status ?? 'unregistered';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [registeredDevice, setRegisteredDevice] = useState<RegisteredDevice | null>(null);
  const [deviceRegistrationStatus, setDeviceRegistrationStatus] =
    useState<DeviceRegistrationStatus>('unregistered');
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const isShowingExpiredAlert = useRef(false);

  const refreshDeviceRegistration = useCallback(async () => {
    const nextDevice = await getStoredDeviceRegistration();
    setRegisteredDevice(nextDevice);
    setDeviceRegistrationStatus(getDeviceStatus(nextDevice));
  }, []);

  useEffect(() => {
    let isMounted = true;

    Promise.all([getStoredSession(), getStoredDeviceRegistration()])
      .then(([storedSession, storedDevice]) => {
        if (!isMounted) return;
        setSession(storedSession);
        setRegisteredDevice(storedDevice);
        setDeviceRegistrationStatus(getDeviceStatus(storedDevice));
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
    const storedDevice = await getStoredDeviceRegistration();
    setAuthToken(nextSession.token);
    setSession(nextSession);
    setRegisteredDevice(storedDevice);
    setDeviceRegistrationStatus(getDeviceStatus(storedDevice));
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredSession();
    await clearDeviceRegistration();
    setAuthToken(null);
    setSession(null);
    setRegisteredDevice(null);
    setDeviceRegistrationStatus('unregistered');
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
      deviceRegistrationStatus,
      registeredDevice,
      signIn,
      signOut,
      refreshDeviceRegistration,
    }),
    [
      deviceRegistrationStatus,
      isLoadingSession,
      refreshDeviceRegistration,
      registeredDevice,
      session,
      signIn,
      signOut,
    ],
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
