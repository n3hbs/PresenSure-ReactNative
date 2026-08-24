import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAxiosError } from 'axios';

import {
  storeAttendanceRecord,
  type AttendanceRecordData,
  type StoreAttendanceRecordPayload,
} from '@/services/attendance-record-service';
import { logError } from '@/utils/logger';

const OFFLINE_ATTENDANCE_STORAGE_KEY = '@presensure_offline_attendance_records_v1';

export type OfflinePendingAttendanceRecord = {
  local_id: string;
  schedule_id: number;
  presence_verified: boolean;
  face_verified: boolean;
  face_verified_at: string;
  verified_at: string;
  rssi: number;
  detected_at: string;
  created_at: string;
  sync_status: 'pending' | 'syncing' | 'failed';
  last_error?: string | null;
  retry_count: number;
};

/**
 * Retrieves all pending offline attendance records from local storage.
 */
export async function getPendingOfflineAttendanceRecords(
  scheduleId?: number,
): Promise<OfflinePendingAttendanceRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_ATTENDANCE_STORAGE_KEY);
    if (!raw) return [];

    const records = JSON.parse(raw) as OfflinePendingAttendanceRecord[];
    if (!Array.isArray(records)) return [];

    if (scheduleId) {
      return records.filter((r) => Number(r.schedule_id) === Number(scheduleId));
    }

    return records;
  } catch (error) {
    logError('offline.attendance.get', error);
    return [];
  }
}

/**
 * Saves an offline attendance record to local storage when the student is disconnected.
 */
export async function saveOfflineAttendanceRecord(
  payload: StoreAttendanceRecordPayload,
): Promise<OfflinePendingAttendanceRecord> {
  try {
    const existing = await getPendingOfflineAttendanceRecords();
    const localId = `offline_${payload.schedule_id}_${Date.now()}`;

    const newRecord: OfflinePendingAttendanceRecord = {
      local_id: localId,
      schedule_id: payload.schedule_id,
      presence_verified: payload.presence_verified,
      face_verified: payload.face_verified,
      face_verified_at: payload.face_verified_at,
      verified_at: payload.verified_at,
      rssi: payload.rssi,
      detected_at: payload.detected_at,
      created_at: new Date().toISOString(),
      sync_status: 'pending',
      retry_count: 0,
    };

    // Filter out previous pending record for the same schedule to avoid duplicate offline records
    const updated = [
      newRecord,
      ...existing.filter((r) => Number(r.schedule_id) !== Number(payload.schedule_id)),
    ];

    await AsyncStorage.setItem(OFFLINE_ATTENDANCE_STORAGE_KEY, JSON.stringify(updated));
    return newRecord;
  } catch (error) {
    logError('offline.attendance.save', error);
    throw error;
  }
}

/**
 * Removes an offline attendance record after successful synchronization with Laravel.
 */
export async function removeOfflineAttendanceRecord(localId: string): Promise<void> {
  try {
    const existing = await getPendingOfflineAttendanceRecords();
    const updated = existing.filter((r) => r.local_id !== localId);
    await AsyncStorage.setItem(OFFLINE_ATTENDANCE_STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    logError('offline.attendance.remove', error);
  }
}

/**
 * Converts an offline pending record to a displayable AttendanceRecordData format for UI preview.
 */
export function toDisplayableOfflineRecord(
  offline: OfflinePendingAttendanceRecord,
): AttendanceRecordData {
  return {
    attendance_record_id: -1, // Indicates offline pending local record
    attendance_session_id: 0,
    student_id: 'You',
    presence_verified: offline.presence_verified,
    face_verified: offline.face_verified,
    face_verified_at: offline.face_verified_at,
    verified_at: offline.verified_at,
    status: 'PRESENT (Offline - Pending Sync)',
    created_at: offline.created_at,
    updated_at: offline.created_at,
  };
}

/**
 * Attempts to synchronize pending offline attendance records with the server.
 */
export async function syncPendingOfflineAttendance(
  scheduleId?: number,
): Promise<{ synced: number; failed: number; errors: string[] }> {
  const pending = await getPendingOfflineAttendanceRecords(scheduleId);
  if (pending.length === 0) {
    return { synced: 0, failed: 0, errors: [] };
  }

  let syncedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const record of pending) {
    try {
      await storeAttendanceRecord({
        schedule_id: record.schedule_id,
        presence_verified: record.presence_verified,
        face_verified: record.face_verified,
        face_verified_at: record.face_verified_at,
        verified_at: record.verified_at,
        rssi: record.rssi,
        detected_at: record.detected_at,
      });

      // Remove from offline storage once accepted by the server
      await removeOfflineAttendanceRecord(record.local_id);
      syncedCount++;
    } catch (err) {
      failedCount++;
      const message = err instanceof Error ? err.message : 'Synchronization failed';
      errors.push(message);

      // If already recorded on server (e.g. conflict/duplicate), safe to remove offline copy
      if (
        isAxiosError(err) &&
        (err.response?.status === 422 || err.response?.status === 409) &&
        typeof err.response?.data?.message === 'string' &&
        err.response.data.message.includes('already exists')
      ) {
        await removeOfflineAttendanceRecord(record.local_id);
      }
    }
  }

  return { synced: syncedCount, failed: failedCount, errors };
}
