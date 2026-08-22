import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '@/context/auth-context';
import { attendanceRecordQueryKeys } from '@/features/attendance/attendance-record-query-keys';
import { useAppTheme } from '@/providers/theme-provider';
import {
  getActiveAttendanceSessionStudents,
  getAttendanceSessionStudents,
} from '@/services/attendance-session-service';
import { getScheduleStudents } from '@/services/course-schedule-service';
import { subscribeToAttendanceSession } from '@/services/websocket/echo-service';
import type {
  AttendanceRecordSummary,
  AttendanceSessionStudentItem,
  AttendanceSessionSummary,
} from '@/types/attendance-session';
import type { ScheduleStudent } from '@/types/course-schedule';
import type { AttendanceRecordCreatedPayload } from '@/types/websocket';

type StatusFilter = 'all' | 'present' | 'late' | 'absent' | 'unmarked';

interface ScheduleStudentListProps {
  scheduleId: number;
  sessionId?: number | null;
  sessionStatus?: string | null;
}

function getStudentFullName(student: AttendanceSessionStudentItem | ScheduleStudent): string {
  if ('full_name' in student && student.full_name) return student.full_name;
  if ('name' in student && student.name) return student.name;

  const userObj = student.user || (student as any);
  const firstName = userObj?.first_name;
  const middleInitial = userObj?.middle_initial;
  const lastName = userObj?.last_name;
  const suffix = userObj?.suffix;

  const parts = [
    firstName,
    middleInitial ? `${middleInitial}.` : null,
    lastName,
    suffix,
  ].filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : 'Unnamed Student';
}

function getStudentInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'ST';
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function getStudentImageUri(student: AttendanceSessionStudentItem | ScheduleStudent): string | null {
  return (
    student.profile?.imagelink ||
    student.profile?.image_link ||
    student.profile?.avatar ||
    (student as any).imagelink ||
    (student as any).user_profile?.imagelink ||
    (student as any).user_profile?.image_link ||
    (student as any).user_profile?.avatar ||
    (student as any).profile_image ||
    (student as any).image ||
    (student as any).avatar ||
    null
  );
}

function getStudentIdentifier(student: AttendanceSessionStudentItem | ScheduleStudent): string {
  if (student.user?.user_id) return student.user.user_id;
  if ((student as any).user_id) return (student as any).user_id;
  if ((student as any).student_number) return (student as any).student_number;

  const studentProp = student.student;
  const studentObj = Array.isArray(studentProp) ? studentProp[0] : studentProp;
  if (studentObj?.student_id) return String(studentObj.student_id);

  if ((student as any).id !== undefined && (student as any).id !== null) {
    return String((student as any).id);
  }
  if ((student as any).student_id !== undefined && (student as any).student_id !== null) {
    return String((student as any).student_id);
  }

  return 'N/A';
}

function getProgramCode(student: AttendanceSessionStudentItem | ScheduleStudent): string | null {
  const studentProp = student.student;
  const studentObj = Array.isArray(studentProp) ? studentProp[0] : studentProp;
  const programObj =
    studentObj?.program ||
    (typeof (student as any).program === 'object' ? (student as any).program : null);

  if (!programObj && typeof (student as any).program === 'string') return (student as any).program;
  if (!programObj) return null;

  return (
    programObj.program_code ||
    programObj.code ||
    programObj.program_name ||
    programObj.name ||
    null
  );
}

function formatVerifiedTime(isoString?: string | null): string | null {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return null;

    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Manila',
    }).format(date);
  } catch {
    return null;
  }
}

function calculateSummary(students: AttendanceSessionStudentItem[]): AttendanceSessionSummary {
  const total = students.length;
  let present = 0;
  let late = 0;
  let absent = 0;
  let unmarked = 0;

  for (const s of students) {
    const st = (s.attendance_status || 'unmarked').toLowerCase();
    if (st === 'present') present++;
    else if (st === 'late') late++;
    else if (st === 'absent') absent++;
    else unmarked++;
  }

  return {
    total_students: total,
    present_count: present,
    late_count: late,
    absent_count: absent,
    unmarked_count: unmarked,
  };
}

