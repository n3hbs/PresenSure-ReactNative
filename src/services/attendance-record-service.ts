import { isAxiosError } from 'axios';

import { apiClient } from '@/api/client';
import { logError } from '@/utils/logger';

export type StoreAttendanceRecordPayload = {
  schedule_id: number;
  presence_verified: boolean;
  face_verified: boolean;
  face_verified_at: string;
  verified_at: string;
  rssi: number;
  detected_at: string;
};

export type AttendanceRecordData = {
  attendance_record_id: number;
  attendance_session_id: number;
  student_id: string;
  presence_verified: boolean;
  face_verified: boolean;
  face_verified_at: string | null;
  verified_at: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type BleDetectionData = {
  ble_detection_id?: number;
  attendance_record_id: number;
  user_id: string;
  rssi: number;
  detected_at: string;
};

export type StoreAttendanceRecordResponse = {
  success: boolean;
  message: string;
  data: {
    attendanceRecord: AttendanceRecordData;
    bleDetection: BleDetectionData;
  };
};

export async function storeAttendanceRecord(
  payload: StoreAttendanceRecordPayload
): Promise<StoreAttendanceRecordResponse> {
  try {
    const response = await apiClient.post<StoreAttendanceRecordResponse>(
      'api/attendance-record',
      payload
    );

    return response.data;
  } catch (error) {
    if (isAxiosError(error)) {
      const message =
        typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : 'Unable to store attendance record.';
      throw new Error(message);
    }

    throw error;
  }
}
