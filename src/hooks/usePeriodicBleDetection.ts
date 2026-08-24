import { useEffect, useState } from 'react';

import { requestPresenSurePermission } from '@/features/permissions/permission-service';
import {
  getPeriodicDetectionState,
  startPeriodicBleService,
  stopPeriodicBleService,
  subscribeToPeriodicDetection,
  type PeriodicDetectionState,
} from '@/services/ble/periodic-ble-service';
import { logError } from '@/utils/logger';

export type UsePeriodicBleDetectionOptions = {
  enabled: boolean;
  scheduleId?: number | null;
  courseName?: string | null;
  room?: string | null;
};

/**
 * Hook for managing background periodic BLE verification for students
 */
export function usePeriodicBleDetection(options: UsePeriodicBleDetectionOptions): PeriodicDetectionState {
  const { enabled, scheduleId, courseName, room } = options;
  const [detectionState, setDetectionState] = useState<PeriodicDetectionState>(() =>
    getPeriodicDetectionState(),
  );

  useEffect(() => {
    const unsubscribe = subscribeToPeriodicDetection((newState) => {
      setDetectionState(newState);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    async function manageService() {
      if (enabled && scheduleId && scheduleId > 0) {
        try {
          // Request notification permission for Android foreground service if needed
          await requestPresenSurePermission('notifications').catch(() => null);

          if (!isCancelled) {
            await startPeriodicBleService({
              scheduleId,
              courseName,
              room,
            });
          }
        } catch (error) {
          logError('usePeriodicBleDetection.start', error, { scheduleId });
        }
      } else {
        // If not enabled or scheduleId is missing, ensure service is stopped
        await stopPeriodicBleService().catch(() => null);
      }
    }

    void manageService();

    return () => {
      isCancelled = true;
      // When leaving the screen or schedule changes, stop the periodic service
      void stopPeriodicBleService().catch(() => null);
    };
  }, [enabled, scheduleId, courseName, room]);

  return detectionState;
}
