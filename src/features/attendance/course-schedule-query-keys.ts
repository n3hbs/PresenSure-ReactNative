export const courseScheduleQueryKeys = {
  all: ['course-schedule'] as const,
  students: (scheduleId: number) =>
    [...courseScheduleQueryKeys.all, 'students', scheduleId] as const,
};
