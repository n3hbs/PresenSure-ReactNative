import { router } from "expo-router";
import {
  AlertCircle,
  Bell,
  BookOpen,
  CalendarX,
  Home,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAppTheme } from "@/app/providers/theme-provider";
import { useAuth } from "@/context/auth-context";
import { getCourseSchedules } from "@/services/course-schedule-service";
import type { CourseSchedule } from "@/types/course-schedule";

type ScheduleTab = "today" | "all";
type AppTheme = ReturnType<typeof useAppTheme>;

const MANILA_TIME_ZONE = "Asia/Manila";

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
  monday: "Mon",
  mon: "Mon",
  m: "Mon",
  tuesday: "Tue",
  tue: "Tue",
  t: "Tue",
  wednesday: "Wed",
  wed: "Wed",
  w: "Wed",
  thursday: "Thu",
  thu: "Thu",
  th: "Thu",
  friday: "Fri",
  fri: "Fri",
  f: "Fri",
  saturday: "Sat",
  sat: "Sat",
  s: "Sat",
  sunday: "Sun",
  sun: "Sun",
  su: "Sun",
};

function getDayLabel(day: string) {
  const normalized = day.trim().toLowerCase();
  return (
    DAY_LABELS[normalized] ??
    normalized.slice(0, 3).replace(/^\w/, (value) => value.toUpperCase())
  );
}

function getDaySequence(day: string) {
  return DAY_SEQUENCE[day.trim().toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
}

function formatScheduleType(type?: string | null) {
  if (!type) return "Regular";
  return type
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());
}

function getCourseTitle(schedule: CourseSchedule) {
  return schedule.course_name ?? schedule.course_code ?? "No Subject";
}

function getDaysText(schedule: CourseSchedule) {
  const dayCodes = getSortedDayCodes(schedule.days ?? schedule.day);

  return dayCodes.length > 0
    ? dayCodes.map(getDayLabel).join(" | ")
    : "No days";
}

function getDayCodes(days?: string[] | string) {
  if (Array.isArray(days)) return days;
  if (!days) return [];

  const trimmedDays = days.trim();
  if (!trimmedDays) return [];
  if (
    DAY_DATE_INDEX[trimmedDays.toLowerCase()] !== undefined ||
    DAY_LABELS[trimmedDays.toLowerCase()]
  ) {
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
    if (twoLettersLower === "th" || twoLettersLower === "su") {
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
  return getDayCodes(days).sort(
    (first, second) => getDaySequence(first) - getDaySequence(second),
  );
}

function parseTimeToMinutes(time?: string) {
  if (!time) return Number.MAX_SAFE_INTEGER;
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function getManilaNow() {
  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: MANILA_TIME_ZONE,
    weekday: "long",
  }).formatToParts(new Date());

  const weekday =
    parts.find((part) => part.type === "weekday")?.value.toLowerCase() ??
    "monday";
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );

  return {
    dayIndex: DAY_DATE_INDEX[weekday] ?? 1,
    minutes: hour * 60 + minute,
  };
}

