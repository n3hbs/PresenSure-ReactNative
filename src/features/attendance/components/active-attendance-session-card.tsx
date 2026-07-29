import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAppTheme } from "@/app/providers/theme-provider";
import { attendanceSessionQueryKeys } from "@/features/attendance/attendance-session-query-keys";
import { showBluetoothOffAlert } from "@/features/attendance/bluetooth-settings-alert";
import { Esp32BeaconPickerModal } from "@/features/attendance/components/esp32-beacon-picker-modal";
import {
  continueAttendanceSession,
  getServerTime,
  stopAttendanceSession,
} from "@/services/attendance-session-service";
import {
  configureEsp32Attendance,
  connectToEsp32Beacon,
  disconnectFromEsp32Beacon,
  isEsp32BeaconConnected,
  isBluetoothPoweredOffError,
  scanForEsp32Beacons,
  stopEsp32Attendance,
  subscribeToEsp32Disconnection,
  type DetectedEsp32Beacon,
} from "@/services/ble/esp32-beacon-connection";
import type { AttendanceSession } from "@/types/attendance-session";
import type { CourseSchedule } from "@/types/course-schedule";
import { logError } from "@/utils/logger";
import {
  formatDateTimeInManila,
  getManilaClockFromDate,
  parseTimeToMinutes,
} from "@/utils/schedule-time";

const MIN_DURATION_MINUTES = 15;
const DURATION_STEP_MINUTES = 5;

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

