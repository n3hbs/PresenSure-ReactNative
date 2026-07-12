import { isAxiosError } from 'axios';

import { apiClient } from '@/api/client';
import type { AuthSession, LoginCredentials, LoginResponse } from '@/types/auth';

export async function login(credentials: LoginCredentials): Promise<AuthSession> {
  try {
    const response = await apiClient.post<LoginResponse>('api/user/signin', credentials);

    return {
      token: response.data.data.token,
      user: response.data.data.user,
    };
  } catch (error) {
    if (isAxiosError(error)) {
      const message =
        typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : 'Unable to login. Check your credentials and API connection.';
      throw new Error(message);
    }

    throw error;
  }
}
