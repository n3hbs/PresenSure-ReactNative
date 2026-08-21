export type StudentEventDetails = {
  id?: number | string;
  user_id?: string;
  student_id?: string | number;
  full_name?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  middle_initial?: string;
  suffix?: string;
  profile_picture?: string | null;
  avatar?: string | null;
  imagelink?: string | null;
  image_link?: string | null;
  email?: string | null;
  user_profile?: {
    imagelink?: string | null;
    image_link?: string | null;
    avatar?: string | null;
  };
  student?: {
    id?: number | string;
    student_id?: string | number;
    program?: any;
    [key: string]: any;
  };
  [key: string]: any;
};

export type AttendanceRecordCreatedPayload = {
  attendance_record_id: number;
  attendance_session_id: number;
  student_id: string;
  student?: StudentEventDetails;
  full_name?: string;
  profile_picture?: string | null;
  presence_verified: boolean;
  face_verified: boolean;
  face_verified_at: string | null;
  verified_at: string;
  status: 'present' | 'late' | 'absent' | string;
  rssi?: number | null;
  schedule_id?: number;
  [key: string]: any;
};

export type AttendanceSessionStatusUpdatedPayload = {
  attendance_session_id: number;
  session_code?: string;
  schedule_id?: number;
  status: 'active' | 'paused' | 'ended' | string;
  start_at?: string;
  end_at?: string;
  duration_minutes?: number;
  remaining_seconds?: number;
  continuous_checking?: boolean;
  verification_mode?: string;
  message?: string;
  [key: string]: any;
};

export type AttendanceSessionMonitorCallbacks = {
  onRecordCreated?: (payload: AttendanceRecordCreatedPayload) => void;
  onStatusUpdated?: (payload: AttendanceSessionStatusUpdatedPayload) => void;
  onSubscribed?: () => void;
  onError?: (error: any) => void;
};
