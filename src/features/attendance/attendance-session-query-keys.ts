export const attendanceSessionQueryKeys = {
  all: ["attendance-session"] as const,
  active: (scheduleId: number) =>
    [...attendanceSessionQueryKeys.all, "active", scheduleId] as const,
  studentsBySession: (sessionId: number) =>
    [...attendanceSessionQueryKeys.all, "students", "session", sessionId] as const,
  studentsBySchedule: (scheduleId: number) =>
    [...attendanceSessionQueryKeys.all, "students", "schedule", scheduleId] as const,
};

