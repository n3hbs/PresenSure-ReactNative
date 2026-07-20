import { isAxiosError } from 'axios';

import { apiClient } from '@/api/client';
import type {
  AttendanceSessionRequest,
  AttendanceSessionResponse,
} from '@/types/attendance-session';

type ServerTimeResponse =
  | {
      server_time?: string;
      data?: {
        server_time?: string;
        current_time?: string;
      };
    }
  | string;

function parseServerTimePayload(payload: ServerTimeResponse) {
  if (typeof payload === 'string') return payload;
  return payload.data?.server_time ?? payload.data?.current_time ?? payload.server_time ?? null;
}

export async function getServerTime(): Promise<Date> {
  try {
    const response = await apiClient.get<ServerTimeResponse>('api/server-time');
    const serverTime = parseServerTimePayload(response.data);
    const parsedServerTime = serverTime ? new Date(serverTime) : null;

    if (parsedServerTime && !Number.isNaN(parsedServerTime.getTime())) {
      return parsedServerTime;
    }

    const dateHeader = response.headers.date;
    const parsedHeaderTime = typeof dateHeader === 'string' ? new Date(dateHeader) : null;

    if (parsedHeaderTime && !Number.isNaN(parsedHeaderTime.getTime())) {
      return parsedHeaderTime;
    }
  } catch {
    // Fall back to the device clock until the Laravel server-time endpoint is available.
  }

  return new Date();
}

export async function createAttendanceSession(
  payload: AttendanceSessionRequest,
): Promise<AttendanceSessionResponse> {
  try {
    const response = await apiClient.post<AttendanceSessionResponse>(
      'api/attendance-session',
      payload,
    );

    return response.data;
  } catch (error) {
    if (isAxiosError(error)) {
      const message =
        typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : 'Unable to start attendance session.';
      throw new Error(message);
    }

    throw error;
  }
}
