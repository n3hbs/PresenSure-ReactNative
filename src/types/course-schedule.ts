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
  room_id?: string | number | null;
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

export type ScheduleStudent = {
  user_id?: string;
  id?: string | number;
  student_id?: string | number;
  first_name?: string;
  middle_initial?: string | null;
  last_name?: string;
  suffix?: string | null;
  full_name?: string;
  name?: string;
  email?: string;
  student_number?: string;
  sex?: string;

  // Support nested user object from backend ActiveSemesterStudentListResource
  user?: {
    user_id?: string;
    first_name?: string;
    middle_initial?: string | null;
    last_name?: string;
    suffix?: string | null;
    sex?: string;
    email?: string;
  } | null;

  // Support nested student array/object
  student?: Array<{
    student_id?: number | string;
    year?: string;
    block?: string;
    status?: string;
    program?: {
      program_id?: number;
      program_code?: string;
      program_name?: string;
      code?: string;
      name?: string;
    } | null;
  }> | {
    student_id?: number | string;
    year?: string;
    block?: string;
    status?: string;
    program?: {
      program_id?: number;
      program_code?: string;
      program_name?: string;
      code?: string;
      name?: string;
    } | null;
  } | null;

  // Support nested profile object
  profile?: {
    imagelink?: string | null;
    image_link?: string | null;
    avatar?: string | null;
  } | null;

  role?: {
    role_id?: number;
    role_name?: string;
  } | null;

  program?: string | {
    program_id?: number;
    program_code?: string;
    program_name?: string;
    code?: string;
    name?: string;
    title?: string;
  } | null;
  user_profile?: {
    imagelink?: string | null;
    image_link?: string | null;
    avatar?: string | null;
  } | null;
  profile_image?: string | null;
  imagelink?: string | null;
  avatar?: string | null;
  image?: string | null;
};


export type ScheduleStudentListData = {
  students: ScheduleStudent[];
  student_count: number;
  students_without_profile_image_count: number;
};

export type ScheduleStudentListResponse = {
  success?: boolean;
  message?: string;
  data: ScheduleStudentListData;
};

