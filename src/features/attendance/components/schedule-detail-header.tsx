import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

import { useAppTheme } from '@/app/providers/theme-provider';
import type { CourseSchedule } from '@/types/course-schedule';
import { formatDays, formatTime } from '@/utils/schedule-time';

function formatScheduleType(type?: string | null) {
  if (!type) return 'Regular';
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

export function ScheduleDetailHeader({ schedule }: { schedule: CourseSchedule }) {
  const theme = useAppTheme();
  const scheduleTime = `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`;

  return (
    <View
      className="mb-4 rounded-b-[28px] px-6 pb-6 pt-[22px] shadow-lg shadow-slate-900/10"
      style={{ backgroundColor: theme.colors.surface }}>
      <View
        className="mb-3 h-[46px] w-[46px] items-center justify-center rounded-full"
        style={{ backgroundColor: theme.colors.primarySoft }}>
        <Ionicons name="book" size={24} color={theme.colors.primary} />
      </View>
      <View className="mb-3.5">
        <Text className="text-xs font-black uppercase tracking-[1.1px]" style={{ color: theme.colors.primary }}>
          {schedule.course_code ?? 'COURSE'}
        </Text>
        <Text className="mt-1 text-[22px] font-black" style={{ color: theme.colors.text }}>
          {schedule.course_name ?? 'No Subject'}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center">
        <Ionicons name="time-outline" size={16} color={theme.colors.textMuted} />
        <Text className="ml-2 flex-1 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
          {formatDays(schedule.days ?? schedule.day)} | {scheduleTime}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center">
        <Ionicons name="location-outline" size={16} color={theme.colors.textMuted} />
        <Text className="ml-2 flex-1 text-sm font-black" style={{ color: theme.colors.primary }}>
          Room: {schedule.room ?? 'Not set'}
        </Text>
      </View>

      <View className="mt-2 flex-row items-center">
        <Ionicons name="albums-outline" size={16} color={theme.colors.textMuted} />
        <Text className="ml-2 flex-1 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
          Type: {formatScheduleType(schedule.schedule_type)}
        </Text>
      </View>
    </View>
  );
}
