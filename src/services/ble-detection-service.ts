import { isAxiosError } from 'axios';

import { apiClient } from '@/api/client';
import { logError } from '@/utils/logger';

export type StoreBleDetectionPayload = {
  schedule_id: number;
  rssi: number;
  detected_at: string; // Format: 'YYYY-MM-DD HH:mm:ss'
};

export type BleDetectionRecord = {
  ble_detection_id: number;
  attendance_record_id: number;
  user_id: number | string;
  rssi: number;
  detected_at: string;
};

export type StoreBleDetectionResponse = {
  success: boolean;
  message: string;
  data: {
    bleDetection: BleDetectionRecord;
  };
};

/**
 * Format a Date object or current date to MySQL/Laravel 'YYYY-MM-DD HH:mm:ss' format in local time
 */
export function formatBleDetectionTimestamp(date: Date = new Date()): string {
  const pad = (num: number) => String(num).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Send periodic BLE heartbeat detection to POST /api/ble-detection
 */
export async function recordBleDetection(
  payload: StoreBleDetectionPayload,
): Promise<StoreBleDetectionResponse> {
  try {
    const response = await apiClient.post<StoreBleDetectionResponse>(
      'api/ble-detection',
      payload,
    );

    return response.data;
  } catch (error) {
    if (isAxiosError(error)) {
      const message =
        typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : 'Unable to record BLE detection.';
      logError('ble-detection.record', error, {
        status: error.response?.status,
        message,
        scheduleId: payload.schedule_id,
        rssi: payload.rssi,
        detectedAt: payload.detected_at,
      });
      throw new Error(message);
    }

    logError('ble-detection.record', error, {
      scheduleId: payload.schedule_id,
      rssi: payload.rssi,
      detectedAt: payload.detected_at,
    });
    throw error;
  }
}
