import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
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

import { courseScheduleQueryKeys } from '@/features/attendance/course-schedule-query-keys';
import { useAppTheme } from '@/providers/theme-provider';
import { getScheduleStudents } from '@/services/course-schedule-service';
import type { ScheduleStudent } from '@/types/course-schedule';

function getStudentFullName(student: ScheduleStudent): string {
  if (student.full_name) return student.full_name;
  if (student.name) return student.name;

  const userObj = student.user || student;
  const firstName = userObj.first_name;
  const middleInitial = userObj.middle_initial;
  const lastName = userObj.last_name;
  const suffix = userObj.suffix;

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

function getStudentImageUri(student: ScheduleStudent): string | null {
  return (
    student.profile?.imagelink ||
    student.profile?.image_link ||
    student.profile?.avatar ||
    student.imagelink ||
    student.user_profile?.imagelink ||
    student.user_profile?.image_link ||
    student.user_profile?.avatar ||
    student.profile_image ||
    student.image ||
    student.avatar ||
    null
  );
}

function getStudentIdentifier(student: ScheduleStudent): string {
  if (student.user?.user_id) return student.user.user_id;
  if (student.student_number) return student.student_number;
  if (student.user_id) return student.user_id;

  const studentObj = Array.isArray(student.student) ? student.student[0] : student.student;
  if (studentObj?.student_id) return String(studentObj.student_id);

  if (student.id !== undefined && student.id !== null) return String(student.id);
  if (student.student_id !== undefined && student.student_id !== null) return String(student.student_id);

  return 'N/A';
}

function getStudentSex(student: ScheduleStudent): string {
  const sex = student.user?.sex || student.sex || '';
  return sex.trim().toLowerCase();
}

function getProgramTitle(student: ScheduleStudent): string | null {
  const studentObj = Array.isArray(student.student) ? student.student[0] : student.student;
  const programObj = studentObj?.program || (typeof student.program === 'object' ? student.program : null);

  if (!programObj && typeof student.program === 'string') return student.program;
  if (!programObj) return null;

  return (
    programObj.program_code ||
    programObj.code ||
    programObj.program_name ||
    programObj.name ||
    programObj.title ||
    null
  );
}


export function ScheduleStudentList({ scheduleId }: { scheduleId: number }) {
  const theme = useAppTheme();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    data,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useQuery({
    queryKey: courseScheduleQueryKeys.students(scheduleId),
    queryFn: () => getScheduleStudents(scheduleId),
    enabled: scheduleId > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const students = data?.students ?? [];
  const studentCount = data?.student_count ?? students.length;

  const maleCount = useMemo(() => {
    return students.filter((s) => getStudentSex(s) === 'male').length;
  }, [students]);

  const femaleCount = useMemo(() => {
    return students.filter((s) => getStudentSex(s) === 'female').length;
  }, [students]);

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;

    return students.filter((student) => {
      const fullName = getStudentFullName(student).toLowerCase();
      const idStr = getStudentIdentifier(student).toLowerCase();
      const email = (student.email ?? '').toLowerCase();
      const program = (getProgramTitle(student) ?? '').toLowerCase();
      const sex = getStudentSex(student);

      return (
        fullName.includes(query) ||
        idStr.includes(query) ||
        email.includes(query) ||
        program.includes(query) ||
        sex.includes(query)
      );
    });
  }, [students, searchQuery]);

  if (isLoading) {
    return (
      <View
        className="mx-4 items-center rounded-[20px] border p-8"
        style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text className="mt-3 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
          Loading student list...
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        className="mx-4 items-center rounded-[20px] border p-6"
        style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
        <Ionicons name="alert-circle-outline" size={40} color={theme.colors.danger} />
        <Text className="mt-3 text-center text-base font-black" style={{ color: theme.colors.text }}>
          Failed to load students
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
      contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 16 }}
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
      {/* Summary Stat Cards: Total, Male, Female */}
      <View className="mb-4 flex-row gap-2.5">
        <View
          className="flex-1 rounded-[18px] border p-3"
          style={{
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-black uppercase" style={{ color: theme.colors.textMuted }}>
              Total
            </Text>
            <View
              className="h-6 w-6 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.primarySoft }}>
              <Ionicons name="people" size={13} color={theme.colors.primary} />
            </View>
          </View>
          <Text className="mt-1.5 text-xl font-black" style={{ color: theme.colors.text }}>
            {studentCount}
          </Text>
        </View>

        <View
          className="flex-1 rounded-[18px] border p-3"
          style={{
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-black uppercase" style={{ color: theme.colors.textMuted }}>
              Male
            </Text>
            <View className="h-6 w-6 items-center justify-center rounded-full bg-blue-500/10">
              <Ionicons name="male" size={13} color="#3B82F6" />
            </View>
          </View>
          <Text className="mt-1.5 text-xl font-black text-blue-600 dark:text-blue-400">
            {maleCount}
          </Text>
        </View>

        <View
          className="flex-1 rounded-[18px] border p-3"
          style={{
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
          }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-black uppercase" style={{ color: theme.colors.textMuted }}>
              Female
            </Text>
            <View className="h-6 w-6 items-center justify-center rounded-full bg-rose-500/10">
              <Ionicons name="female" size={13} color="#F43F5E" />
            </View>
          </View>
          <Text className="mt-1.5 text-xl font-black text-rose-600 dark:text-rose-400">
            {femaleCount}
          </Text>
        </View>
      </View>

      {/* Search Bar Input */}
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
            {searchQuery ? 'No matching students' : 'No students found'}
          </Text>
          <Text className="mt-1 text-center text-xs font-bold" style={{ color: theme.colors.textMuted }}>
            {searchQuery
              ? `No student matches "${searchQuery}".`
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
            const program = getProgramTitle(student);
            const hasPhoto = Boolean(imageUri);

            return (
              <View
                key={student.user_id || (typeof student.student_id === 'string' ? student.student_id : null) || (student.id !== undefined && student.id !== null ? String(student.id) : null) || `student-${index}`}
                className="flex-row items-center rounded-[18px] border p-3.5 shadow-sm"
                style={{
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                }}>
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
                  <Text className="text-base font-black" style={{ color: theme.colors.text }} numberOfLines={1}>
                    {fullName}
                  </Text>
                  <View className="mt-1 flex-row items-center flex-wrap gap-1.5">
                    <View
                      className="rounded-md px-2 py-0.5"
                      style={{ backgroundColor: theme.colors.surfaceMuted }}>
                      <Text className="text-[11px] font-mono font-bold" style={{ color: theme.colors.textMuted }}>
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


                {/* Face Photo Indicator Badge */}
                <View
                  className={`rounded-full px-2.5 py-1 flex-row items-center ${
                    hasPhoto
                      ? 'bg-emerald-500/10 border border-emerald-500/30'
                      : 'bg-amber-500/10 border border-amber-500/30'
                  }`}>
                  <Ionicons
                    name={hasPhoto ? 'checkmark-circle' : 'alert-circle'}
                    size={12}
                    color={hasPhoto ? '#10B981' : '#F59E0B'}
                  />
                  <Text
                    className={`ml-1 text-[10px] font-black uppercase ${
                      hasPhoto ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                    {hasPhoto ? 'Photo' : 'No Photo'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}
