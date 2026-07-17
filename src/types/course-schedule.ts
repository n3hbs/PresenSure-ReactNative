export type ApiCourseScheduleItem = {
  user_course_block_id?: number;
  assigned_at?: string;
  course_block: {
    course_block_id: number;
    block_code: string;
    course: {
      course_id: number;
      subject_code: string;
      name: string;
    };
    semester?: {
      semester_id: number;
      term: string;
      semester_start: string;
      semester_end: string;
    };
    schedules: {
      schedule_id: number;
      period_id?: number | null;
      block_code: string;
      schedule_type?: string | null;
      start_time: string;
      end_time: string;
      days: string[] | string;
      room: {
        room_id: number;
        name: string;
        floor_no: number;
        building: {
          building_id: number;
          code: string;
          name: string;
        };
      } | null;
    }[];
  };
};

export type CourseSchedule = {
  id: string | number;
  period_id?: string | number | null;
  course_id?: string | number;
  course_code?: string;
  course_name?: string;
  section?: string;
  room?: string;
  schedule_type?: string | null;
  day?: string;
  days?: string[] | string;
  start_time?: string;
  end_time?: string;
  semester?: string;
  semester_start?: string;
  semester_end?: string;
};

export type CourseSchedulesResponse =
  | ApiCourseScheduleItem[]
  | CourseSchedule[]
  | {
      message?: string;
      data: ApiCourseScheduleItem[] | CourseSchedule[];
    };
