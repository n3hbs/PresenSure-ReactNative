import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

import { apiClient } from '@/api/client';
import type {
  AttendanceRecordCreatedPayload,
  AttendanceSessionMonitorCallbacks,
  AttendanceSessionStatusUpdatedPayload,
} from '@/types/websocket';
import { logError } from '@/utils/logger';


function getEchoClass(): any {
  if (typeof Echo === 'function') return Echo;
  if (typeof (Echo as any)?.default === 'function') return (Echo as any).default;
  if (typeof (Echo as any)?.Echo === 'function') return (Echo as any).Echo;
  return Echo;
}

function getPusherClass(): any {
  if (typeof Pusher === 'function') return Pusher;
  if (typeof (Pusher as any)?.default === 'function') return (Pusher as any).default;
  if (typeof (Pusher as any)?.Pusher === 'function') return (Pusher as any).Pusher;
  return Pusher;
}

// Assign Pusher for environments where it may be looked up on global or window
const ResolvedPusher = getPusherClass();
if (ResolvedPusher) {
  try {
    ResolvedPusher.logToConsole = true;
    ResolvedPusher.log = (msg: string) => {
      console.log('📡 [Pusher JS]', msg);
    };
  } catch {
    // Ignore logger setup failure
  }
}

if (typeof globalThis !== 'undefined') {
  (globalThis as any).Pusher = ResolvedPusher;
}
if (typeof window !== 'undefined') {
  (window as any).Pusher = ResolvedPusher;
}

const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.12:8000';
const DEFAULT_REVERB_KEY = process.env.EXPO_PUBLIC_REVERB_APP_KEY || 'presensure_key';
const DEFAULT_REVERB_HOST = process.env.EXPO_PUBLIC_REVERB_HOST || '192.168.1.12';
const DEFAULT_REVERB_PORT = Number(process.env.EXPO_PUBLIC_REVERB_PORT || 8080);

function getAuthEndpoint(): string {
  const normalizedApi = DEFAULT_API_URL.replace(/\/+$/, '');
  return `${normalizedApi}/api/broadcasting/auth`;
}

let echoInstance: any = null;
let currentAuthToken: string | null = null;

/**
 * Creates or retrieves the singleton Laravel Echo instance configured for Laravel Reverb.
 */
export function getEchoInstance(token: string | null = null): any {
  if (!token && !currentAuthToken) {
    return echoInstance;
  }

  const activeToken = token ?? currentAuthToken;

  // If the token changed or instance not created yet, re-instantiate Echo
  if (!echoInstance || (token && token !== currentAuthToken)) {
    if (echoInstance) {
      try {
        console.log('📡 [Echo] Disconnecting previous Echo instance before re-instantiating');
        echoInstance.disconnect();
      } catch (err) {
        logError('echo.disconnect', err);
      }
    }

    currentAuthToken = activeToken;

    const EchoConstructor = getEchoClass();
    const PusherConstructor = getPusherClass();

    console.log('📡 [Echo] Initializing Echo with Reverb:', {
      wsHost: DEFAULT_REVERB_HOST,
      wsPort: DEFAULT_REVERB_PORT,
      key: DEFAULT_REVERB_KEY,
      authEndpoint: getAuthEndpoint(),
      hasToken: Boolean(activeToken),
    });

    // Custom authorizer using apiClient to guarantee proper Bearer token headers and React Native compatibility
    const customAuthorizer = (channel: any) => {
      return {
        authorize: (socketId: string, callback: (error: any, authData?: any) => void) => {
          console.log(`📡 [Pusher Auth] Requesting auth for channel "${channel.name}" (Socket ID: ${socketId})`);

          apiClient
            .post('api/broadcasting/auth', {
              socket_id: socketId,
              channel_name: channel.name,
            })
            .then((response) => {
              console.log(`✅ [Pusher Auth] Successfully authorized channel "${channel.name}"`, response.data);
              callback(null, response.data);
            })
            .catch((authError) => {
              console.error(`❌ [Pusher Auth] Failed to authorize channel "${channel.name}"`, authError?.response?.data || authError?.message);
              logError('echo.authorizer.error', authError, {
                channelName: channel.name,
                socketId,
              });
              callback(authError);
            });
        },
      };
    };

    echoInstance = new EchoConstructor({
      broadcaster: 'reverb',
      Pusher: PusherConstructor,
      key: DEFAULT_REVERB_KEY,
      wsHost: DEFAULT_REVERB_HOST,
      wsPort: DEFAULT_REVERB_PORT,
      wssPort: DEFAULT_REVERB_PORT,
      forceTLS: false,
      disableStats: true,
      enabledTransports: ['ws', 'wss'],
      authorizer: customAuthorizer,
      authEndpoint: getAuthEndpoint(),
      auth: {
        headers: {
          Authorization: `Bearer ${activeToken}`,
          Accept: 'application/json',
        },
      },
    });

    // Bind connection lifecycle logs
    try {
      const pusherClient = echoInstance.connector?.pusher;
      if (pusherClient?.connection) {
        pusherClient.connection.bind('state_change', (states: any) => {
          console.log(`📡 [Pusher Connection] State changed: ${states.previous} ➔ ${states.current}`);
        });
        pusherClient.connection.bind('connected', () => {
          console.log(`✅ [Pusher Connection] Connected successfully! Socket ID: ${pusherClient.connection.socket_id}`);
        });
        pusherClient.connection.bind('error', (err: any) => {
          console.error('❌ [Pusher Connection] Error:', err);
        });
        pusherClient.connection.bind('disconnected', () => {
          console.log('📡 [Pusher Connection] Disconnected.');
        });
      }
    } catch (bindErr) {
      console.log('📡 [Pusher Connection] Could not attach connection state logger:', bindErr);
    }
  }

  return echoInstance;
}

