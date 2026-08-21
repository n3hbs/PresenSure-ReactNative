import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

import type {
  AttendanceRecordCreatedPayload,
  AttendanceSessionMonitorCallbacks,
  AttendanceSessionStatusUpdatedPayload,
} from '@/types/websocket';
import { logError } from '@/utils/logger';

// Assign Pusher for environments where it may be looked up on global or window
if (typeof globalThis !== 'undefined') {
  (globalThis as any).Pusher = Pusher;
}
if (typeof window !== 'undefined') {
  (window as any).Pusher = Pusher;
}

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.12:8000';
const DEFAULT_REVERB_KEY = process.env.EXPO_PUBLIC_REVERB_APP_KEY || 'presensure_key';
const DEFAULT_REVERB_HOST = process.env.EXPO_PUBLIC_REVERB_HOST || '192.168.1.12';
const DEFAULT_REVERB_PORT = Number(process.env.EXPO_PUBLIC_REVERB_PORT || 8080);

function getAuthEndpoint(): string {
  const normalizedApi = DEFAULT_API_URL.replace(/\/+$/, '');
  return `${normalizedApi}/api/broadcasting/auth`;
}

let echoInstance: Echo<'reverb'> | null = null;
let currentAuthToken: string | null = null;

/**
 * Creates or retrieves the singleton Laravel Echo instance configured for Laravel Reverb.
 */
export function getEchoInstance(token: string | null = null): Echo<'reverb'> | null {
  if (!token && !currentAuthToken) {
    return echoInstance;
  }

  const activeToken = token ?? currentAuthToken;

  // If the token changed or instance not created yet, re-instantiate Echo
  if (!echoInstance || (token && token !== currentAuthToken)) {
    if (echoInstance) {
      try {
        echoInstance.disconnect();
      } catch (err) {
        logError('echo.disconnect', err);
      }
    }

    currentAuthToken = activeToken;

    echoInstance = new Echo({
      broadcaster: 'reverb',
      Pusher: Pusher as any,
      key: DEFAULT_REVERB_KEY,
      wsHost: DEFAULT_REVERB_HOST,
      wsPort: DEFAULT_REVERB_PORT,
      wssPort: DEFAULT_REVERB_PORT,
      forceTLS: false,
      enabledTransports: ['ws'],
      authEndpoint: getAuthEndpoint(),
      auth: {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          Accept: 'application/json',
        },
      },
    });
  }

  return echoInstance;
}

/**
 * Disconnects and destroys the active Echo connection (e.g. on logout).
 */
export function disconnectEcho() {
  if (echoInstance) {
    try {
      echoInstance.disconnect();
    } catch (err) {
      logError('echo.disconnect', err);
    }
    echoInstance = null;
  }
  currentAuthToken = null;
}

/**
 * Subscribes to the private channel attendance.session.{sessionId}
 * and listens for .AttendanceRecordCreated and .AttendanceSessionStatusUpdated.
 *
 * @returns Unsubscribe function
 */
export function subscribeToAttendanceSession(
  sessionId: number | string,
  token: string,
  callbacks?: AttendanceSessionMonitorCallbacks,
): () => void {
  const echo = getEchoInstance(token);
  if (!echo) {
    logError('echo.subscribe', new Error('Echo instance could not be initialized (no auth token).'));
    return () => {};
  }

  const channelName = `attendance.session.${sessionId}`;
  const channel = echo.private(channelName);

  if (callbacks?.onSubscribed) {
    channel.subscribed(() => {
      callbacks.onSubscribed?.();
    });
  }

  if (callbacks?.onError) {
    channel.error((error: any) => {
      logError('echo.channel.error', error, { channelName });
      callbacks.onError?.(error);
    });
  }

  if (callbacks?.onRecordCreated) {
    channel.listen('.AttendanceRecordCreated', (event: AttendanceRecordCreatedPayload) => {
      callbacks.onRecordCreated?.(event);
    });
  }

  if (callbacks?.onStatusUpdated) {
    channel.listen('.AttendanceSessionStatusUpdated', (event: AttendanceSessionStatusUpdatedPayload) => {
      callbacks.onStatusUpdated?.(event);
    });
  }

  return () => {
    try {
      channel.stopListening('.AttendanceRecordCreated');
      channel.stopListening('.AttendanceSessionStatusUpdated');
      echo.leave(channelName);
    } catch (err) {
      logError('echo.unsubscribe', err, { channelName });
    }
  };
}
