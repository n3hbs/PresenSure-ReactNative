import BackgroundService from 'react-native-background-actions';
import { Platform } from 'react-native';

import {
  formatBleDetectionTimestamp,
  recordBleDetection,
  type BleDetectionRecord,
} from '@/services/ble-detection-service';
import {
  scanForEsp32Beacons,
  type DetectedEsp32Beacon,
} from '@/services/ble/esp32-beacon-connection';
import { logError } from '@/utils/logger';

export type PeriodicDetectionState = {
  isRunning: boolean;
  scheduleId: number | null;
  courseName?: string | null;
  room?: string | null;
  lastPingAt: string | null;
  lastRssi: number | null;
  lastRecord: BleDetectionRecord | null;
  error: string | null;
};

export type StartPeriodicDetectionOptions = {
  scheduleId: number;
  courseName?: string | null;
  room?: string | null;
  intervalMs?: number;
};

const DEFAULT_INTERVAL_MS = 120_000; // 2 minutes
const SLEEP_CHUNK_MS = 1_000;
const MAX_CONSECUTIVE_FAILURES = 3;

let currentState: PeriodicDetectionState = {
  isRunning: false,
  scheduleId: null,
  courseName: null,
  room: null,
  lastPingAt: null,
  lastRssi: null,
  lastRecord: null,
  error: null,
};

const listeners = new Set<(state: PeriodicDetectionState) => void>();

function updateState(partial: Partial<PeriodicDetectionState>) {
  currentState = { ...currentState, ...partial };
  for (const listener of listeners) {
    try {
      listener(currentState);
    } catch {
      // Ignore listener errors
    }
  }
}

export function subscribeToPeriodicDetection(
  listener: (state: PeriodicDetectionState) => void,
): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