/**
 * Disconnects and destroys the active Echo connection (e.g. on logout).
 */
export function disconnectEcho() {
  if (echoInstance) {
    try {
      console.log('📡 [Echo] Disconnecting Echo connection');
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
    console.error('❌ [Echo] Echo instance could not be initialized (no auth token).');
    logError('echo.subscribe', new Error('Echo instance could not be initialized (no auth token).'));
    return () => {};
  }

  const channelName = `attendance.session.${sessionId}`;
  console.log(`📡 [Echo] Subscribing to private channel: private-${channelName}`);
  const channel = echo.private(channelName);

  if (callbacks?.onSubscribed) {
    channel.subscribed(() => {
      console.log(`✅ [Echo] Subscribed successfully to channel: private-${channelName}`);
      callbacks.onSubscribed?.();
    });
  }

  if (callbacks?.onError) {
    channel.error((error: any) => {
      console.error(`❌ [Echo] Channel subscription error on private-${channelName}:`, error);
      logError('echo.channel.error', error, { channelName });
      callbacks.onError?.(error);
    });
  }

  // Handle record created with both event name variations and global event listener
  const handleRecordCreated = (event: AttendanceRecordCreatedPayload) => {
    console.log('🔔 [Echo Event Received] AttendanceRecordCreated:', {
      record_id: event.attendance_record_id,
      session_id: event.attendance_session_id,
      student_id: event.student_id,
      status: event.status,
      presence_verified: event.presence_verified,
      face_verified: event.face_verified,
      verified_at: event.verified_at,
    });
    callbacks?.onRecordCreated?.(event);
  };

  channel.listen('.AttendanceRecordCreated', (event: AttendanceRecordCreatedPayload) => {
    console.log('📡 [Echo Listener] .AttendanceRecordCreated caught:', event);
    handleRecordCreated(event);
  });
  channel.listen('AttendanceRecordCreated', (event: AttendanceRecordCreatedPayload) => {
    console.log('📡 [Echo Listener] AttendanceRecordCreated caught:', event);
    handleRecordCreated(event);
  });
  channel.listen('App\\Events\\AttendanceRecordCreated', (event: AttendanceRecordCreatedPayload) => {
    console.log('📡 [Echo Listener] App\\Events\\AttendanceRecordCreated caught:', event);
    handleRecordCreated(event);
  });

  if (callbacks?.onStatusUpdated) {
    channel.listen('.AttendanceSessionStatusUpdated', (event: AttendanceSessionStatusUpdatedPayload) => {
      console.log('🔔 [Echo Event] AttendanceSessionStatusUpdated:', event);
      callbacks.onStatusUpdated?.(event);
    });
    channel.listen('AttendanceSessionStatusUpdated', (event: AttendanceSessionStatusUpdatedPayload) => {
      console.log('🔔 [Echo Event] AttendanceSessionStatusUpdated:', event);
      callbacks.onStatusUpdated?.(event);
    });
    channel.listen('App\\Events\\AttendanceSessionStatusUpdated', (event: AttendanceSessionStatusUpdatedPayload) => {
      console.log('🔔 [Echo Event] App\\Events\\AttendanceSessionStatusUpdated:', event);
      callbacks.onStatusUpdated?.(event);
    });
  }

  // Catch-all listener to ensure no events are dropped regardless of broadcast formatting
  if (typeof channel.listenToAll === 'function') {
    channel.listenToAll((eventName: string, data: any) => {
      console.log(`📡 [Echo listenToAll] Event received: "${eventName}"`, data);
      if (
        eventName.includes('AttendanceRecordCreated') ||
        (data && data.attendance_record_id && data.student_id)
      ) {
        handleRecordCreated(data);
      } else if (
        eventName.includes('AttendanceSessionStatusUpdated') &&
        callbacks?.onStatusUpdated
      ) {
        callbacks.onStatusUpdated(data);
      }
    });
  }

  return () => {
    console.log(`📡 [Echo] Unsubscribing from channel: private-${channelName}`);
    try {
      channel.stopListening('.AttendanceRecordCreated');
      channel.stopListening('AttendanceRecordCreated');
      channel.stopListening('App\\Events\\AttendanceRecordCreated');
      channel.stopListening('.AttendanceSessionStatusUpdated');
      channel.stopListening('AttendanceSessionStatusUpdated');
      channel.stopListening('App\\Events\\AttendanceSessionStatusUpdated');
      if (typeof channel.stopListeningToAll === 'function') {
        channel.stopListeningToAll();
      }
      echo.leave(channelName);
    } catch (err) {
      logError('echo.unsubscribe', err, { channelName });
    }
  };
}



