import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/app/providers/theme-provider';
import { useAuth } from '@/context/auth-context';
import { InstructorScheduleDetail } from '@/features/attendance/components/instructor-schedule-detail';
import { ScheduleDetailHeader } from '@/features/attendance/components/schedule-detail-header';
import { StudentScheduleDetail } from '@/features/attendance/components/student-schedule-detail';
import type { CourseSchedule } from '@/types/course-schedule';

function parseSchedule(value: string | string[] | undefined): CourseSchedule | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue) as CourseSchedule;
  } catch {
    return null;
  }
}

function canManageAttendance(roleName?: string) {
  const normalizedRole = roleName?.trim().toLowerCase() ?? '';

  return normalizedRole.includes('instructor') || normalizedRole.includes('administrator');
}

export default function ScheduleDetailScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ schedule?: string }>();
  const schedule = useMemo(() => parseSchedule(params.schedule), [params.schedule]);
  const roleName = user?.role?.role_name;

  if (!schedule) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
        <View className="flex-1 items-center justify-center px-7">
          <Ionicons name="calendar-clear-outline" size={42} color={theme.colors.textMuted} />
          <Text className="mt-3 text-lg font-black" style={{ color: theme.colors.text }}>
            Schedule unavailable
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }} showsVerticalScrollIndicator={false}>
        <ScheduleDetailHeader schedule={schedule} />
        {canManageAttendance(roleName) ? (
          <InstructorScheduleDetail schedule={schedule} />
        ) : (
          <StudentScheduleDetail schedule={schedule} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
