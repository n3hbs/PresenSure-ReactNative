import { isAxiosError } from 'axios';

import { apiClient } from '@/api/client';
import type {
  ApiCourseScheduleItem,
  CourseSchedule,
  CourseSchedulesResponse,
} from '@/types/course-schedule';

function isApiCourseScheduleItem(value: unknown): value is ApiCourseScheduleItem {
  return (
    typeof value === 'object' &&
    value !== null &&
    'course_block' in value &&
    typeof (value as ApiCourseScheduleItem).course_block === 'object'
  );
}

function normalizeCourseSchedules(
  items: (ApiCourseScheduleItem | CourseSchedule)[],
): CourseSchedule[] {
  return items.flatMap((item) => {
    if (!isApiCourseScheduleItem(item)) return item;

    const { course_block: courseBlock } = item;

    return courseBlock.schedules.map<CourseSchedule>((schedule) => ({
      id: schedule.schedule_id,
      period_id: schedule.period_id ?? null,
      course_id: courseBlock.course.course_id,
      course_code: courseBlock.course.subject_code,
      course_name: courseBlock.course.name,
      section: courseBlock.block_code,
      room_id: schedule.room?.room_id ?? null,
      room: schedule.room ? schedule.room.name : 'Room not set',
      schedule_type: schedule.schedule_type,
      days: schedule.days,
      start_time: schedule.start_time,
      end_time: schedule.end_time,
      semester: courseBlock.semester?.term,
      semester_start: courseBlock.semester?.semester_start,
      semester_end: courseBlock.semester?.semester_end,
    }));
  });
}

export async function getCourseSchedules(userId: string): Promise<CourseSchedule[]> {
  try {
    const response = await apiClient.get<CourseSchedulesResponse>(
      `api/user/${encodeURIComponent(userId)}/course-schedules`,
    );

    const schedules = Array.isArray(response.data) ? response.data : response.data.data;

    return normalizeCourseSchedules(schedules as (ApiCourseScheduleItem | CourseSchedule)[]);
  } catch (error) {
    if (isAxiosError(error)) {
      const message =
        typeof error.response?.data?.message === 'string'
          ? error.response.data.message
          : 'Unable to load course schedules.';
      throw new Error(message);
    }

    throw error;
  }
}
