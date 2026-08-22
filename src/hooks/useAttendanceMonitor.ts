import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useCallback } from 'react';

import { useAuth } from '@/context/auth-context';
import { attendanceRecordQueryKeys } from '@/features/attendance/attendance-record-query-keys';
import { attendanceSessionQueryKeys } from '@/features/attendance/attendance-session-query-keys';
import { courseScheduleQueryKeys } from '@/features/attendance/course-schedule-query-keys';
import { subscribeToAttendanceSession } from '@/services/websocket/echo-service';
import type {
  AttendanceRecordCreatedPayload,
  AttendanceSessionStatusUpdatedPayload,
} from '@/types/websocket';

export type UseAttendanceMonitorOptions = {
  scheduleId?: number | null;
  enabled?: boolean;
  onRecordCreated?: (payload: AttendanceRecordCreatedPayload) => void;
  onStatusUpdated?: (payload: AttendanceSessionStatusUpdatedPayload) => void;
  onError?: (error: any) => void;
};

export type UseAttendanceMonitorResult = {
  isConnected: boolean;
  records: AttendanceRecordCreatedPayload[];
  latestRecord: AttendanceRecordCreatedPayload | null;
  latestStatus: AttendanceSessionStatusUpdatedPayload | null;
  presentCount: number;
  error: any | null;
  clearRecords: () => void;
};

/**
 * Hook for subscribing to real-time WebSocket attendance updates on private channel `attendance.session.{sessionId}`
 */
export function useAttendanceMonitor(
  sessionId: number | string | null | undefined,
  options: UseAttendanceMonitorOptions = {},
): UseAttendanceMonitorResult {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { scheduleId, enabled = true, onRecordCreated, onStatusUpdated, onError } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [records, setRecords] = useState<AttendanceRecordCreatedPayload[]>([]);
  const [latestRecord, setLatestRecord] = useState<AttendanceRecordCreatedPayload | null>(null);
  const [latestStatus, setLatestStatus] = useState<AttendanceSessionStatusUpdatedPayload | null>(null);
  const [error, setError] = useState<any | null>(null);

  // Keep latest callback references in refs to avoid restarting subscriptions on callback re-creation
  const onRecordCreatedRef = useRef(onRecordCreated);
  const onStatusUpdatedRef = useRef(onStatusUpdated);
  const onErrorRef = useRef(onError);
  const scheduleIdRef = useRef(scheduleId);

  useEffect(() => {
    onRecordCreatedRef.current = onRecordCreated;
    onStatusUpdatedRef.current = onStatusUpdated;
    onErrorRef.current = onError;
    scheduleIdRef.current = scheduleId;
  });

  const clearRecords = useCallback(() => {
    setRecords([]);
    setLatestRecord(null);
  }, []);

  useEffect(() => {
    if (!enabled || !sessionId || !token) {
      setIsConnected(false);
      return;
    }

    const unsubscribe = subscribeToAttendanceSession(sessionId, token, {
      onSubscribed: () => {
        setIsConnected(true);
        setError(null);
      },
      onError: (err) => {
        setIsConnected(false);
        setError(err);
        onErrorRef.current?.(err);
      },
      onRecordCreated: (payload) => {
        setLatestRecord(payload);
        setRecords((prev) => {
          // Avoid duplicate attendance records in state
          const exists = prev.some((r) => r.attendance_record_id === payload.attendance_record_id);
          if (exists) {
            return prev.map((r) =>
              r.attendance_record_id === payload.attendance_record_id ? payload : r,
            );
          }
          return [payload, ...prev];
        });

        // Invalidate relevant React Query caches to trigger seamless UI roster update
        const currentScheduleId = scheduleIdRef.current || payload.schedule_id;
        if (currentScheduleId) {
          queryClient.invalidateQueries({
            queryKey: courseScheduleQueryKeys.students(Number(currentScheduleId)),
          });
          queryClient.invalidateQueries({
            queryKey: attendanceRecordQueryKeys.check(Number(currentScheduleId)),
          });
        }

        onRecordCreatedRef.current?.(payload);
      },
      onStatusUpdated: (payload) => {
        setLatestStatus(payload);

        // Invalidate active session cache on status change (countdown, active -> ended)
        const currentScheduleId = scheduleIdRef.current || payload.schedule_id;
        if (currentScheduleId) {
          queryClient.invalidateQueries({
            queryKey: attendanceSessionQueryKeys.active(Number(currentScheduleId)),
          });
        }

        onStatusUpdatedRef.current?.(payload);
      },
    });

    return () => {
      unsubscribe();
      setIsConnected(false);
    };
  }, [sessionId, token, enabled, queryClient]);

  const presentCount = records.filter(
    (r) => (r.status || '').toLowerCase() === 'present' || r.presence_verified,
  ).length;

  return {
    isConnected,
    records,
    latestRecord,
    latestStatus,
    presentCount,
    error,
    clearRecords,
  };
}
