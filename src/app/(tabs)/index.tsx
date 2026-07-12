import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { getCourseSchedules } from '@/services/course-schedule-service';
import type { CourseSchedule } from '@/types/course-schedule';

function getCourseTitle(schedule: CourseSchedule) {
  return schedule.course_name ?? schedule.course_code ?? 'Course schedule';
}

function getCourseCode(schedule: CourseSchedule) {
  return schedule.course_code ?? 'COURSE';
}

function getScheduleDay(schedule: CourseSchedule) {
  if (Array.isArray(schedule.days)) {
    return schedule.days.length > 0 ? schedule.days.join(', ') : 'Day not set';
  }
  return schedule.days ?? schedule.day ?? 'Schedule day';
}

function getScheduleTime(schedule: CourseSchedule) {
  if (schedule.start_time && schedule.end_time) {
    return `${schedule.start_time} - ${schedule.end_time}`;
  }
  return schedule.start_time ?? schedule.end_time ?? 'Time not set';
}

export default function HomeScreen() {
  const { signOut, user } = useAuth();
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.user_id;

  const displayName = useMemo(() => {
    if (!user) return 'Student';
    return [user.first_name, user.middle_initial, user.last_name, user.suffix]
      .filter(Boolean)
      .join(' ');
  }, [user]);

  const loadSchedules = useCallback(async () => {
    if (!userId) return;

    setError(null);
    const nextSchedules = await getCourseSchedules(userId);
    setSchedules(nextSchedules);
  }, [userId]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadSchedules()
        .catch((loadError) => {
          const message =
            loadError instanceof Error ? loadError.message : 'Unable to load course schedules.';
          setError(message);
        })
        .finally(() => setIsLoading(false));
    }, 0);

    return () => clearTimeout(timeout);
  }, [loadSchedules]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadSchedules();
    } catch (refreshError) {
      const message =
        refreshError instanceof Error ? refreshError.message : 'Unable to refresh schedules.';
      setError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSchedules]);

  const handleLogout = useCallback(async () => {
    await signOut();
    router.replace('/login');
  }, [signOut]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Ionicons name="home" size={25} color="#FFFFFF" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PRESENSURE</Text>
            <Text style={styles.title}>Home</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Logout"
          accessibilityRole="button"
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}>
          <Ionicons name="log-out-outline" size={22} color="#DC2626" />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <Text style={styles.welcomeLabel}>WELCOME BACK</Text>
        <Text style={styles.welcomeName} numberOfLines={2}>
          {displayName}
        </Text>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="id-card-outline" size={16} color="#1D4ED8" />
            <Text style={styles.metaText}>{user?.user_id}</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="person-circle-outline" size={16} color="#1D4ED8" />
            <Text style={styles.metaText}>{user?.role.role_name ?? 'student'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Course schedule</Text>
        <Pressable
          accessibilityLabel="Refresh schedules"
          accessibilityRole="button"
          onPress={handleRefresh}
          style={({ pressed }) => [styles.refreshButton, pressed && styles.buttonPressed]}>
          <Ionicons name="refresh" size={18} color="#2563EB" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#2563EB" />
          <Text style={styles.centerText}>Loading schedules</Text>
        </View>
      ) : (
        <FlatList
          data={schedules}
          keyExtractor={(item, index) => String(item.id ?? item.course_id ?? index)}
          contentContainerStyle={schedules.length === 0 ? styles.emptyList : styles.scheduleList}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#2563EB" />
          }
          renderItem={({ item }) => (
            <View style={styles.scheduleCard}>
              <View style={styles.scheduleTop}>
                <Text style={styles.courseTitle} numberOfLines={2}>
                  {getCourseTitle(item)}
                </Text>
                <View style={styles.courseCodePill}>
                  <Text style={styles.courseCodeText} numberOfLines={1}>
                    {getCourseCode(item)}
                  </Text>
                </View>
              </View>

              <View style={styles.scheduleMeta}>
                <View style={styles.metaChip}>
                  <Ionicons name="calendar-outline" size={16} color="#64748B" />
                  <Text style={styles.metaChipText} numberOfLines={1}>
                    {getScheduleDay(item)}
                  </Text>
                </View>
                <View style={styles.metaChip}>
                  <Ionicons name="time-outline" size={16} color="#64748B" />
                  <Text style={styles.metaChipText} numberOfLines={1}>
                    {getScheduleTime(item)}
                  </Text>
                </View>
                <View style={styles.metaChip}>
                  <Ionicons name="location-outline" size={16} color="#64748B" />
                  <Text style={styles.metaChipText} numberOfLines={1}>
                    {item.room ?? 'Room not set'}
                  </Text>
                </View>
                <View style={styles.metaChip}>
                  <Ionicons name="layers-outline" size={16} color="#64748B" />
                  <Text style={styles.metaChipText} numberOfLines={1}>
                    {[item.section, item.semester].filter(Boolean).join(' - ') || 'Block not set'}
                  </Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyIcon}>
                <Ionicons
                  name={error ? 'alert-circle-outline' : 'calendar-clear-outline'}
                  size={34}
                  color={error ? '#DC2626' : '#64748B'}
                />
              </View>
              <Text style={styles.emptyTitle}>
                {error ? 'Could not load schedules' : 'No schedules yet'}
              </Text>
              <Text style={styles.emptyText}>
                {error ?? 'Your course schedules will appear here once available.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { marginLeft: 13 },
  eyebrow: { color: '#2563EB', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#0F172A', fontSize: 25, fontWeight: '800' },
  logoutButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  hero: {
    marginHorizontal: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  welcomeLabel: { color: '#64748B', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  welcomeName: { color: '#0F172A', fontSize: 23, fontWeight: '900', marginTop: 5 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  metaText: { color: '#1D4ED8', fontSize: 12, fontWeight: '800', textTransform: 'capitalize' },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: { color: '#0F172A', fontSize: 18, fontWeight: '900' },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
  },
  scheduleList: { paddingHorizontal: 14, paddingBottom: 110, gap: 10 },
  scheduleCard: {
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  scheduleTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  courseTitle: { flex: 1, color: '#0F172A', fontSize: 16, fontWeight: '900', lineHeight: 21 },
  courseCodePill: {
    maxWidth: 104,
    minHeight: 30,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  courseCodeText: { color: '#15803D', fontSize: 11, fontWeight: '900' },
  scheduleMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  metaChip: {
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
  },
  metaChipText: { flex: 1, color: '#475569', fontSize: 12, fontWeight: '800' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  centerText: { color: '#64748B', fontSize: 13, fontWeight: '700', marginTop: 10 },
  emptyList: { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 110 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900', marginTop: 16 },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 7,
  },
  buttonPressed: { opacity: 0.78 },
});