export function ActiveAttendanceSessionCard({
  schedule,
  session,
}: {
  schedule: CourseSchedule;
  session: AttendanceSession;
}) {
  const theme = useAppTheme();
  const queryClient = useQueryClient();
  const normalizedStatus = session.status.trim().toLowerCase();
  const sessionIsActive = normalizedStatus === "active";
  const sessionIsEnded = normalizedStatus === "ended";
  const [beacons, setBeacons] = useState<DetectedEsp32Beacon[]>([]);
  const [selectedBeacon, setSelectedBeacon] =
    useState<DetectedEsp32Beacon | null>(null);
  const [isBeaconModalVisible, setIsBeaconModalVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [hasContinued, setHasContinued] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [serverNow, setServerNow] = useState<Date>(() => new Date());
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [durationInput, setDurationInput] = useState("");
  const [connectionLabel, setConnectionLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectedDeviceIdRef = useRef<string | null>(null);
  const disconnectionSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const stopSessionMutation = useMutation({ mutationFn: stopAttendanceSession });
  const continueSessionMutation = useMutation({
    mutationFn: continueAttendanceSession,
  });
  const serverClock = getManilaClockFromDate(serverNow);
  const maxDurationMinutes = Math.max(
    0,
    parseTimeToMinutes(schedule.end_time) - serverClock.minutes,
  );
  const canMeetMinimumDuration = maxDurationMinutes >= MIN_DURATION_MINUTES;
  const selectedDurationMinutes = canMeetMinimumDuration
    ? clampDuration(durationMinutes ?? maxDurationMinutes, maxDurationMinutes)
    : maxDurationMinutes;
  const selectedEndTime = formatMinutesAsTime(
    serverClock.minutes + selectedDurationMinutes,
  );
  const canDecreaseDuration =
    canMeetMinimumDuration && selectedDurationMinutes > MIN_DURATION_MINUTES;
  const canIncreaseDuration =
    canMeetMinimumDuration && selectedDurationMinutes < maxDurationMinutes;

  useEffect(() => {
    let isMounted = true;

    getServerTime().then((nextServerTime) => {
      if (isMounted) setServerNow(nextServerTime);
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

  async function disconnectCurrentBeacon() {
    disconnectionSubscriptionRef.current?.remove();
    disconnectionSubscriptionRef.current = null;
    const deviceId = connectedDeviceIdRef.current;
    connectedDeviceIdRef.current = null;
    setIsConnected(false);
    setHasContinued(false);
    setConnectionLabel(null);
    if (deviceId) {
      await disconnectFromEsp32Beacon(deviceId).catch(() => undefined);
    }
  }

  async function handleScan() {
    setIsBeaconModalVisible(true);
    setIsScanning(true);
    setError(null);
    await disconnectCurrentBeacon();

    try {
      const detectedBeacons = await scanForEsp32Beacons(schedule.room);
      setBeacons(detectedBeacons);
      setSelectedBeacon(
        detectedBeacons.find((beacon) => beacon.isRecommended) ?? null,
      );
      if (detectedBeacons.length === 0) {
        setError(
          `No PresenSure ESP32 beacon was detected near ${schedule.room ?? "this room"}.`,
        );
      }
    } catch (scanError) {
      logError("attendance.stop.ble.scan", scanError, {
        attendanceSessionId: session.attendance_session_id,
        scheduleId: session.schedule_id,
      });
      setError(
        scanError instanceof Error
          ? scanError.message
          : "Unable to scan for the ESP32 beacon.",
      );
      if (isBluetoothPoweredOffError(scanError)) {
        setIsBeaconModalVisible(false);
        showBluetoothOffAlert();
      }
    } finally {
      setIsScanning(false);
    }
  }

  async function handleConnect(beacon: DetectedEsp32Beacon) {
    setSelectedBeacon(beacon);
    setIsBeaconModalVisible(false);
    setIsConnecting(true);
    setError(null);

    try {
      const { device } = await connectToEsp32Beacon(beacon.id);
      connectedDeviceIdRef.current = device.id;
      disconnectionSubscriptionRef.current?.remove();
      disconnectionSubscriptionRef.current = subscribeToEsp32Disconnection(
        device.id,
        (message) => {
          connectedDeviceIdRef.current = null;
          setIsConnected(false);
          setHasContinued(false);
          setConnectionLabel(null);
          if (message) setError(message);
        },
      );
      setIsConnected(true);
      setConnectionLabel(
        device.localName ?? device.name ?? "PresenSure ESP32",
      );
    } catch (connectError) {
      logError("attendance.stop.ble.connect", connectError, {
        attendanceSessionId: session.attendance_session_id,
        blePeripheralId: beacon.id,
      });
      setError(
        connectError instanceof Error
          ? connectError.message
          : "Unable to connect to the ESP32 beacon.",
      );
      if (isBluetoothPoweredOffError(connectError)) {
        showBluetoothOffAlert();
      }
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleContinue() {
    if (!canMeetMinimumDuration) {
      setError("Remaining schedule time is less than 15 minutes.");
      return;
    }

    const deviceId = connectedDeviceIdRef.current;
    if (!deviceId || !(await isEsp32BeaconConnected(deviceId))) {
      setIsConnected(false);
      setHasContinued(false);
      setConnectionLabel(null);
      setError("Connect to the active ESP32 beacon before continuing attendance.");
      return;
    }

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

      const response = await continueSessionMutation.mutateAsync({
        attendance_session_id: session.attendance_session_id,
        schedule_id: session.schedule_id,
        device_id: selectedBeacon?.beaconId ?? deviceId,
      });
      const continuedSession = response.data.session;
      const parsedEndTime = Date.parse(continuedSession.end_at);
      const expiresAt = !Number.isNaN(parsedEndTime)
        ? Math.floor(parsedEndTime / 1000)
        : response.data.beacon_configuration.end_time;

      await configureEsp32Attendance(deviceId, {
        command: "START_SESSION",
        session_id: String(continuedSession.attendance_session_id),
        schedule_id: continuedSession.schedule_id,
        subject_code: subjectCode,
        room_code: roomCode,
        token: response.data.ble_token,
        expires_at: expiresAt,
      });

      setHasContinued(true);
      queryClient.setQueryData<AttendanceSession>(
        attendanceSessionQueryKeys.active(session.schedule_id),
        continuedSession,
      );
      Alert.alert("Attendance continued", response.message);
    } catch (continueError) {
      logError("attendance.session.continue", continueError, {
        attendanceSessionId: session.attendance_session_id,
        scheduleId: session.schedule_id,
        blePeripheralId: deviceId,
      });
      setError(
        continueError instanceof Error
          ? continueError.message
          : "Unable to continue the attendance session.",
      );
    }
  }

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

  async function handleStop() {
    const deviceId = connectedDeviceIdRef.current;
    if (!deviceId || !(await isEsp32BeaconConnected(deviceId))) {
      setIsConnected(false);
      setConnectionLabel(null);
      setError("Connect to the active ESP32 beacon before stopping attendance.");
      return;
    }

    setIsStopping(true);
    setError(null);
    let esp32Stopped = false;

    try {
      await stopEsp32Attendance(deviceId, {
        command: "STOP_SESSION",
        session_id: String(session.attendance_session_id),
        schedule_id: session.schedule_id,
      });
      esp32Stopped = true;

      const response = await stopSessionMutation.mutateAsync({
        attendance_session_id: session.attendance_session_id,
        schedule_id: session.schedule_id,
      });

      await disconnectCurrentBeacon();
      queryClient.setQueryData<AttendanceSession>(
        attendanceSessionQueryKeys.active(session.schedule_id),
        {
          ...session,
          status: response.data?.session.status ?? "ended",
          end_at: response.data?.session.end_at ?? session.end_at,
          updated_at: new Date().toISOString(),
        },
      );
      Alert.alert("Attendance stopped", response.message);
    } catch (stopError) {
      logError("attendance.session.stop", stopError, {
        attendanceSessionId: session.attendance_session_id,
        scheduleId: session.schedule_id,
        blePeripheralId: deviceId,
        esp32Stopped,
      });
      const message =
        stopError instanceof Error
          ? stopError.message
          : "Unable to stop the attendance session.";
      setError(
        esp32Stopped
          ? `The ESP32 stopped broadcasting, but the server was not updated: ${message} Retry while still connected.`
          : message,
      );
    } finally {
      setIsStopping(false);
    }
  }

  function confirmStop() {
    Alert.alert(
      "Stop attendance?",
      "This stops the ESP32 broadcast and ends the active attendance session.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop Attendance",
          style: "destructive",
          onPress: () => void handleStop(),
        },
      ],
    );
  }

  return (
    <View className="mx-4 gap-4">
      <Esp32BeaconPickerModal
        beacons={beacons}
        isScanning={isScanning}
        onClose={() => setIsBeaconModalVisible(false)}
        onConfirm={(beacon) => void handleConnect(beacon)}
        onScan={() => void handleScan()}
        onSelect={setSelectedBeacon}
        roomName={schedule.room}
        selectedBeacon={selectedBeacon}
        visible={isBeaconModalVisible}
      />

      <View
        className="items-center rounded-[20px] border p-6 shadow-md shadow-slate-900/10"
        style={{
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        }}
      >
        <View
          className="h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.colors.primarySoft }}
        >
          <Ionicons name="radio" size={32} color={theme.colors.primary} />
        </View>
        <Text
          className="mt-4 text-center text-lg font-black"
          style={{ color: theme.colors.text }}
        >
          {hasContinued
            ? "Attendance session continued"
            : sessionIsActive
              ? "Attendance session active"
              : "Attendance session ended"}
        </Text>
        <Text
          className="mt-2 text-center text-sm font-bold leading-5"
          style={{ color: theme.colors.textMuted }}
        >
          {hasContinued
            ? "You can now manage this session and stop attendance when needed."
            : sessionIsActive
              ? "Connect to the active ESP32 beacon before stopping attendance."
              : "Connect to the ESP32 beacon before continuing this attendance session."}
        </Text>

        <View
          className="mt-5 w-full rounded-md border p-4"
          style={{
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
          }}
        >
          <Text className="text-sm font-black" style={{ color: theme.colors.text }}>
            Session {session.session_code}
          </Text>
          <Text className="mt-2 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
            Mode: {session.verification_mode.replaceAll("_", " + ")}
          </Text>
          <Text className="mt-1 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
            Started: {formatDateTimeInManila(session.start_at)}
          </Text>
          <Text className="mt-1 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
            Ends: {formatDateTimeInManila(session.end_at)}
          </Text>
        </View>

        <View
          className="mt-4 w-full flex-row items-center rounded-md border p-3"
          style={{ borderColor: theme.colors.border }}
        >
          <Ionicons
            name={isConnected ? "checkmark-circle" : "bluetooth-outline"}
            size={22}
            color={isConnected ? theme.colors.success : theme.colors.textMuted}
          />
          <View className="ml-2 flex-1">
            <Text className="text-sm font-black" style={{ color: theme.colors.text }}>
              {isConnecting
                ? "Connecting to ESP32"
                : isConnected
                  ? "ESP32 connected"
                  : "ESP32 connection required"}
            </Text>
            {connectionLabel ? (
              <Text className="mt-1 text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                {connectionLabel}
              </Text>
            ) : null}
          </View>
          {isConnecting ? <ActivityIndicator color={theme.colors.primary} /> : null}
        </View>

        {error ? (
          <Text className="mt-4 text-center text-sm font-bold" style={{ color: theme.colors.danger }}>
            {error}
          </Text>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={isScanning || isConnecting || isStopping}
          onPress={() => void handleScan()}
          className="mt-5 min-h-[48px] w-full flex-row items-center justify-center rounded-md border"
          style={{ borderColor: theme.colors.primary }}
        >
          {isScanning ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Ionicons name="search-outline" size={20} color={theme.colors.primary} />
          )}
          <Text className="ml-2 font-black" style={{ color: theme.colors.primary }}>
            {isConnected ? "Connect a Different ESP32" : "Scan and Connect ESP32"}
          </Text>
        </Pressable>

        {sessionIsEnded && !hasContinued ? (
          <View key="continue-duration" className="mt-4 w-full">
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
        ) : null}

        {sessionIsEnded && !hasContinued ? (
          <Pressable
            key="continue-attendance"
            accessibilityRole="button"
            disabled={
              !isConnected ||
              !canMeetMinimumDuration ||
              isScanning ||
              isConnecting ||
              continueSessionMutation.isPending
            }
            onPress={() => void handleContinue()}
            className="mt-3 min-h-14 w-full flex-row items-center justify-center rounded-[14px] border-2 active:opacity-80"
            style={{
              backgroundColor:
                isConnected && canMeetMinimumDuration ? "#2563EB" : "#E2E8F0",
              borderColor:
                isConnected && canMeetMinimumDuration ? "#1D4ED8" : "#CBD5E1",
              elevation: isConnected && canMeetMinimumDuration ? 8 : 0,
              opacity: isConnected && canMeetMinimumDuration ? 1 : 0.7,
              shadowColor:
                isConnected && canMeetMinimumDuration ? "#2563EB" : "transparent",
              shadowOpacity: isConnected && canMeetMinimumDuration ? 0.4 : 0,
              shadowRadius: isConnected && canMeetMinimumDuration ? 8 : 0,
            }}
          >
            {continueSessionMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Ionicons
                name="play-circle-outline"
                size={21}
                color={
                  isConnected && canMeetMinimumDuration
                    ? "#FFFFFF"
                    : theme.colors.textMuted
                }
              />
            )}
            <Text
              className={`ml-2 text-base font-black ${
                isConnected && canMeetMinimumDuration
                  ? "text-white"
                  : "text-slate-500"
              }`}
            >
              {continueSessionMutation.isPending
                ? "Continuing Attendance"
                : "Continue Attendance"}
            </Text>
          </Pressable>
        ) : hasContinued ? (
          <View
            key="continued-status"
            className="mt-3 w-full flex-row items-center rounded-[14px] bg-emerald-50 p-3"
          >
            <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            <Text className="ml-2 flex-1 text-sm font-black text-emerald-700">
              Attendance controls are ready
            </Text>
          </View>
        ) : null}

        {sessionIsActive || hasContinued ? (
          <Pressable
            key="stop-attendance"
            accessibilityRole="button"
            disabled={!isConnected || isStopping}
            onPress={confirmStop}
            className="mt-3 min-h-14 w-full flex-row items-center justify-center rounded-[14px] border-2 active:opacity-80"
            style={{
              backgroundColor:
                isConnected && !isStopping ? "#DC2626" : "#E2E8F0",
              borderColor:
                isConnected && !isStopping ? "#B91C1C" : "#CBD5E1",
              elevation: isConnected && !isStopping ? 8 : 0,
              opacity: isConnected && !isStopping ? 1 : 0.7,
              shadowColor:
                isConnected && !isStopping ? "#DC2626" : "transparent",
              shadowOpacity: isConnected && !isStopping ? 0.4 : 0,
              shadowRadius: isConnected && !isStopping ? 8 : 0,
            }}
          >
            {isStopping ? <ActivityIndicator color="#FFFFFF" /> : null}
            <Text
              className={
                isStopping
                  ? "ml-2 text-base font-black text-white"
                  : "text-base font-black text-white"
              }
            >
              {isStopping ? "Stopping Attendance" : "Stop Attendance"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
