import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Calendar, Clock, MapPin, ScanFace, ChevronRight, RefreshCw } from 'lucide-react-native';
import { useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/providers/theme-provider';
import { useAuth } from '@/context/auth-context';
import { getCourseSchedules } from '@/services/course-schedule-service';
import type { CourseSchedule } from '@/types/course-schedule';

function formatScheduleTime(startTime?: string, endTime?: string) {
  if (!startTime || !endTime) return 'Time not set';

  function parseTime(t: string) {
    const parts = t.split(':');
    if (parts.length < 2) return t;
    const h = parseInt(parts[0], 10);
    const m = parts[1];
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  }

  return `${parseTime(startTime)} - ${parseTime(endTime)}`;
}

export default function AttendanceScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const userId = user?.user_id ?? '';

  const {
    data: schedules = [],
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ['attendance-schedules', userId],
    queryFn: () => getCourseSchedules(String(userId)),
    enabled: Boolean(userId),
  });

  const handleOpenSchedule = (schedule: CourseSchedule) => {
    router.push({
      pathname: '/schedule-detail',
      params: { schedule: JSON.stringify(schedule) },
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
      <StatusBar
        barStyle={theme.resolvedMode === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />

      {/* Header */}
      <View className="px-5 pt-3 pb-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View
              className="mr-3 h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: theme.colors.primarySoft }}>
              <ShieldCheck size={24} color={theme.colors.primary} />
            </View>
            <View>
              <Text className="text-xl font-black" style={{ color: theme.colors.text }}>
                Attendance Hub
              </Text>
              <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                BLE & Face Recognition Verification
              </Text>
            </View>
          </View>

          <View className="rounded-full bg-emerald-500/10 px-3 py-1 border border-emerald-500/30 flex-row items-center">
            <ScanFace size={14} color="#10B981" />
            <Text className="ml-1.5 text-xs font-black text-emerald-600 dark:text-emerald-400">
              Face AI Active
            </Text>
          </View>
        </View>
      </View>

      {/* Main Schedules List */}
      <FlatList
        data={schedules}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={theme.colors.primary}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="py-12 items-center">
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text className="mt-3 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
                Loading course schedules...
              </Text>
            </View>
          ) : (
            <View
              className="mt-6 rounded-2xl border p-6 items-center"
              style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
              <Calendar size={36} color={theme.colors.textMuted} />
              <Text className="mt-3 text-base font-black" style={{ color: theme.colors.text }}>
                No Enrolled Course Schedules
              </Text>
              <Text
                className="mt-1 text-center text-xs font-bold leading-5"
                style={{ color: theme.colors.textMuted }}>
                Your active course schedules will appear here once registered.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            onPress={() => handleOpenSchedule(item)}
            className="mb-3.5 rounded-2xl border p-4"
            style={{
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              elevation: 3,
              shadowColor: '#0F172A',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 10,
            }}>
            <View className="flex-row items-center justify-between">
              <View className="flex-1 mr-2">
                <Text className="text-xs font-black uppercase" style={{ color: theme.colors.primary }}>
                  {item.course_code || 'COURSE'}
                </Text>
                <Text className="mt-0.5 text-base font-black" style={{ color: theme.colors.text }} numberOfLines={1}>
                  {item.course_name || 'Course Name'}
                </Text>
              </View>

              <View className="h-8 w-8 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <ChevronRight size={18} color={theme.colors.textMuted} />
              </View>
            </View>

            <View className="mt-3 flex-row items-center justify-between border-t pt-3" style={{ borderColor: theme.colors.border }}>
              <View className="flex-row items-center">
                <Clock size={14} color={theme.colors.textMuted} />
                <Text className="ml-1.5 text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                  {formatScheduleTime(item.start_time, item.end_time)}
                </Text>
              </View>

              <View className="flex-row items-center">
                <MapPin size={14} color={theme.colors.textMuted} />
                <Text className="ml-1 text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                  {item.room || 'Room not set'}
                </Text>
              </View>
            </View>

            {/* Attendance Verification CTA */}
            <View
              className="mt-3 flex-row items-center justify-between rounded-xl px-3 py-2"
              style={{ backgroundColor: theme.colors.primarySoft }}>
              <View className="flex-row items-center">
                <ScanFace size={16} color={theme.colors.primary} />
                <Text className="ml-2 text-xs font-black" style={{ color: theme.colors.primary }}>
                  Record Attendance (BLE + Face)
                </Text>
              </View>
              <Text className="text-[11px] font-bold" style={{ color: theme.colors.primary }}>
                Verify &rarr;
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