export function ScheduleStudentList({
  scheduleId,
  sessionId,
  sessionStatus,
}: ScheduleStudentListProps) {
  const theme = useAppTheme();
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<StatusFilter>('all');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [recentCheckedInId, setRecentCheckedInId] = useState<string | null>(null);

  const clearHighlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch Attendance Session Student List or fallback to course schedule students
  const {
    data: fetchedData,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['attendance-session-students-list', scheduleId, sessionId],
    queryFn: async () => {
      console.log(`📋 [StudentList] Loading student list for Schedule ID: ${scheduleId}, Session ID: ${sessionId ?? 'none'}`);

      // 1. Try fetching by explicit sessionId if provided
      if (sessionId) {
        try {
          const sessionStudents = await getAttendanceSessionStudents(sessionId);
          if (sessionStudents && Array.isArray(sessionStudents.students)) {
            console.log(`📋 [StudentList] Loaded ${sessionStudents.students.length} students from Session ID: ${sessionId}`);
            return {
              sessionId: sessionStudents.session_id || sessionId,
              sessionStatus: sessionStudents.session_status || sessionStatus || 'active',
              summary: sessionStudents.summary || calculateSummary(sessionStudents.students),
              students: sessionStudents.students.map((s) => ({
                ...s,
                attendance_status: s.attendance_status || 'unmarked',
              })),
            };
          }
        } catch (fetchErr) {
          console.log(`⚠️ [StudentList] Session students fetch failed for Session ID ${sessionId}:`, fetchErr);
        }
      }

      // 2. Try fetching by active session for schedule
      try {
        const activeStudents = await getActiveAttendanceSessionStudents(scheduleId);
        if (activeStudents && Array.isArray(activeStudents.students)) {
          console.log(`📋 [StudentList] Loaded active session ${activeStudents.session_id} with ${activeStudents.students.length} students`);
          return {
            sessionId: activeStudents.session_id,
            sessionStatus: activeStudents.session_status || 'active',
            summary: activeStudents.summary || calculateSummary(activeStudents.students),
            students: activeStudents.students.map((s) => ({
              ...s,
              attendance_status: s.attendance_status || 'unmarked',
            })),
          };
        }
      } catch (activeErr) {
        console.log(`ℹ️ [StudentList] No active session found for Schedule ID ${scheduleId}`);
      }

      // 3. Fallback to enrolled course schedule student roster
      const rosterData = await getScheduleStudents(scheduleId);
      const rawStudents = rosterData.students || [];
      console.log(`📋 [StudentList] Loaded standard roster with ${rawStudents.length} students`);

      const normalizedStudents: AttendanceSessionStudentItem[] = rawStudents.map((s: any) => ({
        user: s.user || {
          user_id: s.user_id || s.student_number || String(s.id || ''),
          first_name: s.first_name || '',
          middle_initial: s.middle_initial || null,
          last_name: s.last_name || '',
          suffix: s.suffix || null,
          sex: s.sex || null,
          email: s.email || null,
        },
        student: s.student || [],
        role: s.role || null,
        profile: s.profile || s.user_profile || null,
        attendance_status: s.attendance_status || 'unmarked',
        attendance_record: s.attendance_record || null,
      }));

      return {
        sessionId: null,
        sessionStatus: null,
        summary: calculateSummary(normalizedStudents),
        students: normalizedStudents,
      };
    },
    enabled: scheduleId > 0,
    staleTime: 1000 * 15,
  });

  const students = useMemo(() => fetchedData?.students ?? [], [fetchedData?.students]);
  const activeSummary = useMemo(() => fetchedData?.summary ?? calculateSummary(students), [fetchedData?.summary, students]);
  const effectiveSessionId = fetchedData?.sessionId || sessionId;

  // Synchronize WebSocket real-time check-in updates
  useEffect(() => {
    console.log(`📡 [StudentList] WebSocket effect triggered. Effective Session ID: ${effectiveSessionId ?? 'none'}, Has Token: ${Boolean(token)}`);

    if (!effectiveSessionId || !token) {
      return;
    }

    const unsubscribe = subscribeToAttendanceSession(effectiveSessionId, token, {
      onSubscribed: () => {
        console.log(`🟢 [StudentList] Live WebSocket active on session: ${effectiveSessionId}`);
        setIsWsConnected(true);
      },
      onError: () => {
        console.log(`🔴 [StudentList] WebSocket connection error on session: ${effectiveSessionId}`);
        setIsWsConnected(false);
      },
      onRecordCreated: (event: AttendanceRecordCreatedPayload) => {
        const targetId = String(event.student_id || '').trim().toLowerCase();
        const targetUserId = String(event.student?.user_id || event.student_id || '').trim().toLowerCase();
        const targetStudentId = String(event.student?.student_id || event.student_id || '').trim().toLowerCase();

        console.log(`🔔 [StudentList] Received attendance check-in event for student:`, {
          targetId,
          targetUserId,
          targetStudentId,
          status: event.status,
        });

        queryClient.setQueryData(
          ['attendance-session-students-list', scheduleId, sessionId],
          (prevData: any) => {
            if (!prevData || !Array.isArray(prevData.students)) return prevData;

            let matchedCount = 0;

            const nextList = prevData.students.map((item: AttendanceSessionStudentItem) => {
              const userId = String(item.user?.user_id || (item as any).user_id || '').trim().toLowerCase();
              const studentProp = item.student;
              const studentObj = Array.isArray(studentProp) ? studentProp[0] : studentProp;
              const studentId = String(studentObj?.student_id || (item as any).student_id || '').trim().toLowerCase();
              const rawId = String((item as any).id || '').trim().toLowerCase();
              const studentNumber = String((item as any).student_number || '').trim().toLowerCase();
              const fullName = getStudentFullName(item).trim().toLowerCase();

              const isMatch =
                (userId && (userId === targetId || userId === targetUserId || userId === targetStudentId)) ||
                (studentId && (studentId === targetId || studentId === targetUserId || studentId === targetStudentId)) ||
                (rawId && (rawId === targetId || rawId === targetUserId || rawId === targetStudentId)) ||
                (studentNumber && (studentNumber === targetId || studentNumber === targetUserId)) ||
                (event.student?.full_name && fullName === String(event.student.full_name).trim().toLowerCase());

              if (isMatch) {
                matchedCount++;
                const newRecord: AttendanceRecordSummary = {
                  attendance_record_id: event.attendance_record_id,
                  attendance_session_id: event.attendance_session_id,
                  status: event.status || 'present',
                  presence_verified: Boolean(event.presence_verified),
                  face_verified: Boolean(event.face_verified),
                  face_verified_at: event.face_verified_at || null,
                  verified_at: event.verified_at || new Date().toISOString(),
                  rssi: event.rssi ?? null,
                };

                console.log(`✅ [StudentList] Matched student "${fullName}" (${userId || studentId}) -> status: ${event.status || 'present'}`);

                return {
                  ...item,
                  attendance_status: event.status || 'present',
                  attendance_record: newRecord,
                };
              }
              return item;
            });

            if (matchedCount === 0) {
              console.warn(`⚠️ [StudentList] No student in list matched check-in event for ID "${targetId}"`);
            }

            return {
              ...prevData,
              summary: calculateSummary(nextList),
              students: nextList,
            };
          }
        );


        // Highlight the student who just checked in
        if (event.student_id) {
          setRecentCheckedInId(String(event.student_id));
          if (clearHighlightTimerRef.current) {
            clearTimeout(clearHighlightTimerRef.current);
          }
          clearHighlightTimerRef.current = setTimeout(() => {
            setRecentCheckedInId(null);
          }, 4500);
        }

        queryClient.invalidateQueries({
          queryKey: attendanceRecordQueryKeys.check(scheduleId),
        });
      },
    });

    return () => {
      unsubscribe();
      setIsWsConnected(false);
      if (clearHighlightTimerRef.current) {
        clearTimeout(clearHighlightTimerRef.current);
      }
    };
  }, [effectiveSessionId, token, scheduleId, sessionId, queryClient]);

  // Filter and search
  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return students.filter((student) => {
      const itemStatus = (student.attendance_status || 'unmarked').toLowerCase();

      // Filter by status tab
      if (selectedFilter !== 'all') {
        if (selectedFilter === 'unmarked') {
          if (itemStatus !== 'unmarked' && itemStatus !== '') return false;
        } else if (itemStatus !== selectedFilter) {
          return false;
        }
      }

      // Search Query filter
      if (!query) return true;

      const fullName = getStudentFullName(student).toLowerCase();
      const idStr = getStudentIdentifier(student).toLowerCase();
      const email = ((student.user?.email || (student as any).email) ?? '').toLowerCase();
      const program = (getProgramCode(student) ?? '').toLowerCase();

      return (
        fullName.includes(query) ||
        idStr.includes(query) ||
        email.includes(query) ||
        program.includes(query)
      );
    });
  }, [students, searchQuery, selectedFilter]);

  if (isLoading && students.length === 0) {
    return (
      <View
        className="mx-4 items-center rounded-[20px] border p-8"
        style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text className="mt-3 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
          Loading students & attendance status...
        </Text>
      </View>
    );
  }

  if (error && students.length === 0) {
    return (
      <View
        className="mx-4 items-center rounded-[20px] border p-6"
        style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.colors.danger} />
        <Text className="mt-3 text-center text-base font-black" style={{ color: theme.colors.text }}>
          Failed to load student list
        </Text>
        <Text className="mt-1 text-center text-xs font-bold" style={{ color: theme.colors.textMuted }}>
          {error instanceof Error ? error.message : 'Please check your connection and try again.'}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void refetch()}
          className="mt-4 rounded-xl px-5 py-3"
          style={{ backgroundColor: theme.colors.primary }}>
          <Text className="font-black text-white">Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingBottom: 36, paddingHorizontal: 16 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => void refetch()}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
        />
      }>
      {/* Live Session Status Indicator Bar */}
      {effectiveSessionId ? (
        <View
          className="mb-3.5 flex-row items-center justify-between rounded-2xl border px-3.5 py-2.5 shadow-sm"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: isWsConnected ? '#10B98140' : theme.colors.border,
          }}>
          <View className="flex-row items-center flex-1 mr-2">
            <View
              className={`mr-2.5 h-3 w-3 rounded-full ${
                isWsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <View className="flex-1">
              <Text className="text-xs font-black" style={{ color: theme.colors.text }}>
                {isWsConnected ? 'Real-Time Attendance Monitoring' : 'Attendance Session Active'}
              </Text>
              <Text className="text-[10px] font-bold" style={{ color: theme.colors.textMuted }}>
                {isWsConnected ? 'Live updates connected via WebSocket' : 'Connecting to live updates...'}
              </Text>
            </View>
          </View>

          <View
            className={`rounded-full px-2.5 py-1 flex-row items-center ${
              isWsConnected
                ? 'bg-emerald-500/10 border border-emerald-500/30'
                : 'bg-amber-500/10 border border-amber-500/30'
            }`}>
            <Ionicons
              name={isWsConnected ? 'wifi' : 'sync'}
              size={12}
              color={isWsConnected ? '#10B981' : '#F59E0B'}
            />
            <Text
              className={`ml-1 text-[10px] font-black uppercase ${
                isWsConnected
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}>
              {isWsConnected ? 'Live' : 'Syncing'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Summary Metrics Row */}
      <View className="mb-3.5 flex-row gap-2">
        {/* Total Students */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedFilter('all')}
          className={`flex-1 rounded-[16px] border p-2.5 ${
            selectedFilter === 'all' ? 'border-primary' : ''
          }`}
          style={{
            borderColor: selectedFilter === 'all' ? theme.colors.primary : theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
          <Text className="text-[9px] font-black uppercase" style={{ color: theme.colors.textMuted }}>
            Total
          </Text>
          <Text className="mt-1 text-lg font-black" style={{ color: theme.colors.text }}>
            {activeSummary.total_students}
          </Text>
        </Pressable>

        {/* Present Count */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedFilter('present')}
          className={`flex-1 rounded-[16px] border p-2.5 ${
            selectedFilter === 'present' ? 'border-emerald-500 bg-emerald-50/20' : ''
          }`}
          style={{
            borderColor: selectedFilter === 'present' ? '#10B981' : theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
          <Text className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">
            Present
          </Text>
          <Text className="mt-1 text-lg font-black text-emerald-600 dark:text-emerald-400">
            {activeSummary.present_count}
          </Text>
        </Pressable>

        {/* Late Count */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedFilter('late')}
          className={`flex-1 rounded-[16px] border p-2.5 ${
            selectedFilter === 'late' ? 'border-amber-500 bg-amber-50/20' : ''
          }`}
          style={{
            borderColor: selectedFilter === 'late' ? '#F59E0B' : theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
          <Text className="text-[9px] font-black uppercase text-amber-600 dark:text-amber-400">
            Late
          </Text>
          <Text className="mt-1 text-lg font-black text-amber-600 dark:text-amber-400">
            {activeSummary.late_count}
          </Text>
        </Pressable>

        {/* Absent Count */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedFilter('absent')}
          className={`flex-1 rounded-[16px] border p-2.5 ${
            selectedFilter === 'absent' ? 'border-rose-500 bg-rose-50/20' : ''
          }`}
          style={{
            borderColor: selectedFilter === 'absent' ? '#F43F5E' : theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
          <Text className="text-[9px] font-black uppercase text-rose-600 dark:text-rose-400">
            Absent
          </Text>
          <Text className="mt-1 text-lg font-black text-rose-600 dark:text-rose-400">
            {activeSummary.absent_count}
          </Text>
        </Pressable>

        {/* Unmarked / Pending Count */}
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedFilter('unmarked')}
          className={`flex-1 rounded-[16px] border p-2.5 ${
            selectedFilter === 'unmarked' ? 'border-slate-400 bg-slate-100/30' : ''
          }`}
          style={{
            borderColor: selectedFilter === 'unmarked' ? theme.colors.primary : theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
          <Text className="text-[9px] font-black uppercase" style={{ color: theme.colors.textMuted }}>
            Pending
          </Text>
          <Text className="mt-1 text-lg font-black" style={{ color: theme.colors.textMuted }}>
            {activeSummary.unmarked_count}
          </Text>
        </Pressable>
      </View>

      {/* Filter Chips Horizontal Bar */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="mb-3.5 flex-row"
        contentContainerStyle={{ gap: 8 }}>
        {(
          [
            { key: 'all', label: 'All', count: activeSummary.total_students },
            { key: 'present', label: 'Present', count: activeSummary.present_count },
            { key: 'late', label: 'Late', count: activeSummary.late_count },
            { key: 'absent', label: 'Absent', count: activeSummary.absent_count },
            { key: 'unmarked', label: 'Pending', count: activeSummary.unmarked_count },
          ] as { key: StatusFilter; label: string; count: number }[]
        ).map((filter) => {
          const isSelected = selectedFilter === filter.key;
          return (
            <Pressable
              key={filter.key}
              accessibilityRole="button"
              onPress={() => setSelectedFilter(filter.key)}
              className="flex-row items-center rounded-full px-3.5 py-1.5 border"
              style={{
                backgroundColor: isSelected ? theme.colors.primary : theme.colors.surface,
                borderColor: isSelected ? theme.colors.primary : theme.colors.border,
              }}>
              <Text
                className="text-xs font-black"
                style={{ color: isSelected ? '#FFFFFF' : theme.colors.text }}>
                {filter.label}
              </Text>
              <View
                className="ml-1.5 rounded-full px-1.5 py-0.2"
                style={{
                  backgroundColor: isSelected ? '#FFFFFF30' : theme.colors.surfaceMuted,
                }}>
                <Text
                  className="text-[10px] font-black"
                  style={{ color: isSelected ? '#FFFFFF' : theme.colors.textMuted }}>
                  {filter.count}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Search Input Bar */}
      <View
        className="mb-4 flex-row items-center rounded-xl border px-3.5 py-2.5"
        style={{
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surface,
        }}>
        <Ionicons name="search-outline" size={18} color={theme.colors.textMuted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search student by name or ID..."
          placeholderTextColor={theme.colors.textMuted}
          className="ml-2 flex-1 p-0 text-sm font-bold"
          style={{ color: theme.colors.text }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable accessibilityRole="button" onPress={() => setSearchQuery('')} className="p-1">
            <Ionicons name="close-circle" size={18} color={theme.colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Student List Items */}
      {filteredStudents.length === 0 ? (
        <View
          className="items-center rounded-[20px] border p-8"
          style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
          <Ionicons name="people-outline" size={38} color={theme.colors.textMuted} />
          <Text className="mt-3 text-center text-base font-black" style={{ color: theme.colors.text }}>
            {searchQuery
              ? 'No matching students'
              : selectedFilter !== 'all'
              ? `No ${selectedFilter} students`
              : 'No students found'}
          </Text>
          <Text className="mt-1 text-center text-xs font-bold" style={{ color: theme.colors.textMuted }}>
            {searchQuery
              ? `No student matches "${searchQuery}".`
              : selectedFilter !== 'all'
              ? `There are currently no students marked as ${selectedFilter}.`
              : 'There are no students currently enrolled in this course schedule.'}
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {filteredStudents.map((student, index) => {
            const fullName = getStudentFullName(student);
            const studentId = getStudentIdentifier(student);
            const imageUri = getStudentImageUri(student);
            const initials = getStudentInitials(fullName);
            const program = getProgramCode(student);

            const attendanceStatus = (student.attendance_status || 'unmarked').toLowerCase();
            const attendanceRecord = student.attendance_record;
            const isRecentlyCheckedIn =
              recentCheckedInId === String(studentId) ||
              recentCheckedInId === String(student.user?.user_id);

            const verifiedAtTime = formatVerifiedTime(
              attendanceRecord?.face_verified_at || attendanceRecord?.verified_at
            );

            return (
              <View
                key={student.user?.user_id || studentId || `student-${index}`}
                className={`rounded-[18px] border p-3.5 shadow-sm transition-all ${
                  isRecentlyCheckedIn
                    ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : ''
                }`}
                style={{
                  borderColor: isRecentlyCheckedIn ? '#10B981' : theme.colors.border,
                  backgroundColor: theme.colors.surface,
                }}>
                <View className="flex-row items-center">
                  {/* Student Avatar */}
                  {imageUri ? (
                    <Image
                      source={{ uri: imageUri }}
                      className="mr-3.5 h-12 w-12 rounded-full"
                      style={{ backgroundColor: theme.colors.surfaceMuted }}
                    />
                  ) : (
                    <View
                      className="mr-3.5 h-12 w-12 items-center justify-center rounded-full"
                      style={{ backgroundColor: theme.colors.primarySoft }}>
                      <Text className="text-sm font-black" style={{ color: theme.colors.primary }}>
                        {initials}
                      </Text>
                    </View>
                  )}

                  {/* Student Details */}
                  <View className="flex-1 mr-2">
                    <View className="flex-row items-center flex-wrap">
                      <Text
                        className="text-base font-black"
                        style={{ color: theme.colors.text }}
                        numberOfLines={1}>
                        {fullName}
                      </Text>
                      {isRecentlyCheckedIn && (
                        <View className="ml-2 rounded-full bg-emerald-500 px-1.5 py-0.2">
                          <Text className="text-[9px] font-black text-white uppercase">Just Marked</Text>
                        </View>
                      )}
                    </View>

                    <View className="mt-1 flex-row items-center flex-wrap gap-1.5">
                      <View
                        className="rounded-md px-2 py-0.5"
                        style={{ backgroundColor: theme.colors.surfaceMuted }}>
                        <Text
                          className="text-[11px] font-mono font-bold"
                          style={{ color: theme.colors.textMuted }}>
                          {studentId}
                        </Text>
                      </View>
                      {program && (
                        <View className="rounded-md bg-primary/10 px-2 py-0.5">
                          <Text
                            className="text-[11px] font-black uppercase"
                            style={{ color: theme.colors.primary }}>
                            {program}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Primary Attendance Status Badge */}
                  <View
                    className={`rounded-full px-2.5 py-1 flex-row items-center ${
                      attendanceStatus === 'present'
                        ? 'bg-emerald-500/10 border border-emerald-500/30'
                        : attendanceStatus === 'late'
                        ? 'bg-amber-500/10 border border-amber-500/30'
                        : attendanceStatus === 'absent'
                        ? 'bg-rose-500/10 border border-rose-500/30'
                        : 'bg-slate-500/10 border border-slate-500/30'
                    }`}>
                    <Ionicons
                      name={
                        attendanceStatus === 'present'
                          ? 'checkmark-circle'
                          : attendanceStatus === 'late'
                          ? 'time'
                          : attendanceStatus === 'absent'
                          ? 'close-circle'
                          : 'hourglass-outline'
                      }
                      size={13}
                      color={
                        attendanceStatus === 'present'
                          ? '#10B981'
                          : attendanceStatus === 'late'
                          ? '#F59E0B'
                          : attendanceStatus === 'absent'
                          ? '#F43F5E'
                          : theme.colors.textMuted
                      }
                    />
                    <Text
                      className={`ml-1 text-[11px] font-black uppercase ${
                        attendanceStatus === 'present'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : attendanceStatus === 'late'
                          ? 'text-amber-600 dark:text-amber-400'
                          : attendanceStatus === 'absent'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}>
                      {attendanceStatus}
                    </Text>
                  </View>
                </View>

                {/* Extended Verification Info Footer when marked */}
                {attendanceRecord && (
                  <View
                    className="mt-2.5 flex-row items-center justify-between border-t pt-2"
                    style={{ borderColor: theme.colors.border }}>
                    <View className="flex-row items-center gap-2">
                      {attendanceRecord.presence_verified && (
                        <View className="flex-row items-center rounded-md bg-blue-500/10 px-1.5 py-0.5">
                          <Ionicons name="bluetooth" size={11} color="#3B82F6" />
                          <Text className="ml-1 text-[10px] font-black text-blue-600 dark:text-blue-400">
                            BLE
                          </Text>
                        </View>
                      )}
                      {attendanceRecord.face_verified && (
                        <View className="flex-row items-center rounded-md bg-purple-500/10 px-1.5 py-0.5">
                          <Ionicons name="scan" size={11} color="#A855F7" />
                          <Text className="ml-1 text-[10px] font-black text-purple-600 dark:text-purple-400">
                            Face AI
                          </Text>
                        </View>
                      )}
                    </View>

                    {verifiedAtTime && (
                      <View className="flex-row items-center">
                        <Ionicons name="time-outline" size={11} color={theme.colors.textMuted} />
                        <Text className="ml-1 text-[10px] font-bold" style={{ color: theme.colors.textMuted }}>
                          {verifiedAtTime}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
