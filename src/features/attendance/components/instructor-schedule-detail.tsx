import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAppTheme } from "@/providers/theme-provider";
import { attendanceSessionQueryKeys } from "@/features/attendance/attendance-session-query-keys";
import { showBluetoothOffAlert } from "@/features/attendance/bluetooth-settings-alert";
import { Esp32BeaconPickerModal } from "@/features/attendance/components/esp32-beacon-picker-modal";
import {
  createAttendanceSession,
  getServerTime,
} from "@/services/attendance-session-service";
import {
  configureEsp32Attendance,
  connectToEsp32Beacon,
  disconnectFromEsp32Beacon,
  isBluetoothPoweredOffError,
  isEsp32BeaconConnected,
  scanForEsp32Beacons,
  subscribeToEsp32Disconnection,
  type DetectedEsp32Beacon,
} from "@/services/ble/esp32-beacon-connection";
import type { VerificationMode } from "@/types/attendance-session";
import type { CourseSchedule } from "@/types/course-schedule";
import { logError } from "@/utils/logger";
import {
  formatDateTimeInManila,
  formatDays,
  formatTime,
  getManilaClockFromDate,
  isScheduleActive,
  parseTimeToMinutes,
} from "@/utils/schedule-time";

const MIN_DURATION_MINUTES = 15;
const DURATION_STEP_MINUTES = 5;

