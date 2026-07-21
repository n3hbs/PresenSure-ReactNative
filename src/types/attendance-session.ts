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

export type Esp32StartSessionCommand = Esp32BeaconConfiguration & {
  command: 'START_SESSION';
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
    ble_token: string;
    beacon_configuration: Esp32BeaconConfiguration;
  };
};

export type LegacyEsp32ConfigurationStatus = {
  code: number;
  status: string;
  active: boolean;
  configured?: boolean;
  epoch?: number;
};

export type Esp32SessionStatus = {
  success: boolean;
  session_id?: string;
  device_id?: string;
  advertising: boolean;
  started_at?: number;
  error_code?: string | null;
  message?: string;
};

export type Esp32ConfigurationStatus =
  | LegacyEsp32ConfigurationStatus
  | Esp32SessionStatus;
