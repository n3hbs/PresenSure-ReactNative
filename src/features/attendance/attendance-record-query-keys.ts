export const attendanceRecordQueryKeys = {
  all: ['attendance-record'] as const,
  check: (scheduleId: number) => [...attendanceRecordQueryKeys.all, 'check', scheduleId] as const,
};