function toNumericId(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampDuration(value: number, maxDuration: number) {
  return Math.min(Math.max(value, MIN_DURATION_MINUTES), maxDuration);
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours <= 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

function formatMinutesAsTime(minutes: number) {
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalizedMinutes / 60);
  const minute = normalizedMinutes % 60;
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(2, "0")} ${period}`;
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const theme = useAppTheme();

  return (
    <View
      className="flex-row items-center rounded-md border p-3"
      style={{ borderColor: theme.colors.border }}
    >
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <View className="ml-3 flex-1">
        <Text
          className="text-[11px] font-black uppercase"
          style={{ color: theme.colors.textMuted }}
        >
          {label}
        </Text>
        <Text
          className="mt-0.5 text-sm font-black"
          style={{ color: theme.colors.text }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export function InstructorScheduleDetail({
  schedule,
}: {
  schedule: CourseSchedule;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [verificationMode, setVerificationMode] =
    useState<VerificationMode>("ble_face");
  const [detectedBeacons, setDetectedBeacons] = useState<DetectedEsp32Beacon[]>(
    [],
  );
  const [selectedBeacon, setSelectedBeacon] =
    useState<DetectedEsp32Beacon | null>(null);
  const [isBeaconModalVisible, setIsBeaconModalVisible] = useState(false);
  const [esp32Connected, setEsp32Connected] = useState(false);
  const [esp32Advertising, setEsp32Advertising] = useState(false);
  const [esp32ConnectionLabel, setEsp32ConnectionLabel] = useState<
    string | null
  >(null);
  const [isScanningEsp32, setIsScanningEsp32] = useState(false);
  const [isConnectingEsp32, setIsConnectingEsp32] = useState(false);
  const [requiresPeriodicVerification, setRequiresPeriodicVerification] =
    useState(false);
  const [serverNow, setServerNow] = useState<Date>(() => new Date());
  const [isServerTimeLoading, setIsServerTimeLoading] = useState(true);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [durationInput, setDurationInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const createSessionMutation = useMutation({
    mutationFn: createAttendanceSession,
  });
  const connectedDeviceIdRef = useRef<string | null>(null);
  const disconnectionSubscriptionRef = useRef<{ remove: () => void } | null>(
    null,
  );

  const scheduleId = useMemo(() => toNumericId(schedule.id), [schedule.id]);
  const serverClock = useMemo(
    () => getManilaClockFromDate(serverNow),
    [serverNow],
  );
  const activeNow = isScheduleActive(schedule, serverClock);
  const scheduleEndMinutes = parseTimeToMinutes(schedule.end_time);
  const remainingScheduleMinutes = activeNow
    ? Math.max(0, scheduleEndMinutes - serverClock.minutes)
    : 0;
  const maxDurationMinutes = remainingScheduleMinutes;
  const canMeetMinimumDuration = maxDurationMinutes >= MIN_DURATION_MINUTES;
  const selectedDurationMinutes = canMeetMinimumDuration
    ? clampDuration(durationMinutes ?? maxDurationMinutes, maxDurationMinutes)
    : maxDurationMinutes;
  const selectedEndTime = formatMinutesAsTime(
    serverClock.minutes + selectedDurationMinutes,
  );
  const selectedBeaconId = selectedBeacon?.beaconId ?? null;

  useEffect(() => {
    let isMounted = true;

    getServerTime()
      .then((nextServerTime) => {
        if (isMounted) setServerNow(nextServerTime);
      })
      .finally(() => {
        if (isMounted) setIsServerTimeLoading(false);
      });

    const intervalId = setInterval(() => {
      setServerNow((current) => new Date(current.getTime() + 30_000));
    }, 30_000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    return () => {
      disconnectionSubscriptionRef.current?.remove();
      const deviceId = connectedDeviceIdRef.current;
      if (deviceId) void disconnectFromEsp32Beacon(deviceId);
    };
  }, []);

  const canDecreaseDuration =
    canMeetMinimumDuration && selectedDurationMinutes > MIN_DURATION_MINUTES;
  const canIncreaseDuration =
    canMeetMinimumDuration && selectedDurationMinutes < maxDurationMinutes;
  const canSubmit =
    activeNow &&
    scheduleId !== null &&
    canMeetMinimumDuration &&
    esp32Connected &&
    !isSubmitting &&
    selectedBeaconId !== null;

  const disabledReason = !activeNow
    ? "Attendance can start only during the scheduled class time."
    : !canMeetMinimumDuration
      ? "Remaining schedule time is less than 15 minutes."
      : scheduleId === null
        ? "Schedule ID is unavailable."
        : selectedBeaconId === null
          ? "Select the ESP32 beacon detected for this room."
          : !esp32Connected
            ? "Connect successfully to the ESP32 BLE beacon before starting attendance."
            : null;

  function adjustDuration(amount: number) {
    if (!canMeetMinimumDuration) return;

    const nextDuration = clampDuration(
      selectedDurationMinutes + amount,
      maxDurationMinutes,
    );
    setDurationMinutes(nextDuration);
    setDurationInput(String(nextDuration));
  }

  function handleDurationInputChange(value: string) {
    const numericValue = value.replace(/[^\d]/g, "");
    setDurationInput(numericValue);

    if (!numericValue) {
      setDurationMinutes(null);
      return;
    }

    setDurationMinutes(clampDuration(Number(numericValue), maxDurationMinutes));
  }

  async function handleScanEsp32() {
    setIsBeaconModalVisible(true);
    setIsScanningEsp32(true);
    setError(null);
    setEsp32Connected(false);
    setEsp32Advertising(false);
    setEsp32ConnectionLabel(null);

    disconnectionSubscriptionRef.current?.remove();
    disconnectionSubscriptionRef.current = null;
    const connectedDeviceId = connectedDeviceIdRef.current;
    connectedDeviceIdRef.current = null;
    if (connectedDeviceId) {
      await disconnectFromEsp32Beacon(connectedDeviceId).catch(() => undefined);
    }

    try {
      const beacons = await scanForEsp32Beacons(schedule.room);
      setDetectedBeacons(beacons);
      setSelectedBeacon(beacons.find((beacon) => beacon.isRecommended) ?? null);

      if (beacons.length === 0) {
        setError(
          `No PresenSure ESP32 beacon was detected near ${schedule.room ?? "this room"}.`,
        );
      }
    } catch (scanError) {
      logError("attendance.ble.scan", scanError, {
        scheduleId,
        scheduleRoomName: schedule.room,
      });
      const message =
        scanError instanceof Error
          ? scanError.message
          : "Unable to scan for ESP32 beacons.";
      setError(message);
      if (isBluetoothPoweredOffError(scanError)) {
        setIsBeaconModalVisible(false);
        showBluetoothOffAlert();
      }
    } finally {
      setIsScanningEsp32(false);
    }
  }

  async function handleConnectEsp32(
    beacon: DetectedEsp32Beacon | null = selectedBeacon,
  ) {
    if (!beacon) {
      setError("Select a detected ESP32 beacon first.");
      return;
    }

    setSelectedBeacon(beacon);
    setIsBeaconModalVisible(false);
    setIsConnectingEsp32(true);
    setError(null);
    setEsp32Connected(false);
    setEsp32Advertising(false);
    setEsp32ConnectionLabel(null);

    try {
      const { device } = await connectToEsp32Beacon(beacon.id);
      connectedDeviceIdRef.current = device.id;
      disconnectionSubscriptionRef.current?.remove();
      disconnectionSubscriptionRef.current = subscribeToEsp32Disconnection(
        device.id,
        (message) => {
          connectedDeviceIdRef.current = null;
          setEsp32Connected(false);
          setEsp32ConnectionLabel(null);
          if (message) setError(message);
        },
      );
      setEsp32Connected(true);
      setSelectedBeacon({ ...beacon, beaconId: device.id });
      setEsp32ConnectionLabel(
        device.localName ?? device.name ?? "PresenSure ESP32",
      );
    } catch (connectError) {
      logError("attendance.ble.connect", connectError, {
        scheduleId,
        scheduleRoomName: schedule.room,
        blePeripheralId: beacon.id,
        advertisedName: beacon.name,
      });
      const message =
        connectError instanceof Error
          ? connectError.message
          : "Unable to connect to the ESP32 beacon.";
      setError(message);
      if (isBluetoothPoweredOffError(connectError)) {
        showBluetoothOffAlert();
      }
    } finally {
      setIsConnectingEsp32(false);
    }
  }

  function handleStartSession() {
    if (disabledReason) {
      setError(disabledReason);
      Alert.alert("Complete the form", disabledReason);
      return;
    }

    Alert.alert(
      "Start attendance?",
      "Once attendance starts, these settings cannot be edited.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Attendance",
          onPress: () => void createSession(),
        },
      ],
    );
  }

  async function createSession() {
    if (scheduleId === null || !selectedBeacon || !canSubmit) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const subjectCode = schedule.course_code?.trim();
      const roomCode = schedule.room?.trim();

      if (!subjectCode) {
        throw new Error("This schedule does not include a subject code.");
      }
      if (!roomCode || roomCode === "Room not set") {
        throw new Error("This schedule does not include a room code.");
      }

      if (
        !connectedDeviceIdRef.current ||
        !(await isEsp32BeaconConnected(connectedDeviceIdRef.current))
      ) {
        setEsp32Connected(false);
        setEsp32ConnectionLabel(null);
        throw new Error(
          "The ESP32 disconnected. Connect it again before starting attendance.",
        );
      }

      const response = await createSessionMutation.mutateAsync({
        schedule_id: scheduleId,
        device_id: selectedBeacon.beaconId,
        verification_mode: verificationMode,
        continuous_checking: requiresPeriodicVerification,
        requested_duration_minutes: selectedDurationMinutes,
      });

      const session = response.data.session;
      const parsedEndTime = Date.parse(session.end_at);
      const expiresAt = Number.isInteger(response.data.expires_at_timestamp)
        ? response.data.expires_at_timestamp!
        : !Number.isNaN(parsedEndTime)
          ? Math.floor(parsedEndTime / 1000)
          : (response.data.beacon_configuration?.end_time ?? 0);

      const startSessionCommand = {
        command: "START_SESSION" as const,
        session_id: String(
          response.data.session_id ?? session.attendance_session_id,
        ),
        schedule_id: scheduleId,
        subject_code: subjectCode,
        room_code: roomCode,
        token: response.data.ble_token,
        expires_at: expiresAt,
        verification_mode: verificationMode,
      };

      disconnectionSubscriptionRef.current?.remove();
      disconnectionSubscriptionRef.current = null;
      await configureEsp32Attendance(
        connectedDeviceIdRef.current,
        startSessionCommand,
      );
      await disconnectFromEsp32Beacon(connectedDeviceIdRef.current);
      connectedDeviceIdRef.current = null;
      setEsp32Connected(false);
      setEsp32Advertising(true);
      setEsp32ConnectionLabel(
        "ESP32 is broadcasting rotating attendance tokens",
      );
      queryClient.setQueryData(
        attendanceSessionQueryKeys.active(scheduleId),
        session,
      );
      Alert.alert("Attendance started", response.message);
    } catch (startError) {
      logError("attendance.session.start", startError, {
        scheduleId,
        scheduleRoomName: schedule.room,
        deviceId: selectedBeacon?.beaconId,
        verificationMode,
        continuousChecking: requiresPeriodicVerification,
        requestedDurationMinutes: selectedDurationMinutes,
      });
      disconnectionSubscriptionRef.current?.remove();
      disconnectionSubscriptionRef.current = null;
      const connectedDeviceId = connectedDeviceIdRef.current;
      connectedDeviceIdRef.current = null;
      if (connectedDeviceId) {
        await disconnectFromEsp32Beacon(connectedDeviceId).catch(
          (disconnectError) => {
            logError("attendance.ble.disconnect-after-error", disconnectError, {
              blePeripheralId: connectedDeviceId,
            });
          },
        );
      }
      setEsp32Connected(false);
      setEsp32ConnectionLabel(null);
      const message =
        startError instanceof Error
          ? startError.message
          : "Unable to start attendance session.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!activeNow) {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          className="items-center rounded-[20px] border p-6 shadow-md shadow-slate-900/10"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          }}
        >
          <Ionicons
            name="time-outline"
            size={42}
            color={theme.colors.textMuted}
          />
          <Text
            className="mt-3 text-lg font-black"
            style={{ color: theme.colors.text }}
          >
            Attendance cannot be started
          </Text>
          <Text
            className="mt-2 text-center text-sm font-bold leading-5"
            style={{ color: theme.colors.textMuted }}
          >
            This is not the current scheduled class time. Attendance can only be
            started during the schedule window.
          </Text>
          <View className="mt-5 w-full gap-3">
            <DetailRow
              icon="calendar-outline"
              label="Schedule"
              value={`${formatDays(schedule.days ?? schedule.day)} | ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`}
            />
            <DetailRow
              icon="server-outline"
              label="Current server time"
              value={
                isServerTimeLoading
                  ? "Syncing time"
                  : formatDateTimeInManila(serverNow)
              }
            />
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View className="flex-1">
      <Esp32BeaconPickerModal
        beacons={detectedBeacons}
        isScanning={isScanningEsp32}
        onClose={() => setIsBeaconModalVisible(false)}
        onConfirm={(beacon) => {
          void handleConnectEsp32(beacon);
        }}
        onScan={handleScanEsp32}
        onSelect={(beacon) => {
          disconnectionSubscriptionRef.current?.remove();
          disconnectionSubscriptionRef.current = null;
          const connectedDeviceId = connectedDeviceIdRef.current;
          connectedDeviceIdRef.current = null;
          if (connectedDeviceId) {
            void disconnectFromEsp32Beacon(connectedDeviceId);
          }
          setSelectedBeacon(beacon);
          setEsp32Connected(false);
          setEsp32Advertising(false);
          setEsp32ConnectionLabel(null);
        }}
        roomName={schedule.room}
        selectedBeacon={selectedBeacon}
        visible={isBeaconModalVisible}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16, paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <View
        className="rounded-[20px] p-4"
        style={{
          backgroundColor: theme.colors.surface,
          elevation: 6,
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: theme.resolvedMode === "dark" ? 0.3 : 0.18,
          shadowRadius: 20,
        }}
      >
        <View className="flex-row items-center">
          <View
            className="mr-2.5 h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.primarySoft }}
          >
            <Ionicons name="radio" size={19} color={theme.colors.primary} />
          </View>
          <View className="flex-1">
            <Text
              className="text-base font-black"
              style={{ color: theme.colors.text }}
            >
              Start Attendance
            </Text>
            <Text
              className="mt-0.5 text-xs font-bold"
              style={{
                color: activeNow
                  ? theme.colors.success
                  : theme.colors.textMuted,
              }}
            >
              {activeNow
                ? "Class is active now."
                : "Waiting for schedule time."}
            </Text>
          </View>
        </View>

        <View className="mt-4">
          <Text
            className="mb-2 text-[11px] font-black uppercase"
            style={{ color: theme.colors.textMuted }}
          >
            Attendance verification mode
          </Text>
          <View
            className="flex-row rounded-full p-1"
            style={{ backgroundColor: theme.colors.surfaceMuted }}
          >
            {(["ble_face", "ble", "face"] as VerificationMode[]).map((mode) => {
              const selected = verificationMode === mode;
              const label =
                mode === "ble_face"
                  ? "BLE + Face"
                  : mode === "ble"
                    ? "BLE"
                    : "Face";

              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  onPress={() => setVerificationMode(mode)}
                  className="min-h-[36px] flex-1 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: selected
                      ? theme.colors.surface
                      : "transparent",
                  }}
                >
                  <Text
                    className="text-[12px] font-black"
                    style={{
                      color: selected
                        ? theme.colors.text
                        : theme.colors.textMuted,
                    }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-4">
          <View className="mb-2 flex-row items-center justify-between">
            <Text
              className="text-[11px] font-black uppercase"
              style={{ color: theme.colors.textMuted }}
            >
              Duration
            </Text>
            <Text
              className="text-[11px] font-bold"
              style={{ color: theme.colors.textMuted }}
            >
              {canMeetMinimumDuration
                ? `15 min–${formatDuration(maxDurationMinutes)}`
                : "Unavailable now"}
            </Text>
          </View>
          <View
            className="flex-row items-center rounded-[16px] p-1.5"
            style={{ backgroundColor: theme.colors.surfaceMuted }}
          >
            <Pressable
              accessibilityRole="button"
              disabled={!canDecreaseDuration}
              onPress={() => adjustDuration(-DURATION_STEP_MINUTES)}
              className="h-11 w-11 items-center justify-center rounded-[12px]"
              style={{
                backgroundColor: canDecreaseDuration
                  ? theme.colors.surface
                  : "transparent",
              }}
            >
              <Ionicons
                name="remove"
                size={22}
                color={
                  canDecreaseDuration
                    ? theme.colors.primary
                    : theme.colors.textMuted
                }
              />
            </Pressable>

            <View className="mx-2 flex-1 items-center justify-center">
              <View className="flex-row items-baseline justify-center">
                <TextInput
                  value={durationInput || String(selectedDurationMinutes)}
                  onChangeText={handleDurationInputChange}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  className="min-w-[44px] p-0 text-right text-2xl font-black"
                  style={{ color: theme.colors.text }}
                />
                <Text
                  className="ml-1 text-xs font-black"
                  style={{ color: theme.colors.textMuted }}
                >
                  min
                </Text>
              </View>
              <Text
                className="text-[11px] font-bold"
                style={{ color: theme.colors.textMuted }}
              >
                Ends at {selectedEndTime}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={!canIncreaseDuration}
              onPress={() => adjustDuration(DURATION_STEP_MINUTES)}
              className="h-11 w-11 items-center justify-center rounded-[12px]"
              style={{
                backgroundColor: canIncreaseDuration
                  ? theme.colors.surface
                  : "transparent",
              }}
            >
              <Ionicons
                name="add"
                size={22}
                color={
                  canIncreaseDuration
                    ? theme.colors.primary
                    : theme.colors.textMuted
                }
              />
            </Pressable>
          </View>
        </View>

        <View
          className="mt-3 flex-row items-center rounded-[14px] p-2.5"
          style={{
            backgroundColor: theme.colors.surfaceMuted,
          }}
        >
          <Switch
            value={requiresPeriodicVerification}
            onValueChange={setRequiresPeriodicVerification}
            trackColor={{
              false: theme.colors.textMuted,
              true: theme.colors.primary,
            }}
            thumbColor={
              requiresPeriodicVerification
                ? "#FFFFFF"
                : theme.colors.surface
            }
            ios_backgroundColor={theme.colors.textMuted}
          />
          <View className="ml-3 flex-1">
            <Text
              className="text-sm font-black"
              style={{ color: theme.colors.text }}
            >
              2 min student rescan
            </Text>
            <Text
              className="mt-0.5 text-xs font-bold leading-5"
              style={{ color: theme.colors.textMuted }}
            >
              {requiresPeriodicVerification
                ? "Students rescan every 2 minutes."
                : "Students verify once."}
            </Text>
          </View>
        </View>
        <View className="mt-3 flex-row items-center rounded-[14px] p-2.5">
          <Ionicons
            name={
              esp32Connected || esp32Advertising
                ? "checkmark-circle"
                : "alert-circle-outline"
            }
            size={22}
            color={
              esp32Connected || esp32Advertising
                ? theme.colors.success
                : theme.colors.textMuted
            }
          />
          <Text
            className="ml-2 flex-1 text-sm font-black"
            style={{ color: theme.colors.text }}
          >
            {esp32Advertising
              ? "ESP32 attendance advertising active"
              : esp32Connected
                ? "ESP32 BLE connected"
                : "ESP32 BLE not connected"}
          </Text>
        </View>

        <View className="mt-3 gap-2">
          <Pressable
            accessibilityRole="button"
            disabled={isScanningEsp32}
            onPress={handleScanEsp32}
            className="min-h-[44px] flex-row items-center justify-center rounded-[12px] px-3"
            style={{
              backgroundColor: theme.colors.primarySoft,
            }}
          >
            {isScanningEsp32 ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Ionicons
                name="search-outline"
                size={20}
                color={theme.colors.primary}
              />
            )}
            <Text
              className="ml-2 text-sm font-black"
              style={{ color: theme.colors.text }}
            >
              {selectedBeacon
                ? `Selected ${selectedBeacon.name}`
                : isScanningEsp32
                  ? "Scanning nearby ESP32 beacons"
                  : "Scan ESP32 beacons"}
            </Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={isConnectingEsp32 || !selectedBeacon}
            onPress={() => {
              void handleConnectEsp32();
            }}
            className="min-h-[44px] flex-row items-center rounded-[12px] px-3"
            style={{
              backgroundColor: theme.colors.surfaceMuted,
            }}
          >
            {isConnectingEsp32 ? (
              <ActivityIndicator color={theme.colors.primary} />
            ) : (
              <Ionicons
                name={esp32Connected ? "checkmark-circle" : "bluetooth-outline"}
                size={22}
                color={
                  esp32Connected ? theme.colors.primary : theme.colors.textMuted
                }
              />
            )}
            <View className="ml-2 flex-1">
              <Text
                className="text-sm font-bold"
                style={{ color: theme.colors.text }}
              >
                {isConnectingEsp32
                  ? "Connecting to ESP32 BLE beacon"
                  : esp32Connected
                    ? "Successfully connected to ESP32 BLE beacon"
                    : selectedBeacon
                      ? `Connect to ${selectedBeacon.name}`
                      : "Select a detected ESP32 beacon"}
              </Text>
              {esp32ConnectionLabel ? (
                <Text
                  className="mt-0.5 text-xs font-bold"
                  style={{ color: theme.colors.textMuted }}
                >
                  {esp32ConnectionLabel}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </View>

        {disabledReason ? (
          <Text
            className="mt-3 text-xs font-bold"
            style={{ color: theme.colors.textMuted }}
          >
            {disabledReason}
          </Text>
        ) : null}

        {error ? (
          <Text
            className="mt-3 text-xs font-bold"
            style={{ color: theme.colors.danger }}
          >
            {error}
          </Text>
        ) : null}

      </View>
      </ScrollView>

      <View
        className="px-4 pt-3"
        style={{
          backgroundColor: theme.colors.background,
          paddingBottom: Math.max(insets.bottom, 16),
        }}
      >
        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={handleStartSession}
          className={`min-h-14 flex-row items-center justify-center rounded-[14px] border-2 border-blue-700 bg-blue-600 shadow-lg shadow-blue-600/40 active:opacity-80 ${isSubmitting ? "opacity-80" : ""}`}
        >
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : null}
          <Text
            className={isSubmitting ? "ml-2 text-base font-black text-white" : "text-base font-black text-white"}
          >
            {isSubmitting ? "Starting" : "Start Attendance"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
