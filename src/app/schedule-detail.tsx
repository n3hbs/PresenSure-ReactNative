import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/theme-provider';
import { useAuth } from '@/context/auth-context';
import { attendanceSessionQueryKeys } from '@/features/attendance/attendance-session-query-keys';
import { ActiveAttendanceSessionCard } from '@/features/attendance/components/active-attendance-session-card';
import { InstructorScheduleDetail } from '@/features/attendance/components/instructor-schedule-detail';
import { ScheduleDetailHeader } from '@/features/attendance/components/schedule-detail-header';
import { ScheduleStudentList } from '@/features/attendance/components/schedule-student-list';
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

function getManilaDateKey(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function isSessionFromToday(startAt: string) {
  return getManilaDateKey(startAt) === getManilaDateKey(new Date());
}

function isManageableSessionStatus(status: string) {
  const normalizedStatus = status.trim().toLowerCase();
  return normalizedStatus === 'active' || normalizedStatus === 'ended';
}

export default function ScheduleDetailScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ schedule?: string }>();
  const schedule = useMemo(() => parseSchedule(params.schedule), [params.schedule]);
  const scheduleId = getScheduleId(schedule);
  const roleName = user?.role?.role_name;
  const managesAttendance = canManageAttendance(roleName);

  const [activeTab, setActiveTab] = useState<'attendance' | 'students'>('attendance');

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
  const todaysInstructorSession =
    managesAttendance &&
    activeSession &&
    isSessionFromToday(activeSession.start_at) &&
    isManageableSessionStatus(activeSession.status)
      ? activeSession
      : null;


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
      <ScheduleDetailHeader schedule={schedule} />

      {/* Top Tab Bar: Attendance vs Students (Instructor only) */}
      {managesAttendance && (
        <View
          className="mx-4 mb-3.5 flex-row rounded-full p-1 border shadow-sm"
          style={{ backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTab('attendance')}
            className="flex-1 min-h-[38px] flex-row items-center justify-center rounded-full"
            style={{
              backgroundColor: activeTab === 'attendance' ? theme.colors.primary : 'transparent',
            }}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={activeTab === 'attendance' ? '#FFFFFF' : theme.colors.textMuted}
            />
            <Text
              className="ml-2 text-xs font-black"
              style={{ color: activeTab === 'attendance' ? '#FFFFFF' : theme.colors.textMuted }}>
              Attendance
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTab('students')}
            className="flex-1 min-h-[38px] flex-row items-center justify-center rounded-full"
            style={{
              backgroundColor: activeTab === 'students' ? theme.colors.primary : 'transparent',
            }}>
            <Ionicons
              name="people-outline"
              size={16}
              color={activeTab === 'students' ? '#FFFFFF' : theme.colors.textMuted}
            />
            <Text
              className="ml-2 text-xs font-black"
              style={{ color: activeTab === 'students' ? '#FFFFFF' : theme.colors.textMuted }}>
              Students
            </Text>
          </Pressable>
        </View>
      )}

      {/* Tab Content */}
      {activeTab === 'students' ? (
        scheduleId !== null ? (
          <ScheduleStudentList
            scheduleId={scheduleId}
            sessionId={todaysInstructorSession?.attendance_session_id ?? activeSession?.attendance_session_id}
            sessionStatus={todaysInstructorSession?.status ?? activeSession?.status}
          />
        ) : (
          <View className="mx-4 items-center rounded-[20px] border p-6" style={{ borderColor: theme.colors.border }}>
            <Ionicons name="alert-circle-outline" size={38} color={theme.colors.danger} />
            <Text className="mt-3 text-center text-base font-black" style={{ color: theme.colors.text }}>
              Schedule ID is unavailable
            </Text>
          </View>
        )
      ) : scheduleId !== null &&
        !isCheckingActiveSession &&
        !activeSessionError &&
        managesAttendance &&
        !todaysInstructorSession ? (
        <InstructorScheduleDetail schedule={schedule} />
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
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
          ) : activeSessionError && managesAttendance ? (
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
          ) : managesAttendance && todaysInstructorSession ? (
            <ActiveAttendanceSessionCard schedule={schedule} session={todaysInstructorSession} />
          ) : managesAttendance ? (
            <InstructorScheduleDetail schedule={schedule} />
          ) : (
            <StudentScheduleDetail activeSession={activeSession} schedule={schedule} />
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

