import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { useAppTheme } from "@/app/providers/theme-provider";
import { attendanceSessionQueryKeys } from "@/features/attendance/attendance-session-query-keys";
import { showBluetoothOffAlert } from "@/features/attendance/bluetooth-settings-alert";
import { Esp32BeaconPickerModal } from "@/features/attendance/components/esp32-beacon-picker-modal";
import { stopAttendanceSession } from "@/services/attendance-session-service";
import {
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
import { formatDateTimeInManila } from "@/utils/schedule-time";

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
  const [connectionLabel, setConnectionLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const connectedDeviceIdRef = useRef<string | null>(null);
  const disconnectionSubscriptionRef = useRef<{ remove: () => void } | null>(null);
  const stopSessionMutation = useMutation({ mutationFn: stopAttendanceSession });

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
    const deviceId = connectedDeviceIdRef.current;
    if (!deviceId || !(await isEsp32BeaconConnected(deviceId))) {
      setIsConnected(false);
      setHasContinued(false);
      setConnectionLabel(null);
      setError("Connect to the active ESP32 beacon before continuing attendance.");
      return;
    }

    setError(null);
    setHasContinued(true);
    Alert.alert(
      "Attendance continued",
      "The attendance controls are ready. No server changes were made.",
    );
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
          status: response.data?.status ?? "ended",
          end_at: response.data?.end_at ?? session.end_at,
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
          <Pressable
            accessibilityRole="button"
            disabled={!isConnected || isScanning || isConnecting}
            onPress={() => void handleContinue()}
            className={`mt-3 min-h-14 w-full flex-row items-center justify-center rounded-[14px] border-2 ${
              isConnected && !isScanning && !isConnecting
                ? "border-blue-700 bg-blue-600 shadow-lg shadow-blue-600/40 active:opacity-80"
                : "border-slate-300 bg-slate-200 opacity-70"
            }`}
          >
            <Ionicons
              name="play-circle-outline"
              size={21}
              color={isConnected ? "#FFFFFF" : theme.colors.textMuted}
            />
            <Text
              className={`ml-2 text-base font-black ${
                isConnected ? "text-white" : "text-slate-500"
              }`}
            >
              Continue Attendance
            </Text>
          </Pressable>
        ) : hasContinued ? (
          <View className="mt-3 w-full flex-row items-center rounded-[14px] bg-emerald-50 p-3">
            <Ionicons name="checkmark-circle" size={22} color="#16A34A" />
            <Text className="ml-2 flex-1 text-sm font-black text-emerald-700">
              Attendance controls are ready
            </Text>
          </View>
        ) : null}

        {sessionIsActive || hasContinued ? (
          <Pressable
            accessibilityRole="button"
            disabled={!isConnected || isStopping}
            onPress={confirmStop}
            className={`mt-3 min-h-14 w-full flex-row items-center justify-center rounded-[14px] border-2 ${
              isConnected && !isStopping
                ? "border-red-700 bg-red-600 shadow-lg shadow-red-600/40 active:opacity-80"
                : "border-slate-300 bg-slate-200 opacity-70"
            }`}
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
