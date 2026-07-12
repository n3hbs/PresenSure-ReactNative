import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AuthSession } from '@/types/auth';

const AUTH_SESSION_KEY = 'presensure.auth.session';

export async function getStoredSession(): Promise<AuthSession | null> {
  const rawSession = await AsyncStorage.getItem(AUTH_SESSION_KEY);
  if (!rawSession) return null;

  try {
    return JSON.parse(rawSession) as AuthSession;
  } catch {
    await AsyncStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }
}

export async function storeSession(session: AuthSession) {
  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
  await AsyncStorage.removeItem(AUTH_SESSION_KEY);
}
