export type BleSourceType = 'instructor_phone' | 'external_beacon';

export type AttendanceSessionRequest = {
  schedule_id: number;
  period_id: number;
  verification_mode: 'ble_face';
  ble_source_type: BleSourceType;
  beacon_id: string | number | null;
};

export type AttendanceSession = {
  attendance_session_id: number;
  schedule_id: number;
  period_id: number;
  instructor_id: string;
  verification_mode: 'ble_face';
  ble_source_type: BleSourceType;
  beacon_id: string | number | null;
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
  };
};
