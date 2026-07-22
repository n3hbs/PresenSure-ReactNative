export type VerificationMode = 'ble' | 'face' | 'ble_face';

export type AttendanceSessionRequest = {
  schedule_id: number;
  device_id: string;
  verification_mode: VerificationMode;
  continuous_checking: boolean;
  requested_duration_minutes: number;
};

export type Esp32BeaconConfiguration = {
  session_code: string;
  attendance_type: 1 | 2 | 3;
  start_time: number;
  end_time: number;
  continuous: boolean;
  rotating_secret: string;
  signature: string;
  advertisement_interval_ms: number;
};

export type Esp32StartSessionCommand = {
  command: 'START_SESSION';
  session_id: string;
  schedule_id: number;
  subject_code: string;
  room_code: string;
  token: string;
  expires_at: number;
};

export type AttendanceSession = {
  attendance_session_id: number;
  session_code: string;
  schedule_id: number;
  period_id: number;
  instructor_id: string;
  ble_device_id: number;
  verification_mode: VerificationMode;
  ble_token_expires_at: string;
  requires_periodic_verification: boolean;
  status: 'active' | 'paused' | 'ended' | string;
  start_at: string;
  end_at: string;
  device_started_at: string | null;
  created_at: string;
  updated_at: string;
  ble_broadcast_token: string;
};

export type AttendanceSessionResponse = {
  message: string;
  data: {
    session: AttendanceSession;
    session_id?: string | number;
    ble_token: string;
    expires_at_timestamp?: number;
    beacon_configuration?: Esp32BeaconConfiguration;
  };
};

export type Esp32ConfigurationStatus = {
  status:
    | 'READY'
    | 'AUTHENTICATED'
    | 'SESSION_STARTED'
    | 'SESSION_STOPPED'
    | 'ERROR'
    | string;
  success?: boolean;
  session_id?: string;
  room_code?: string;
  code?: string;
  message?: string;
};
