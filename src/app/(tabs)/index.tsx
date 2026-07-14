import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { getCourseSchedules } from '@/services/course-schedule-service';
import type { CourseSchedule } from '@/types/course-schedule';

type ScheduleTab = 'today' | 'all';

const MANILA_TIME_ZONE = 'Asia/Manila';

const DAY_DATE_INDEX: Record<string, number> = {
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
  sunday: 0,
  sun: 0,
  su: 0,
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

function getDayLabel(day: string) {
  const normalized = day.trim().toLowerCase();
  return DAY_LABELS[normalized] ?? normalized.slice(0, 3).replace(/^\w/, (value) => value.toUpperCase());
}

function getDaySequence(day: string) {
  return DAY_SEQUENCE[day.trim().toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
}

function formatScheduleType(type?: string | null) {
  if (!type) return 'Regular';
  return type.replace(/[_-]+/g, ' ').replace(/\b\w/g, (value) => value.toUpperCase());
}

function getCourseTitle(schedule: CourseSchedule) {
  return schedule.course_name ?? schedule.course_code ?? 'No Subject';
}

function getDaysText(schedule: CourseSchedule) {
  const dayCodes = getSortedDayCodes(schedule.days ?? schedule.day);

  return dayCodes.length > 0 ? dayCodes.map(getDayLabel).join(' | ') : 'No days';
}

function getDayCodes(days?: string[] | string) {
  if (Array.isArray(days)) return days;
  if (!days) return [];

  const trimmedDays = days.trim();
  if (!trimmedDays) return [];
  if (DAY_DATE_INDEX[trimmedDays.toLowerCase()] !== undefined || DAY_LABELS[trimmedDays.toLowerCase()]) {
    return [trimmedDays];
  }
  if (/[\s,]+/.test(trimmedDays)) {
    return trimmedDays.split(/[\s,]+/).filter(Boolean);
  }

  const codes: string[] = [];
  let index = 0;

  while (index < trimmedDays.length) {
    const twoLetters = trimmedDays.substring(index, index + 2);
    const twoLettersLower = twoLetters.toLowerCase();
    if (twoLettersLower === 'th' || twoLettersLower === 'su') {
      codes.push(twoLetters);
      index += 2;
    } else {
      codes.push(trimmedDays[index]);
      index += 1;
    }
  }

  return codes.filter(Boolean);
}

function getSortedDayCodes(days?: string[] | string) {
  return getDayCodes(days).sort((first, second) => getDaySequence(first) - getDaySequence(second));
}

function parseTimeToMinutes(time?: string) {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function getManilaNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: MANILA_TIME_ZONE,
    weekday: 'long',
  }).formatToParts(new Date());

  const weekday = parts.find((part) => part.type === 'weekday')?.value.toLowerCase() ?? 'monday';
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');

  return {
    dayIndex: DAY_DATE_INDEX[weekday] ?? 1,
    minutes: hour * 60 + minute,
  };
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

type ManilaNow = ReturnType<typeof getManilaNow>;

function isScheduleToday(schedule: CourseSchedule, manilaNow = getManilaNow()) {
  const codes = getDayCodes(schedule.days ?? schedule.day);
  if (codes.length === 0) return true;

  const currentDay = manilaNow.dayIndex;
  return codes.some((code) => DAY_DATE_INDEX[code.trim().toLowerCase()] === currentDay);
}

function isScheduleActive(schedule: CourseSchedule, manilaNow = getManilaNow()) {
  if (!isScheduleToday(schedule, manilaNow)) return false;

  const currentMinutes = manilaNow.minutes;
  const start = parseTimeToMinutes(schedule.start_time);
  const end = parseTimeToMinutes(schedule.end_time);

  return currentMinutes >= start && currentMinutes <= end;
}

function isScheduleUpcomingOrActiveToday(schedule: CourseSchedule, manilaNow: ManilaNow) {
  if (!isScheduleToday(schedule, manilaNow)) return false;

  const end = parseTimeToMinutes(schedule.end_time);
  return end >= manilaNow.minutes;
}

function getScheduleSortDay(schedule: CourseSchedule) {
  const dayCodes = getSortedDayCodes(schedule.days ?? schedule.day);
  return dayCodes.length > 0 ? getDaySequence(dayCodes[0]) : Number.MAX_SAFE_INTEGER;
}

function openScheduleDetail(schedule: CourseSchedule) {
  router.push({
    pathname: '/schedule-detail',
    params: { schedule: JSON.stringify(schedule) },
  });
}

export default function HomeScreen() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [activeTab, setActiveTab] = useState<ScheduleTab>('today');
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

  const profileImageUri =
    user?.profile?.imagelink ??
    user?.image ??
    user?.avatar ??
    user?.profile_photo ??
    user?.profile_image;
  const initials = useMemo(() => {
    if (!user) return 'S';
    return `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'S';
  }, [user]);

  const filteredSchedules = useMemo(() => {
    const manilaNow = getManilaNow();
    const nextSchedules =
      activeTab === 'today'
        ? schedules.filter((schedule) => isScheduleUpcomingOrActiveToday(schedule, manilaNow))
        : schedules;

    return [...nextSchedules].sort((first, second) => {
      if (activeTab === 'today') {
        const firstActive = isScheduleActive(first, manilaNow);
        const secondActive = isScheduleActive(second, manilaNow);
        if (firstActive !== secondActive) return firstActive ? -1 : 1;
      }

      const dayDifference = getScheduleSortDay(first) - getScheduleSortDay(second);
      if (dayDifference !== 0) return dayDifference;

      const timeDifference = parseTimeToMinutes(first.start_time) - parseTimeToMinutes(second.start_time);
      if (timeDifference !== 0) return timeDifference;

      return getCourseTitle(first).localeCompare(getCourseTitle(second));
    });
  }, [activeTab, schedules]);

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

  return (
    <SafeAreaView className="flex-1 bg-slate-100" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 pb-3 pt-2">
        <View className="flex-1 flex-row items-center">
          <View className="h-11 w-11 items-center justify-center rounded-[13px] bg-blue-600">
            <Ionicons name="home" size={24} color="#FFFFFF" />
          </View>
          <View className="ml-3">
            <Text className="text-[11px] font-black tracking-[1.4px] text-blue-600">PRESENSURE</Text>
            <Text className="text-2xl font-black text-slate-950">Home</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Open profile"
          accessibilityRole="button"
          onPress={() => router.push('/profile')}
          className="h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full border-2 border-blue-200 bg-white"
          style={({ pressed }) => pressed && { opacity: 0.78 }}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} className="h-full w-full" />
          ) : (
            <Text className="text-sm font-black text-blue-600">{initials}</Text>
          )}
        </Pressable>
      </View>

      <View className="px-4 pb-3.5">
        <Text className="text-[13px] font-extrabold text-slate-500">Welcome back</Text>
        <Text className="mt-0.5 text-xl font-black text-slate-950" numberOfLines={1}>
          {displayName}
        </Text>
      </View>

      <View className="mx-4 mb-[18px] flex-row rounded-full bg-slate-200 p-1.5">
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab('today')}
          className={`min-h-[38px] flex-1 items-center justify-center rounded-full ${
            activeTab === 'today' ? 'bg-white' : ''
          }`}>
          <Text
            className={`text-[13px] font-extrabold ${
              activeTab === 'today' ? 'text-slate-700' : 'text-slate-500'
            }`}>
            Today Schedule
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setActiveTab('all')}
          className={`min-h-[38px] flex-1 items-center justify-center rounded-full ${
            activeTab === 'all' ? 'bg-white' : ''
          }`}>
          <Text
            className={`text-[13px] font-extrabold ${
              activeTab === 'all' ? 'text-slate-700' : 'text-slate-500'
            }`}>
            All Schedule
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center px-7">
          <ActivityIndicator color="#2563EB" />
          <Text className="mt-2.5 text-[13px] font-bold text-slate-500">Loading schedules</Text>
        </View>
      ) : (
        <FlatList
          data={filteredSchedules}
          keyExtractor={(item, index) => String(item.id ?? item.course_id ?? index)}
          contentContainerStyle={
            filteredSchedules.length === 0
              ? { flexGrow: 1, paddingHorizontal: 28, paddingBottom: 128 }
              : { paddingHorizontal: 16, paddingBottom: 128 }
          }
          ItemSeparatorComponent={() => <View className="h-4" />}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor="#2563EB" />
          }
          renderItem={({ item }) => {
            const active = isScheduleActive(item);

            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => openScheduleDetail(item)}
                className={`min-h-[140px] justify-between rounded-[18px] border bg-white p-[18px] shadow-lg shadow-slate-900/10 ${
                  active ? 'border-[3px] border-emerald-400' : 'border-gray-200'
                }`}
                style={({ pressed }) => pressed && { opacity: 0.84, transform: [{ scale: 0.995 }] }}>
                <View className="mb-2 flex-row items-center">
                  <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-full bg-blue-100">
                    <Ionicons name="book" size={19} color="#2563EB" />
                  </View>
                  <Text className="flex-1 text-lg font-black leading-[23px] text-gray-900" numberOfLines={2}>
                    {getCourseTitle(item)}
                  </Text>
                </View>

                <Text className="mb-3.5 text-sm font-bold text-slate-500" numberOfLines={1}>
                  {getDaysText(item)} | {item.room ?? 'No room'} | {formatScheduleType(item.schedule_type)}
                </Text>

                <View className="flex-row items-center justify-between gap-2.5">
                  <Text className="flex-1 text-base font-black text-blue-600">
                    {formatTime(item.start_time)} - {formatTime(item.end_time)}
                  </Text>
                  <View className={`rounded-full px-3 py-1.5 ${active ? 'bg-emerald-100' : 'bg-blue-50'}`}>
                    <Text
                      className={`text-[11px] font-black uppercase ${
                        active ? 'text-emerald-700' : 'text-blue-600'
                      }`}>
                      {active ? 'Active' : formatScheduleType(item.schedule_type)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-7">
              <View className="h-[72px] w-[72px] items-center justify-center rounded-3xl bg-slate-200">
                <Ionicons
                  name={error ? 'alert-circle-outline' : 'calendar-clear-outline'}
                  size={34}
                  color={error ? '#DC2626' : '#64748B'}
                />
              </View>
              <Text className="mt-4 text-[17px] font-black text-slate-950">
                {error ? 'Could not load schedules' : 'No upcoming schedules'}
              </Text>
              <Text className="mt-[7px] text-center text-sm leading-[21px] text-slate-500">
                {error ??
                  (activeTab === 'today'
                    ? 'You have no more classes for today.'
                    : 'No schedules available.')}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
