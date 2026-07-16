import AsyncStorage from '@react-native-async-storage/async-storage';

import { deleteSecureItem, getSecureItem, setSecureItem } from '@/services/storage/secure-storage';
import type { AuthSession, AuthUser } from '@/types/auth';

const AUTH_TOKEN_KEY = 'presensure.auth.token';
const AUTH_USER_CACHE_KEY = 'presensure.auth.user';
const REMEMBERED_USER_ID_KEY = 'presensure.auth.remembered_user_id';

export async function getStoredSession(): Promise<AuthSession | null> {
  const token = await getSecureItem(AUTH_TOKEN_KEY);
  if (!token) return null;

  const rawUser = await AsyncStorage.getItem(AUTH_USER_CACHE_KEY);
  if (!rawUser) {
    await clearStoredSession();
    return null;
  }

  try {
    return {
      token,
      user: JSON.parse(rawUser) as AuthUser,
    };
  } catch {
    await clearStoredSession();
    return null;
  }
}

export async function storeSession(session: AuthSession) {
  await setSecureItem(AUTH_TOKEN_KEY, session.token);
  await AsyncStorage.setItem(AUTH_USER_CACHE_KEY, JSON.stringify(session.user));
}

export async function clearStoredSession() {
  await deleteSecureItem(AUTH_TOKEN_KEY);
  await AsyncStorage.removeItem(AUTH_USER_CACHE_KEY);
}

export async function getRememberedUserId() {
  return AsyncStorage.getItem(REMEMBERED_USER_ID_KEY);
}

export async function storeRememberedUserId(userId: string) {
  await AsyncStorage.setItem(REMEMBERED_USER_ID_KEY, userId);
}

export async function clearRememberedUserId() {
  await AsyncStorage.removeItem(REMEMBERED_USER_ID_KEY);
}
