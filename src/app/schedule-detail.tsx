import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/app/providers/theme-provider';
import { useAuth } from '@/context/auth-context';
import { attendanceSessionQueryKeys } from '@/features/attendance/attendance-session-query-keys';
import { ActiveAttendanceSessionCard } from '@/features/attendance/components/active-attendance-session-card';
import { InstructorScheduleDetail } from '@/features/attendance/components/instructor-schedule-detail';
import { ScheduleDetailHeader } from '@/features/attendance/components/schedule-detail-header';
import { StudentScheduleDetail } from '@/features/attendance/components/student-schedule-detail';
import { getActiveAttendanceSession } from '@/services/attendance-session-service';
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

function getScheduleId(schedule: CourseSchedule | null) {
  if (!schedule) return null;
  const scheduleId = Number(schedule.id);
  return Number.isFinite(scheduleId) ? scheduleId : null;
}

export default function ScheduleDetailScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ schedule?: string }>();
  const schedule = useMemo(() => parseSchedule(params.schedule), [params.schedule]);
  const scheduleId = getScheduleId(schedule);
  const roleName = user?.role?.role_name;
  const {
    data: activeSession = null,
    error: activeSessionError,
    isLoading: isCheckingActiveSession,
    refetch: refetchActiveSession,
  } = useQuery({
    queryKey: attendanceSessionQueryKeys.active(scheduleId ?? 0),
    queryFn: () => getActiveAttendanceSession(scheduleId!),
    enabled: scheduleId !== null,
    refetchOnMount: 'always',
    staleTime: 0,
  });

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
        {scheduleId === null ? (
          <View className="mx-4 items-center rounded-[20px] border p-6" style={{ borderColor: theme.colors.border }}>
            <Ionicons name="alert-circle-outline" size={38} color={theme.colors.danger} />
            <Text className="mt-3 text-center text-base font-black" style={{ color: theme.colors.text }}>
              Schedule ID is unavailable
            </Text>
          </View>
        ) : isCheckingActiveSession ? (
          <View className="mx-4 items-center rounded-[20px] border p-6" style={{ borderColor: theme.colors.border }}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text className="mt-3 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
              Checking for an active attendance session
            </Text>
          </View>
        ) : activeSessionError ? (
          <View className="mx-4 items-center rounded-[20px] border p-6" style={{ borderColor: theme.colors.border }}>
            <Ionicons name="cloud-offline-outline" size={38} color={theme.colors.danger} />
            <Text className="mt-3 text-center text-base font-black" style={{ color: theme.colors.text }}>
              Unable to check attendance session
            </Text>
            <Text className="mt-2 text-center text-sm font-bold" style={{ color: theme.colors.textMuted }}>
              {activeSessionError instanceof Error
                ? activeSessionError.message
                : 'Please try again.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              className="mt-4 rounded-md px-5 py-3"
              onPress={() => void refetchActiveSession()}
              style={{ backgroundColor: theme.colors.primary }}
            >
              <Text className="font-black text-white">Try Again</Text>
            </Pressable>
          </View>
        ) : canManageAttendance(roleName) && activeSession ? (
          <ActiveAttendanceSessionCard schedule={schedule} session={activeSession} />
        ) : canManageAttendance(roleName) ? (
          <InstructorScheduleDetail schedule={schedule} />
        ) : (
          <StudentScheduleDetail activeSession={activeSession} schedule={schedule} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
