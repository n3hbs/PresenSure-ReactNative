import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/app/providers/theme-provider';
import type { AttendanceSession } from '@/types/attendance-session';
import type { CourseSchedule } from '@/types/course-schedule';
import { isScheduleActive } from '@/utils/schedule-time';

export function StudentScheduleDetail({
  activeSession,
  schedule,
}: {
  activeSession: AttendanceSession | null;
  schedule: CourseSchedule;
}) {
  const theme = useAppTheme();
  const activeNow = isScheduleActive(schedule);
  const canVerify = activeSession !== null;

  return (
    <View
      className="mx-4 mt-0.5 items-center rounded-[20px] border p-6 shadow-md shadow-slate-900/10"
      style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
      <Ionicons
        name={canVerify ? 'radio-outline' : 'time-outline'}
        size={42}
        color={canVerify ? theme.colors.primary : theme.colors.border}
      />
      <Text className="mt-3 text-lg font-black" style={{ color: theme.colors.text }}>
        {canVerify
          ? 'Ready to Verify'
          : activeNow
            ? 'Attendance Not Started'
            : 'BLE Features Unavailable'}
      </Text>
      <Text className="mt-[7px] text-center text-sm font-extrabold" style={{ color: theme.colors.primary }}>
        {canVerify
          ? `Session ${activeSession.session_code} is active. Scan for the instructor attendance signal.`
          : activeNow
            ? 'Waiting for the instructor to start an attendance session.'
            : 'Available during scheduled class time.'}
      </Text>
    </View>
  );
}
