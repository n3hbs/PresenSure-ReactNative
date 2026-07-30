import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';
import { showBluetoothOffAlert } from '@/features/attendance/bluetooth-settings-alert';
import {
  isBluetoothPoweredOffError,
  scanForEsp32Beacons,
  type DetectedEsp32Beacon,
} from '@/services/ble/esp32-beacon-connection';
import type { AttendanceSession } from '@/types/attendance-session';
import type { CourseSchedule } from '@/types/course-schedule';
import { formatDays, formatTime, isScheduleActive } from '@/utils/schedule-time';

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
      style={{ borderColor: theme.colors.border }}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <View className="ml-3 flex-1">
        <Text
          className="text-[11px] font-black uppercase"
          style={{ color: theme.colors.textMuted }}>
          {label}
        </Text>
        <Text
          className="mt-0.5 text-sm font-black"
          style={{ color: theme.colors.text }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export function StudentScheduleDetail({
  activeSession,
  schedule,
}: {
  activeSession: AttendanceSession | null;
  schedule: CourseSchedule;
}) {
  const theme = useAppTheme();
  const activeNow = isScheduleActive(schedule);
  const normalizedStatus = activeSession?.status?.trim().toLowerCase();
  const isSessionActive = activeSession !== null && normalizedStatus === 'active';
  const isSessionEnded =
    activeSession !== null &&
    (normalizedStatus === 'ended' || normalizedStatus === 'stopped' || normalizedStatus === 'closed');
  const isAvailable = isSessionActive;
  const expectedRoomName = schedule.room ?? 'Not set';

  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [beacons, setBeacons] = useState<DetectedEsp32Beacon[]>([]);
  const [selectedBeacon, setSelectedBeacon] = useState<DetectedEsp32Beacon | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  async function handleScanBluetooth() {
    try {
      setIsScanning(true);
      setScanError(null);
      const results = await scanForEsp32Beacons(schedule.room);
      setBeacons(results);
      setHasScanned(true);

      // Auto-select recommended matching beacon if available
      const match = results.find((b) => b.isRecommended) ?? results[0] ?? null;
      setSelectedBeacon(match);
    } catch (error) {
      if (isBluetoothPoweredOffError(error)) {
        showBluetoothOffAlert();
      } else {
        const message =
          error instanceof Error ? error.message : 'Failed to scan for Bluetooth signals.';
        setScanError(message);
        Alert.alert('Scan Failed', message);
      }
    } finally {
      setIsScanning(false);
    }
  }

  if (!isAvailable) {
    return (
      <View className="flex-1" style={{ paddingHorizontal: 16 }}>
        <View
          className="items-center rounded-[20px] border p-6 shadow-md shadow-slate-900/10"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          }}>
          <View
            className="mb-3 h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.primarySoft }}>
            <Ionicons name="time-outline" size={26} color={theme.colors.primary} />
          </View>

          <Text className="mt-1 text-lg font-black" style={{ color: theme.colors.text }}>
            {isSessionEnded
              ? 'Attendance Session Ended'
              : activeNow
              ? 'Attendance Not Started'
              : 'Attendance Not Active'}
          </Text>

          <Text
            className="mt-2 text-center text-sm font-bold leading-5"
            style={{ color: theme.colors.textMuted }}>
            {isSessionEnded
              ? 'The instructor has ended the attendance session for this class.'
              : activeNow
              ? 'Waiting for your instructor to start an attendance session.'
              : 'No active attendance session or class schedule is running right now. Bluetooth scanning will be enabled when your instructor starts attendance.'}
          </Text>

          <View className="mt-5 w-full gap-3">
            <DetailRow
              icon="calendar-outline"
              label="Schedule"
              value={`${formatDays(schedule.days ?? schedule.day)} | ${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`}
            />
            <DetailRow
              icon="location-outline"
              label="Room"
              value={schedule.room ?? 'Room TBD'}
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ paddingHorizontal: 16 }}>
      {/* Instructor-styled Main Scanning Card */}
      <View
        className="rounded-[20px] p-4"
        style={{
          backgroundColor: theme.colors.surface,
          elevation: 6,
          shadowColor: '#0F172A',
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: theme.resolvedMode === 'dark' ? 0.3 : 0.18,
          shadowRadius: 20,
        }}>
        <View className="flex-row items-center">
          <View
            className="mr-3 h-11 w-11 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.primarySoft }}>
            <Ionicons name="bluetooth" size={22} color={theme.colors.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-black" style={{ color: theme.colors.text }}>
              ESP32 Beacons
            </Text>
            <Text className="mt-0.5 text-xs font-bold" style={{ color: theme.colors.textMuted }}>
              Recommended room: {expectedRoomName}
            </Text>
          </View>

          {activeSession?.session_code && (
            <View
              className="rounded-full px-3 py-1"
              style={{ backgroundColor: theme.colors.primarySoft }}>
              <Text className="text-xs font-black" style={{ color: theme.colors.primary }}>
                #{activeSession.session_code}
              </Text>
            </View>
          )}
        </View>

        {/* Scan Action Button matching Instructor UI */}
        <Pressable
          accessibilityRole="button"
          disabled={isScanning}
          onPress={handleScanBluetooth}
          className="mt-4 flex-row items-center justify-center rounded-md border p-3"
          style={{
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.background,
          }}>
          {isScanning ? (
            <ActivityIndicator color={theme.colors.primary} />
          ) : (
            <Ionicons name="refresh-outline" size={20} color={theme.colors.primary} />
          )}
          <Text className="ml-2 text-sm font-black" style={{ color: theme.colors.text }}>
            {isScanning ? 'Scanning PresenSure BLE' : hasScanned ? 'Scan again' : 'Scan PresenSure BLE'}
          </Text>
        </Pressable>

        {/* Scan Results / Beacon List matching Instructor UI */}
        <View className="mt-4">
          {isScanning && beacons.length === 0 ? (
            <View className="items-center py-8">
              <ActivityIndicator color={theme.colors.primary} />
              <Text className="mt-3 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
                Looking for PresenSure BLE beacons
              </Text>
            </View>
          ) : null}

          {!isScanning && hasScanned && beacons.length === 0 ? (
            <View className="items-center rounded-md border p-5" style={{ borderColor: theme.colors.border }}>
              <Ionicons name="radio-outline" size={32} color={theme.colors.textMuted} />
              <Text className="mt-3 text-sm font-black" style={{ color: theme.colors.text }}>
                No PresenSure BLE found
              </Text>
              <Text className="mt-1 text-center text-xs font-bold leading-5" style={{ color: theme.colors.textMuted }}>
                Make sure the ESP32 is powered on and named PresenSure-{expectedRoomName}.
              </Text>
            </View>
          ) : null}

          {beacons.length > 0 && (
            <View className="gap-2">
              {beacons.map((beacon) => {
                const selected = selectedBeacon?.id === beacon.id;
                const borderColor = beacon.isRecommended
                  ? theme.colors.success
                  : selected
                  ? theme.colors.primary
                  : theme.colors.border;

                return (
                  <Pressable
                    key={beacon.id}
                    accessibilityRole="button"
                    onPress={() => setSelectedBeacon(beacon)}
                    className="rounded-md border p-3"
                    style={{
                      borderColor,
                      borderWidth: beacon.isRecommended ? 2 : 1,
                      backgroundColor:
                        selected || beacon.isRecommended
                          ? theme.colors.primarySoft
                          : theme.colors.background,
                    }}>
                    <View className="flex-row items-center">
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={20}
                        color={selected ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <View className="ml-2.5 flex-1">
                        <Text className="text-sm font-black" style={{ color: theme.colors.text }}>
                          {beacon.name || 'PresenSure Beacon'}
                        </Text>
                        <Text className="mt-0.5 text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                          {beacon.rssi !== null
                            ? `Signal strength: ${beacon.rssi} RSSI`
                            : 'Signal strength unavailable'}
                        </Text>
                      </View>
                      {beacon.isRecommended ? (
                        <View className="rounded-full px-2 py-1" style={{ backgroundColor: theme.colors.success }}>
                          <Text className="text-[10px] font-black uppercase" style={{ color: '#FFFFFF' }}>
                            Match
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {scanError && (
          <View className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 flex-row items-center gap-2">
            <Ionicons name="alert-circle" size={18} color="#DC2626" />
            <Text className="flex-1 text-xs font-bold text-red-700">{scanError}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
