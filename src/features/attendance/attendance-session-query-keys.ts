export const attendanceSessionQueryKeys = {
  all: ["attendance-session"] as const,
  active: (scheduleId: number) =>
    [...attendanceSessionQueryKeys.all, "active", scheduleId] as const,
};