function formatTime(time?: string) {
  if (!time) return "Not set";
  const [hourValue, minuteValue = "00"] = time.split(":");
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return time;

  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minuteValue.padStart(2, "0")} ${period}`;
}

type ManilaNow = ReturnType<typeof getManilaNow>;

function isScheduleToday(schedule: CourseSchedule, manilaNow = getManilaNow()) {
  const codes = getDayCodes(schedule.days ?? schedule.day);
  if (codes.length === 0) return true;

  const currentDay = manilaNow.dayIndex;
  return codes.some(
    (code) => DAY_DATE_INDEX[code.trim().toLowerCase()] === currentDay,
  );
}

function isScheduleActive(
  schedule: CourseSchedule,
  manilaNow = getManilaNow(),
) {
  if (!isScheduleToday(schedule, manilaNow)) return false;

  const currentMinutes = manilaNow.minutes;
  const start = parseTimeToMinutes(schedule.start_time);
  const end = parseTimeToMinutes(schedule.end_time);

  return currentMinutes >= start && currentMinutes <= end;
}

function isScheduleUpcomingOrActiveToday(
  schedule: CourseSchedule,
  manilaNow: ManilaNow,
) {
  if (!isScheduleToday(schedule, manilaNow)) return false;

  const end = parseTimeToMinutes(schedule.end_time);
  return end >= manilaNow.minutes;
}

function getScheduleSortDay(schedule: CourseSchedule) {
  const dayCodes = getSortedDayCodes(schedule.days ?? schedule.day);
  return dayCodes.length > 0
    ? getDaySequence(dayCodes[0])
    : Number.MAX_SAFE_INTEGER;
}

function openScheduleDetail(schedule: CourseSchedule) {
  router.push({
    pathname: "/schedule-detail",
    params: { schedule: JSON.stringify(schedule) },
  });
}

function ScheduleCard({
  active,
  item,
  theme,
}: {
  active: boolean;
  item: CourseSchedule;
  theme: AppTheme;
}) {
  const cardBackground = theme.resolvedMode === "dark" ? "#111C2F" : "#FFFFFF";
  const cardAccentBackground =
    theme.resolvedMode === "dark" ? "#243757" : "#DBEAFE";
  const cardBorderColor = active
    ? "#34D399"
    : theme.resolvedMode === "dark"
      ? "#3B4A61"
      : "#E2E8F0";
  const statusBackground = active
    ? "#D1FAE5"
    : theme.resolvedMode === "dark"
      ? "#243757"
      : "#EFF6FF";

  return (
    <View
      style={{
        backgroundColor: cardBackground,
        borderColor: cardBorderColor,
        borderRadius: 20,
        borderWidth: active ? 3 : 1,
        elevation: active ? 7 : 6,
        marginHorizontal: 16,
        minHeight: 150,
        padding: 20,
        shadowColor: "#0F172A",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: theme.resolvedMode === "dark" ? 0.3 : 0.18,
        shadowRadius: 20,
      }}
    >
      <Pressable
        accessibilityRole="button"
        onPress={() => openScheduleDetail(item)}
        style={({ pressed }) => ({
          flex: 1,
          justifyContent: "space-between",
          opacity: pressed ? 0.84 : 1,
          transform: pressed ? [{ scale: 0.995 }] : [{ scale: 1 }],
        })}
      >
        <View className="mb-3 flex-row items-center">
          <View
            className="mr-3 h-10 w-10 items-center justify-center"
            style={{
              backgroundColor: cardAccentBackground,
              borderRadius: 999,
            }}
          >
            <BookOpen size={20} color={theme.colors.primary} />
          </View>
          <Text
            className="flex-1 text-lg font-black leading-[23px]"
            numberOfLines={2}
            style={{ color: theme.colors.text }}
          >
            {getCourseTitle(item)}
          </Text>
        </View>

        <Text
          className="mb-4 text-sm font-bold"
          numberOfLines={1}
          style={{ color: theme.colors.textMuted }}
        >
          {getDaysText(item)} | {item.room ?? "No room"} |{" "}
          {formatScheduleType(item.schedule_type)}
        </Text>

        <View className="flex-row items-center justify-between gap-2.5">
          <Text
            className="flex-1 text-base font-black"
            style={{ color: theme.colors.primary }}
          >
            {formatTime(item.start_time)} - {formatTime(item.end_time)}
          </Text>
          <View
            className="px-4 py-2"
            style={{
              backgroundColor: statusBackground,
              borderRadius: 999,
            }}
          >
            <Text
              className="text-[11px] font-black uppercase"
              style={{ color: active ? "#047857" : theme.colors.primary }}
            >
              {active ? "Active" : formatScheduleType(item.schedule_type)}
            </Text>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

export default function HomeScreen() {
  const theme = useAppTheme();
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<CourseSchedule[]>([]);
  const [activeTab, setActiveTab] = useState<ScheduleTab>("today");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.user_id;

  const profileImageUri =
    user?.profile?.imagelink ??
    user?.image ??
    user?.avatar ??
    user?.profile_photo ??
    user?.profile_image;
  const initials = useMemo(() => {
    if (!user) return "S";
    return (
      `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() ||
      "S"
    );
  }, [user]);

  const filteredSchedules = useMemo(() => {
    const manilaNow = getManilaNow();
    const nextSchedules =
      activeTab === "today"
        ? schedules.filter((schedule) =>
            isScheduleUpcomingOrActiveToday(schedule, manilaNow),
          )
        : schedules;

    return [...nextSchedules].sort((first, second) => {
      if (activeTab === "today") {
        const firstActive = isScheduleActive(first, manilaNow);
        const secondActive = isScheduleActive(second, manilaNow);
        if (firstActive !== secondActive) return firstActive ? -1 : 1;
      }

      const dayDifference =
        getScheduleSortDay(first) - getScheduleSortDay(second);
      if (dayDifference !== 0) return dayDifference;

      const timeDifference =
        parseTimeToMinutes(first.start_time) -
        parseTimeToMinutes(second.start_time);
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
            loadError instanceof Error
              ? loadError.message
              : "Unable to load course schedules.";
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
        refreshError instanceof Error
          ? refreshError.message
          : "Unable to refresh schedules.";
      setError(message);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadSchedules]);

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <StatusBar
        backgroundColor={theme.colors.background}
        barStyle={
          theme.resolvedMode === "dark" ? "light-content" : "dark-content"
        }
        translucent={false}
      />
      <View
        className="flex-row items-center justify-between px-4 pb-4 pt-2"
        style={{ backgroundColor: theme.colors.background }}
      >
        <View className="flex-1 flex-row items-center">
          <View
            className="h-11 w-11 items-center justify-center rounded-[13px]"
            style={{ backgroundColor: theme.colors.primarySoft }}
          >
            <Home size={24} color={theme.colors.primary} />
          </View>
          <View className="ml-3">
            <Text
              className="text-[11px] font-black tracking-[1.4px]"
              style={{ color: theme.colors.primary }}
            >
              PRESENSURE
            </Text>
            <Text
              className="text-2xl font-black"
              style={{ color: theme.colors.text }}
            >
              Home
            </Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2.5">
          <Pressable
            accessibilityLabel="Open notifications"
            accessibilityRole="button"
            onPress={() => router.push("/notifications")}
            className="h-[42px] w-[42px] items-center justify-center rounded-full"
            style={({ pressed }) => [
              { backgroundColor: theme.colors.surfaceMuted },
              pressed && { opacity: 0.78 },
            ]}
          >
            <Bell size={22} color={theme.colors.textMuted} />
          </Pressable>
          <Pressable
            accessibilityLabel="Open profile"
            accessibilityRole="button"
            onPress={() => router.push("/profile")}
            className="h-[42px] w-[42px] items-center justify-center overflow-hidden rounded-full border-2"
            style={({ pressed }) => [
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.border,
              },
              pressed && { opacity: 0.78 },
            ]}
          >
            {profileImageUri ? (
              <Image
                source={{ uri: profileImageUri }}
                className="h-full w-full"
              />
            ) : (
              <Text
                className="text-sm font-black"
                style={{ color: theme.colors.primary }}
              >
                {initials}
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <View
        className="flex-1"
        style={{
          backgroundColor: theme.colors.background,
        }}
      >
        <View
          className="mx-4 mb-[18px] flex-row rounded-full p-1.5"
          style={{
            backgroundColor: theme.colors.surfaceMuted,
            borderRadius: 999,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTab("today")}
            className="min-h-[38px] flex-1 items-center justify-center rounded-full"
            style={{
              backgroundColor:
                activeTab === "today" ? theme.colors.surface : "transparent",
              borderRadius: 999,
            }}
          >
            <Text
              className="text-[13px] font-extrabold"
              style={{
                color:
                  activeTab === "today"
                    ? theme.colors.text
                    : theme.colors.textMuted,
              }}
            >
              Today Schedule
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setActiveTab("all")}
            className="min-h-[38px] flex-1 items-center justify-center rounded-full"
            style={{
              backgroundColor:
                activeTab === "all" ? theme.colors.surface : "transparent",
              borderRadius: 999,
            }}
          >
            <Text
              className="text-[13px] font-extrabold"
              style={{
                color:
                  activeTab === "all"
                    ? theme.colors.text
                    : theme.colors.textMuted,
              }}
            >
              All Schedule
            </Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View className="flex-1 items-center justify-center px-7">
            <ActivityIndicator color={theme.colors.primary} />
            <Text
              className="mt-2.5 text-[13px] font-bold"
              style={{ color: theme.colors.textMuted }}
            >
              Loading schedules
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredSchedules}
            keyExtractor={(item, index) =>
              String(item.id ?? item.course_id ?? index)
            }
            contentContainerStyle={
              filteredSchedules.length === 0
                ? { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 128 }
                : { paddingBottom: 128, paddingTop: 4 }
            }
            ItemSeparatorComponent={() => <View style={{ height: 22 }} />}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
            renderItem={({ item }) => {
              const active = isScheduleActive(item);

              return <ScheduleCard active={active} item={item} theme={theme} />;
            }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-7">
                <View
                  className="h-[72px] w-[72px] items-center justify-center rounded-3xl"
                  style={{
                    backgroundColor: theme.colors.surfaceMuted,
                    borderRadius: 24,
                  }}
                >
                  {error ? (
                    <AlertCircle size={34} color={theme.colors.danger} />
                  ) : (
                    <CalendarX size={34} color={theme.colors.textMuted} />
                  )}
                </View>
                <Text
                  className="mt-4 text-[17px] font-black"
                  style={{ color: theme.colors.text }}
                >
                  {error ? "Could not load schedules" : "No upcoming schedules"}
                </Text>
                <Text
                  className="mt-[7px] text-center text-sm leading-[21px]"
                  style={{ color: theme.colors.textMuted }}
                >
                  {error ??
                    (activeTab === "today"
                      ? "You have no more classes for today."
                      : "No schedules available.")}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
