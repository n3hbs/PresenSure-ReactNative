import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { CourseSchedule } from '@/types/course-schedule';

const DAY_LABELS: Record<string, string> = {
  monday: 'Mon',
  mon: 'Mon',
  m: 'Mon',
  tuesday: 'Tue',
  tue: 'Tue',
  t: 'Tue',
  wednesday: 'Wed',
  wed: 'Wed',
  w: 'Wed',
  thursday: 'Thu',
  thu: 'Thu',
  th: 'Thu',
  friday: 'Fri',
  fri: 'Fri',
  f: 'Fri',
  saturday: 'Sat',
  sat: 'Sat',
  s: 'Sat',
  sunday: 'Sun',
  sun: 'Sun',
  su: 'Sun',
};

const DAY_SEQUENCE: Record<string, number> = {
  monday: 1,
  mon: 1,
  m: 1,
  tuesday: 2,
  tue: 2,
  t: 2,
  wednesday: 3,
  wed: 3,
  w: 3,
  thursday: 4,
  thu: 4,
  th: 4,
  friday: 5,
  fri: 5,
  f: 5,
  saturday: 6,
  sat: 6,
  s: 6,
  sunday: 7,
  sun: 7,
  su: 7,
};

function parseSchedule(value: string | string[] | undefined): CourseSchedule | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue) as CourseSchedule;
  } catch {
    return null;
  }
}

function formatTime(time?: string) {
  if (!time) return 'Not set';

  const [hourValue, minuteValue = '00'] = time.split(':');
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return time;

  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteValue.padStart(2, '0')} ${period}`;
}

function getDayLabel(day: string) {
  const normalized = day.trim().toLowerCase();
  return DAY_LABELS[normalized] ?? normalized.slice(0, 3).replace(/^\w/, (value) => value.toUpperCase());
}

function getDaySequence(day: string) {
  return DAY_SEQUENCE[day.trim().toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
}

function getDayValues(days: string) {
  const trimmedDays = days.trim();
  if (!trimmedDays) return [];
  if (/[\s,]+/.test(trimmedDays)) return trimmedDays.split(/[\s,]+/).filter(Boolean);
  return [trimmedDays];
}

function formatScheduleType(type?: string | null) {
  if (!type) return 'Regular';
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function formatDays(days?: string[] | string) {
  if (Array.isArray(days)) {
    return days.length > 0
      ? [...days].sort((first, second) => getDaySequence(first) - getDaySequence(second)).map(getDayLabel).join(' | ')
      : 'No days';
  }
  if (!days) return 'No days';

  const dayValues = getDayValues(days).sort((first, second) => getDaySequence(first) - getDaySequence(second));
  return dayValues.length > 0 ? dayValues.map(getDayLabel).join(' | ') : 'No days';
}

export default function ScheduleDetailScreen() {
  const params = useLocalSearchParams<{ schedule?: string }>();
  const schedule = useMemo(() => parseSchedule(params.schedule), [params.schedule]);

  if (!schedule) {
    return (
      <SafeAreaView className="flex-1 bg-[#F9FAFB]" edges={['top']}>
        <View className="flex-1 items-center justify-center px-7">
          <Ionicons name="calendar-clear-outline" size={42} color="#64748B" />
          <Text className="mt-3 text-lg font-black text-[#111827]">Schedule unavailable</Text>
        </View>
      </SafeAreaView>
    );
  }

  const scheduleTime = `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`;

  return (
    <SafeAreaView className="flex-1 bg-[#F9FAFB]" edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <View className="mb-4 rounded-b-[28px] bg-white px-6 pb-6 pt-[22px] shadow-lg shadow-slate-900/10">
          <View className="mb-3 h-[46px] w-[46px] items-center justify-center rounded-full bg-blue-100">
            <Ionicons name="book" size={24} color="#2563EB" />
          </View>
          <View className="mb-3.5">
            <Text className="text-xs font-black uppercase tracking-[1.1px] text-blue-600">
              {schedule.course_code ?? 'COURSE'}
            </Text>
            <Text className="mt-1 text-[22px] font-black text-[#111827]">
              {schedule.course_name ?? 'No Subject'}
            </Text>
          </View>

          <View className="mt-2 flex-row items-center">
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text className="ml-2 flex-1 text-sm font-bold text-[#4B5563]">
              {formatDays(schedule.days ?? schedule.day)} | {scheduleTime}
            </Text>
          </View>

          <View className="mt-2 flex-row items-center">
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text className="ml-2 flex-1 text-sm font-black text-blue-600">
              Room: {schedule.room ?? 'Not set'}
            </Text>
          </View>

          <View className="mt-2 flex-row items-center">
            <Ionicons name="albums-outline" size={16} color="#6B7280" />
            <Text className="ml-2 flex-1 text-sm font-bold text-[#4B5563]">
              Type: {formatScheduleType(schedule.schedule_type)}
            </Text>
          </View>
        </View>

        <View className="mx-4 mt-0.5 items-center rounded-[20px] border border-gray-200 bg-white p-6 shadow-md shadow-slate-900/10">
          <Ionicons name="time-outline" size={42} color="#CBD5E1" />
          <Text className="mt-3 text-lg font-black text-[#4B5563]">BLE Features Unavailable</Text>
          <Text className="mt-[7px] text-center text-sm font-extrabold text-blue-600">
            Available during scheduled class time.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
