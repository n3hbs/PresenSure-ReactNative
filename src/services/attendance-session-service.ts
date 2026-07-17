import { isAxiosError } from 'axios';

import { apiClient } from '@/api/client';
import type {
  AttendanceSessionRequest,
  AttendanceSessionResponse,
} from '@/types/attendance-session';

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