export function getPeriodicDetectionState(): PeriodicDetectionState {
  return currentState;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isBeaconSessionActive(beacon: DetectedEsp32Beacon): boolean {
  if (!beacon.parsedEsp32Payload && !beacon.advertisedPayload) {
    return false;
  }
  if (beacon.parsedEsp32Payload) {
    const { sessionHash, verificationToken } = beacon.parsedEsp32Payload;
    if (!sessionHash || sessionHash === '00000000' || sessionHash === '0000') {
      return false;
    }
    if (verificationToken === '000000000000') {
      return false;
    }
  }
  return true;
}

async function runPeriodicBleHeartbeat(scheduleId: number, room?: string | null) {
  let beacons: DetectedEsp32Beacon[];
  try {
    beacons = await scanForEsp32Beacons(room);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Bluetooth scan failed';
    updateState({ error: errorMsg });
    throw error;
  }

  if (!beacons || beacons.length === 0) {
    const errorMsg = 'Room ESP32 beacon not in range';
    updateState({ error: errorMsg });
    throw new Error(errorMsg);
  }

  const match = beacons.find((b) => b.isRecommended) ?? beacons[0];

  // If the detected ESP32 beacon broadcasts empty/cleared session data, session is finished
  if (!isBeaconSessionActive(match)) {
    const errorMsg = 'Attendance session ended on ESP32 beacon';
    updateState({ error: errorMsg });
    throw new Error(errorMsg);
  }

  const detectedRssi = match.rssi ?? -65;
  const detectedAt = formatBleDetectionTimestamp(new Date());

  const response = await recordBleDetection({
    schedule_id: scheduleId,
    rssi: detectedRssi,
    detected_at: detectedAt,
  });

  const nowFormatted = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  updateState({
    lastPingAt: detectedAt,
    lastRssi: detectedRssi,
    lastRecord: response.data.bleDetection,
    error: null,
  });

  // Update foreground persistent notification info
  if (Platform.OS === 'android') {
    try {
      await BackgroundService.updateNotification({
        taskDesc: `Presence active • Last verified at ${nowFormatted} (${detectedRssi} dBm)`,
      });
    } catch {
      // Ignore notification update errors
    }
  }

  return response;
}

const backgroundTask = async (taskDataArguments?: {
  scheduleId?: number;
  room?: string | null;
  courseName?: string | null;
  intervalMs?: number;
}) => {
  const scheduleId = taskDataArguments?.scheduleId;
  const room = taskDataArguments?.room ?? null;
  const intervalMs = taskDataArguments?.intervalMs ?? DEFAULT_INTERVAL_MS;

  if (!scheduleId) {
    return;
  }

  let consecutiveFailures = 0;

  // Continuous loop: waits the interval before triggering detections
  while (BackgroundService.isRunning()) {
    const totalChunks = Math.floor(intervalMs / SLEEP_CHUNK_MS);

    for (let i = 0; i < totalChunks; i++) {
      if (!BackgroundService.isRunning()) {
        break;
      }
      await sleep(SLEEP_CHUNK_MS);
    }

    if (!BackgroundService.isRunning()) {
      break;
    }

    try {
      await runPeriodicBleHeartbeat(scheduleId, room);
      consecutiveFailures = 0;
    } catch (err: any) {
      consecutiveFailures++;
      const errorMsg = err?.message || 'Periodic verification ping failed';
      logError('ble.periodic.heartbeat', err, { scheduleId, consecutiveFailures });
      updateState({ error: errorMsg });

      // Stop service if:
      // 1. Explicit backend response indicates the attendance session is closed / disabled / record missing
      // 2. Beacon is unreachable or session ended on ESP32 for 3 consecutive cycles (6 minutes)
      const isBackendEnded =
        typeof errorMsg === 'string' &&
        (errorMsg.includes('No active attendance session') ||
          errorMsg.includes('not enabled') ||
          errorMsg.includes('No attendance record'));

      if (isBackendEnded || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        await stopPeriodicBleService();
        break;
      }
    }
  }
};

export async function startPeriodicBleService(
  options: StartPeriodicDetectionOptions,
): Promise<void> {
  const { scheduleId, courseName, room, intervalMs = DEFAULT_INTERVAL_MS } = options;

  if (!scheduleId || Number.isNaN(scheduleId)) {
    return;
  }

  // If already running for the same schedule, don't restart
  if (BackgroundService.isRunning() && currentState.scheduleId === scheduleId) {
    return;
  }

  // If running for a different schedule, stop first
  if (BackgroundService.isRunning()) {
    await stopPeriodicBleService();
  }

  updateState({
    isRunning: true,
    scheduleId,
    courseName,
    room,
    error: null,
  });

  const notificationTitle = 'PresenSure Attendance Active';
  const notificationDesc = courseName
    ? `Periodic verification active for ${courseName}`
    : 'PresenSure is monitoring your presence in class...';

  const backgroundOptions = {
    taskName: 'PresenSureAttendanceMonitoring',
    taskTitle: notificationTitle,
    taskDesc: notificationDesc,
    taskIcon: {
      name: 'ic_launcher',
      type: 'mipmap',
    },
    color: '#208AEF',
    linkingURI: 'presensure://',
    parameters: {
      scheduleId,
      room,
      courseName,
      intervalMs,
    },
  };

  try {
    await BackgroundService.start(backgroundTask, backgroundOptions);
  } catch (error) {
    logError('ble.periodic.start', error);
    updateState({ isRunning: false, error: 'Failed to start background attendance monitoring' });
    throw error;
  }
}

export async function stopPeriodicBleService(): Promise<void> {
  try {
    if (BackgroundService.isRunning()) {
      await BackgroundService.stop();
    }
  } catch (error) {
    logError('ble.periodic.stop', error);
  } finally {
    updateState({
      isRunning: false,
      scheduleId: null,
      courseName: null,
      room: null,
    });
  }
}

export function isPeriodicBleServiceRunning(): boolean {
  return BackgroundService.isRunning() && currentState.isRunning;
}
