import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAppTheme } from '@/app/providers/theme-provider';
import { createAttendanceSession } from '@/services/attendance-session-service';
import type { AttendanceSession } from '@/types/attendance-session';
import type { CourseSchedule } from '@/types/course-schedule';
import { isScheduleActive } from '@/utils/schedule-time';

type SourceOption = 'instructor_phone' | 'external_beacon';
const DEFAULT_PERIOD_ID = 3;

function toNumericId(value: string | number | null | undefined) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDateTime(value?: string) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function InstructorScheduleDetail({ schedule }: { schedule: CourseSchedule }) {
  const theme = useAppTheme();
  const [source, setSource] = useState<SourceOption>('instructor_phone');
  const [beaconId, setBeaconId] = useState('');
  const [roomBleConnected, setRoomBleConnected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdSession, setCreatedSession] = useState<AttendanceSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scheduleId = useMemo(() => toNumericId(schedule.id), [schedule.id]);
  const periodId = useMemo(() => toNumericId(schedule.period_id) ?? DEFAULT_PERIOD_ID, [schedule.period_id]);
  const activeNow = isScheduleActive(schedule);
  const usesExternalBeacon = source === 'external_beacon';
  const canSubmit =
    activeNow &&
    scheduleId !== null &&
    periodId !== null &&
    !isSubmitting &&
    (!usesExternalBeacon || (beaconId.trim().length > 0 && roomBleConnected));

  const disabledReason = !activeNow
    ? 'Attendance can start only during the scheduled class time.'
    : scheduleId === null
      ? 'Schedule ID is unavailable.'
      : periodId === null
        ? 'Period ID is unavailable for this schedule.'
        : usesExternalBeacon && beaconId.trim().length === 0
          ? 'Enter or detect the BLE device assigned to this room.'
          : usesExternalBeacon && !roomBleConnected
            ? 'Connect to the room BLE device before starting attendance.'
            : null;

  async function handleStartSession() {
    if (!canSubmit || scheduleId === null || periodId === null) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await createAttendanceSession({
        schedule_id: scheduleId,
        period_id: periodId,
        verification_mode: 'ble_face',
        ble_source_type: source,
        beacon_id: usesExternalBeacon ? beaconId.trim() : null,
      });
      setCreatedSession(response.data.session);
      Alert.alert('Attendance started', response.message);
    } catch (startError) {
      const message = startError instanceof Error ? startError.message : 'Unable to start attendance session.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <View className="mx-4 gap-4">
      <View
        className="rounded-[20px] border p-5 shadow-md shadow-slate-900/10"
        style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
        <View className="flex-row items-center">
          <View
            className="mr-3 h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.primarySoft }}>
            <Ionicons name="radio" size={22} color={theme.colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-black" style={{ color: theme.colors.text }}>
              Start Attendance
            </Text>
            <Text className="mt-1 text-sm font-bold" style={{ color: activeNow ? theme.colors.success : theme.colors.textMuted }}>
              {activeNow ? 'Class is active now.' : 'Waiting for schedule time.'}
            </Text>
          </View>
        </View>

        <View className="mt-5 flex-row rounded-full p-1.5" style={{ backgroundColor: theme.colors.surfaceMuted }}>
          {(['instructor_phone', 'external_beacon'] as SourceOption[]).map((option) => {
            const selected = source === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => setSource(option)}
                className="min-h-[42px] flex-1 items-center justify-center rounded-full"
                style={{ backgroundColor: selected ? theme.colors.surface : 'transparent' }}>
                <Text className="text-[12px] font-black" style={{ color: selected ? theme.colors.text : theme.colors.textMuted }}>
                  {option === 'instructor_phone' ? 'This Phone' : 'Room BLE'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {usesExternalBeacon ? (
          <View className="mt-4 gap-3">
            <TextInput
              value={beaconId}
              onChangeText={setBeaconId}
              placeholder="Schedule room BLE ID"
              placeholderTextColor={theme.colors.textMuted}
              autoCapitalize="none"
              className="min-h-[48px] rounded-md border px-4 text-base font-bold"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text,
              }}
            />
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: roomBleConnected }}
              onPress={() => setRoomBleConnected((current) => !current)}
              className="flex-row items-center rounded-md border p-3"
              style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.background }}>
              <Ionicons
                name={roomBleConnected ? 'checkbox' : 'square-outline'}
                size={22}
                color={roomBleConnected ? theme.colors.primary : theme.colors.textMuted}
              />
              <Text className="ml-2 flex-1 text-sm font-bold" style={{ color: theme.colors.text }}>
                Connected to the BLE device in this schedule room
              </Text>
            </Pressable>
            <Text className="text-xs font-bold leading-5" style={{ color: theme.colors.textMuted }}>
              This will be replaced by automatic BLE detection once the room BLE scanner is wired in.
            </Text>
          </View>
        ) : null}

        {disabledReason ? (
          <Text className="mt-4 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
            {disabledReason}
          </Text>
        ) : null}

        {error ? (
          <Text className="mt-4 text-sm font-bold" style={{ color: theme.colors.danger }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={handleStartSession}
          className="mt-5 min-h-[50px] flex-row items-center justify-center rounded-md"
          style={({ pressed }) => ({
            backgroundColor: canSubmit ? theme.colors.primary : theme.colors.border,
            opacity: pressed ? 0.86 : 1,
          })}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : null}
          <Text className={isSubmitting ? 'ml-2 text-base font-black' : 'text-base font-black'} style={{ color: '#FFFFFF' }}>
            {isSubmitting ? 'Starting' : 'Start Session'}
          </Text>
        </Pressable>
      </View>

      {createdSession ? (
        <View className="rounded-[20px] border p-5" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border }}>
          <Text className="text-base font-black" style={{ color: theme.colors.text }}>
            Active Session #{createdSession.attendance_session_id}
          </Text>
          <Text className="mt-2 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
            Source: {createdSession.ble_source_type === 'instructor_phone' ? 'Instructor phone' : 'Schedule room BLE'}
          </Text>
          <Text className="mt-1 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
            Token expires: {formatDateTime(createdSession.ble_token_expires_at)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
