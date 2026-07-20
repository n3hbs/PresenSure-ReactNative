export type VerificationMode = 'ble' | 'face' | 'ble_face';
export type BleSourceType = 'none' | 'instructor_phone' | 'room_beacon';

export type AttendanceSessionRequest = {
  schedule_id: number;
  period_id: number;
  verification_mode: VerificationMode;
  ble_source_type: BleSourceType;
  beacon_id: string | number | null;
  requires_periodic_verification: boolean;
};

export type Esp32SessionConfiguration = {
  session_id: string;
  attendance_type: 1 | 2 | 3;
  start_time: number;
  end_time: number;
  continuous: boolean;
  rotating_secret: string;
  signature: string;
  advertisement_interval_ms: number;
};

export type AttendanceSession = {
  attendance_session_id: number;
  schedule_id: number;
  period_id: number;
  instructor_id: string;
  verification_mode: VerificationMode;
  ble_source_type: BleSourceType;
  beacon_id: string | number | null;
  requires_periodic_verification?: boolean;
  broadcaster_user_id: string | null;
  ble_broadcast_token: string;
  ble_token_expires_at: string;
  status: 'active' | 'paused' | 'ended' | string;
  start_at: string;
  end_at: string;
  created_at: string;
  updated_at: string;
};

export type AttendanceSessionResponse = {
  message: string;
  data: {
    session: AttendanceSession;
    ble_token: string;
    /** Signed by Laravel using the registered ESP32 device secret. */
    beacon_configuration?: Esp32SessionConfiguration;
  };
};
