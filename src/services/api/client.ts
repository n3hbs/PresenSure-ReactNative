import { create, isAxiosError } from 'axios';

import { logError } from '@/utils/logger';

function getValidationErrors(data: unknown) {
  if (!data || typeof data !== 'object' || !('errors' in data)) return undefined;

  const errors = data.errors;
  if (!errors || typeof errors !== 'object') return undefined;

  const messages = Object.fromEntries(
    Object.entries(errors).flatMap(([field, value]) => {
      if (typeof value === 'string') return [[field, [value]]];
      if (Array.isArray(value)) {
        const fieldMessages = value.filter(
          (message): message is string => typeof message === 'string',
        );
        return fieldMessages.length > 0 ? [[field, fieldMessages]] : [];
      }
      return [];
    }),
  );

  return Object.keys(messages).length > 0 ? JSON.stringify(messages) : undefined;
}

export const apiClient = create({
  baseURL: process.env.EXPO_PUBLIC_API_URL,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (isAxiosError(error)) {
      logError('api.request', error, {
        method: error.config?.method?.toUpperCase(),
        url: error.config?.url,
        status: error.response?.status,
        statusText: error.response?.statusText,
        serverMessage:
          typeof error.response?.data?.message === 'string'
            ? error.response.data.message
            : undefined,
        validationErrors: getValidationErrors(error.response?.data),
      });
    } else {
      logError('api.request', error);
    }

    return Promise.reject(error);
  },
);

export function setAuthToken(token: string | null) {
  if (token) {
    apiClient.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete apiClient.defaults.headers.common.Authorization;
  }
}
