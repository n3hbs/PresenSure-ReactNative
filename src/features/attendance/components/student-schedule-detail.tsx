import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { showBluetoothOffAlert } from '@/features/attendance/bluetooth-settings-alert';
import { attendanceRecordQueryKeys } from '@/features/attendance/attendance-record-query-keys';
import { FaceGestureChallengeModal } from '@/features/face-recognition/components/face-gesture-challenge-modal';
import { useAppTheme } from '@/providers/theme-provider';
import {
  checkAttendanceRecord,
  storeAttendanceRecord,
  type AttendanceRecordData,
  type StoreAttendanceRecordResponse,
} from '@/services/attendance-record-service';
import {
  isBluetoothPoweredOffError,
  scanForEsp32Beacons,
  type DetectedEsp32Beacon,
} from '@/services/ble/esp32-beacon-connection';
import type { AttendanceSession, VerificationMode } from '@/types/attendance-session';
import type { CourseSchedule } from '@/types/course-schedule';

function ExistingAttendanceRecordCard({
  record,
}: {
  record: AttendanceRecordData;
}) {
  const theme = useAppTheme();
  const statusUpper = record.status?.toUpperCase() ?? 'PRESENT';
  const verifiedDate = new Date(record.verified_at);
  const formattedTime = Number.isNaN(verifiedDate.getTime())
    ? record.verified_at
    : `${verifiedDate.toLocaleDateString()} at ${verifiedDate.toLocaleTimeString()}`;

  return (
    <View
      className="rounded-[20px] border p-5"
      style={{
        borderColor: theme.colors.success,
        backgroundColor: theme.colors.surface,
        elevation: 6,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: theme.resolvedMode === 'dark' ? 0.3 : 0.18,
        shadowRadius: 20,
      }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <View
            className="mr-3 h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.primarySoft }}>
            <Ionicons name="checkmark-done-circle" size={28} color={theme.colors.success} />
          </View>
          <View className="flex-1">
            <Text className="text-lg font-black" style={{ color: theme.colors.text }}>
              Attendance Recorded
            </Text>
            <Text className="mt-0.5 text-xs font-bold" style={{ color: theme.colors.textMuted }}>
              Record ID #{record.attendance_record_id}
            </Text>
          </View>
        </View>

        <View className="rounded-full bg-emerald-500/10 px-3 py-1 border border-emerald-500/30">
          <Text className="text-xs font-black text-emerald-600 dark:text-emerald-400">
            {statusUpper}
          </Text>
        </View>
      </View>

      <View
        className="mt-4 rounded-xl border p-4"
        style={{
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        }}>
        <Text className="text-xs font-black uppercase mb-2" style={{ color: theme.colors.primary }}>
          Verification Details
        </Text>
        <View className="gap-2">
          <View className="flex-row justify-between">
            <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
              Verified At:
            </Text>
            <Text className="text-xs font-black" style={{ color: theme.colors.text }}>
              {formattedTime}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
              Presence (BLE) Verified:
            </Text>
            <Text className="text-xs font-black text-emerald-600 dark:text-emerald-400">
              {record.presence_verified ? 'YES' : 'NO'}
            </Text>
          </View>

          <View className="flex-row justify-between">
            <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
              Face Verified:
            </Text>
            <Text className="text-xs font-black" style={{ color: theme.colors.text }}>
              {record.face_verified ? 'YES' : 'NO (BLE Only)'}
            </Text>
          </View>
        </View>
      </View>

      <View
        className="mt-4 flex-row items-center rounded-xl p-3.5"
        style={{ backgroundColor: theme.colors.primarySoft }}>
        <Ionicons name="information-circle-outline" size={20} color={theme.colors.primary} />
        <Text
          className="ml-2.5 flex-1 text-xs font-bold leading-5"
          style={{ color: theme.colors.text }}>
          You already have an active attendance record for this schedule today.
        </Text>
      </View>
    </View>
  );
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
      style={{ borderColor: theme.colors.border }}>
      <Ionicons name={icon} size={18} color={theme.colors.primary} />
      <View className="ml-3 flex-1">
        <Text
          className="text-[11px] font-black uppercase"
          style={{ color: theme.colors.textMuted }}>
          {label}
        </Text>
        <Text className="mt-0.5 text-sm font-black" style={{ color: theme.colors.text }}>
          {value}
        </Text>
      </View>
    </View>
  );
}

function AdvertisedDataCard({ beacon }: { beacon: DetectedEsp32Beacon }) {
  const theme = useAppTheme();
  const [showRawDetails, setShowRawDetails] = useState(false);
  const parsed = beacon.parsedEsp32Payload;

  return (
    <View
      className="mt-3 rounded-lg border p-3"
      style={{
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surfaceMuted,
      }}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="wifi-outline" size={16} color={theme.colors.primary} />
          <Text
            className="ml-1.5 text-xs font-black uppercase"
            style={{ color: theme.colors.primary }}>
            Advertised ESP32 BLE Data
          </Text>
        </View>
        <View className="rounded-full bg-emerald-500/10 px-2 py-0.5 border border-emerald-500/30">
          <Text className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
            No API Connection Needed
          </Text>
        </View>
      </View>

      {/* Parsed 23-byte ESP32 Payload Card */}
      {parsed && (
        <View
          className="mt-2.5 rounded-md border p-3"
          style={{
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primarySoft,
          }}>
          <View className="flex-row items-center justify-between">
            <Text
              className="text-[11px] font-black uppercase"
              style={{ color: theme.colors.primary }}>
              Parsed ESP32 Session Packet
            </Text>
            <View className="rounded-full bg-primary/20 px-2 py-0.5">
              <Text
                className="text-[10px] font-black uppercase"
                style={{ color: theme.colors.primary }}>
                Mode: {parsed.verificationMode.toUpperCase()}
              </Text>
            </View>
          </View>

          <View className="mt-2 gap-1">
            <View className="flex-row justify-between">
              <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                Verification Mode:
              </Text>
              <Text className="text-xs font-black" style={{ color: theme.colors.text }}>
                {parsed.verificationMode === 'ble_face'
                  ? 'BLE + Face Recognition'
                  : parsed.verificationMode === 'face'
                  ? 'Face Recognition'
                  : 'BLE Beacon Only'}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                Continuous Verification:
              </Text>
              <Text className="text-xs font-black" style={{ color: theme.colors.text }}>
                {parsed.continuousChecking ? 'Enabled' : 'Disabled'}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                Session Hash:
              </Text>
              <Text className="text-xs font-mono font-black" style={{ color: theme.colors.text }}>
                0x{parsed.sessionHash}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                Time Window (Epoch):
              </Text>
              <Text className="text-xs font-mono font-black" style={{ color: theme.colors.text }}>
                {parsed.timeWindow}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                Rotating Verification Token:
              </Text>
              <Text className="text-xs font-mono font-black text-emerald-600 dark:text-emerald-400">
                0x{parsed.verificationToken}
              </Text>
            </View>

            <View className="flex-row justify-between">
              <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                ESP32 Device Hash:
              </Text>
              <Text className="text-xs font-mono font-black" style={{ color: theme.colors.text }}>
                0x{parsed.deviceHash}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View className="mt-2.5 gap-1.5">
        <View className="flex-row justify-between">
          <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
            ESP32 Device / MAC ID:
          </Text>
          <Text className="text-xs font-black" style={{ color: theme.colors.text }}>
            {beacon.id}
          </Text>
        </View>

        <View className="flex-row justify-between">
          <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
            Signal Strength (RSSI):
          </Text>
          <Text className="text-xs font-black" style={{ color: theme.colors.text }}>
            {beacon.rssi !== null ? `${beacon.rssi} dBm` : 'Unavailable'}
          </Text>
        </View>

        {beacon.txPowerLevel !== undefined && beacon.txPowerLevel !== null && (
          <View className="flex-row justify-between">
            <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
              Tx Power Level:
            </Text>
            <Text className="text-xs font-black" style={{ color: theme.colors.text }}>
              {beacon.txPowerLevel} dBm
            </Text>
          </View>
        )}

        {beacon.serviceUUIDs && beacon.serviceUUIDs.length > 0 && (
          <View className="mt-1">
            <Text className="text-xs font-bold" style={{ color: theme.colors.textMuted }}>
              Advertised Service UUIDs:
            </Text>
            {beacon.serviceUUIDs.map((uuid, idx) => (
              <Text
                key={idx}
                className="mt-0.5 text-[11px] font-mono font-bold"
                style={{ color: theme.colors.text }}>
                • {uuid}
              </Text>
            ))}
          </View>
        )}

        {beacon.advertisedPayload !== undefined && beacon.advertisedPayload !== null && (
          <View
            className="mt-2 rounded-md border p-2.5"
            style={{
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.primarySoft,
            }}>
            <Text
              className="text-[11px] font-black uppercase"
              style={{ color: theme.colors.primary }}>
              Decoded Broadcast Payload
            </Text>
            <Text className="mt-1 text-xs font-mono font-bold" style={{ color: theme.colors.text }}>
              {typeof beacon.advertisedPayload === 'object'
                ? JSON.stringify(beacon.advertisedPayload, null, 2)
                : String(beacon.advertisedPayload)}
            </Text>
          </View>
        )}

        {beacon.decodedManufacturerData && !beacon.advertisedPayload && !parsed && (
          <View
            className="mt-1.5 rounded-md border p-2"
            style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.background }}>
            <Text
              className="text-[10px] font-black uppercase"
              style={{ color: theme.colors.textMuted }}>
              Manufacturer Data
            </Text>
            <Text className="mt-0.5 text-xs font-mono font-bold" style={{ color: theme.colors.text }}>
              {beacon.decodedManufacturerData}
            </Text>
          </View>
        )}

        {/* Toggle raw base64 payload view */}
        {(beacon.manufacturerData || beacon.serviceData) && (
          <Pressable
            accessibilityRole="button"
            onPress={() => setShowRawDetails((prev) => !prev)}
            className="mt-2 flex-row items-center justify-between py-1">
            <Text className="text-[11px] font-bold" style={{ color: theme.colors.primary }}>
              {showRawDetails
                ? 'Hide raw advertisement payload'
                : 'Show raw advertisement payload'}
            </Text>
            <Ionicons
              name={showRawDetails ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.colors.primary}
            />
          </Pressable>
        )}

        {showRawDetails && (
          <View
            className="mt-1 rounded-md border p-2"
            style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.background }}>
            {beacon.manufacturerData && (
              <View className="mb-1.5">
                <Text className="text-[10px] font-bold" style={{ color: theme.colors.textMuted }}>
                  Raw Manufacturer Data (base64):
                </Text>
                <Text className="text-[11px] font-mono" style={{ color: theme.colors.text }}>
                  {beacon.manufacturerData}
                </Text>
              </View>
            )}
            {beacon.serviceData && (
              <View>
                <Text className="text-[10px] font-bold" style={{ color: theme.colors.textMuted }}>
                  Raw Service Data (base64):
                </Text>
                {Object.entries(beacon.serviceData).map(([uuid, base64Val]) => (
                  <Text key={uuid} className="text-[11px] font-mono" style={{ color: theme.colors.text }}>
                    {uuid}: {base64Val}
                  </Text>
                ))}
              </View>
            )}
          </View>
        )}
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
  const queryClient = useQueryClient();
  const normalizedStatus = activeSession?.status?.trim().toLowerCase();
  const isSessionActive = activeSession !== null && normalizedStatus === 'active';
  const expectedRoomName = schedule.room ?? 'Not set';

  const scheduleId = Number(schedule.id);
  const isValidScheduleId = Number.isFinite(scheduleId) && scheduleId > 0;

  const {
    data: existingRecord = null,
    isLoading: isCheckingRecord,
    error: checkRecordError,
    refetch: refetchCheckRecord,
  } = useQuery({
    queryKey: attendanceRecordQueryKeys.check(scheduleId),
    queryFn: () => checkAttendanceRecord(scheduleId),
    enabled: isValidScheduleId,
    staleTime: 0,
  });

  const [isScanning, setIsScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [beacons, setBeacons] = useState<DetectedEsp32Beacon[]>([]);
  const [selectedBeacon, setSelectedBeacon] = useState<DetectedEsp32Beacon | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] =
    useState<StoreAttendanceRecordResponse['data'] | null>(null);
  const [faceModalVisible, setFaceModalVisible] = useState(false);

  async function handleScanBluetooth() {
    try {
      setIsScanning(true);
      setScanError(null);
      const results = await scanForEsp32Beacons(schedule.room);
      setBeacons(results);
      setHasScanned(true);

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

  async function handleStoreAttendance({
    beacon,
    faceVerified,
    faceVerifiedAt,
  }: {
    beacon: DetectedEsp32Beacon;
    faceVerified: boolean;
    faceVerifiedAt: string;
  }) {
    if (!isValidScheduleId) {
      Alert.alert('Error', 'Invalid schedule ID for attendance submission.');
      return;
    }

    try {
      setIsSubmitting(true);
      const nowIso = new Date().toISOString();

      const response = await storeAttendanceRecord({
        schedule_id: scheduleId,
        presence_verified: true,
        face_verified: faceVerified,
        face_verified_at: faceVerifiedAt,
        verified_at: nowIso,
        rssi: beacon.rssi ?? -70,
        detected_at: nowIso,
      });

      setSubmittedResult(response.data);
      void queryClient.invalidateQueries({
        queryKey: attendanceRecordQueryKeys.check(scheduleId),
      });

      Alert.alert(
        'Attendance Verified!',
        `Your presence has been successfully recorded as PRESENT (${
          faceVerified ? 'BLE + Face Verified' : 'BLE Verified'
        }).`
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to store attendance record.';
      Alert.alert('Submission Failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleInitiateVerification() {
    if (!selectedBeacon) {
      Alert.alert('Selection Required', 'Please select a matched ESP32 device first.');
      return;
    }

    // Determine verification mode: prioritize active session mode, then beacon payload mode, default to 'ble'
    const mode: VerificationMode =
      activeSession?.verification_mode ??
      selectedBeacon.parsedEsp32Payload?.verificationMode ??
      'ble';

    if (mode === 'face' || mode === 'ble_face') {
      setFaceModalVisible(true);
    } else {
      void handleStoreAttendance({
        beacon: selectedBeacon,
        faceVerified: false,
        faceVerifiedAt: new Date().toISOString(),
      });
    }
  }

  function handleFaceVerificationSuccess(faceVerifiedAtIso: string) {
    setFaceModalVisible(false);
    if (selectedBeacon) {
      void handleStoreAttendance({
        beacon: selectedBeacon,
        faceVerified: true,
        faceVerifiedAt: faceVerifiedAtIso,
      });
    }
  }

  const activeRecord = existingRecord ?? submittedResult?.attendanceRecord ?? null;

  return (
    <View className="flex-1" style={{ paddingHorizontal: 16 }}>
      {isCheckingRecord ? (
        <View
          className="items-center rounded-[20px] border p-6"
          style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}>
          <ActivityIndicator color={theme.colors.primary} />
          <Text className="mt-3 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
            Checking attendance record...
          </Text>
        </View>
      ) : activeRecord ? (
        <ExistingAttendanceRecordCard record={activeRecord} />
      ) : (
        <>
          {checkRecordError && (
            <View className="mb-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 mr-2">
                <Ionicons name="warning-outline" size={18} color="#D97706" />
                <Text className="ml-2 text-xs font-bold text-amber-800 dark:text-amber-300 flex-1">
                  Unable to verify existing attendance record status.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refetchCheckRecord()}
                className="rounded-md bg-amber-200 dark:bg-amber-900 px-2.5 py-1">
                <Text className="text-xs font-black text-amber-900 dark:text-amber-100">Retry</Text>
              </Pressable>
            </View>
          )}

          {/* Main Connectionless BLE Scanning Card */}
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
                <Ionicons name="radio" size={22} color={theme.colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-lg font-black" style={{ color: theme.colors.text }}>
                  ESP32 BLE Advertisements
                </Text>
                <Text className="mt-0.5 text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                  Room: {expectedRoomName} • Direct BLE Scan
                </Text>
              </View>

              {isSessionActive ? (
                <View className="rounded-full bg-emerald-500/10 px-3 py-1 border border-emerald-500/30">
                  <Text className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    Session Active
                  </Text>
                </View>
              ) : (
                <View className="rounded-full bg-slate-500/10 px-3 py-1 border border-slate-500/30">
                  <Text className="text-xs font-black" style={{ color: theme.colors.textMuted }}>
                    Direct Scan
                  </Text>
                </View>
              )}
            </View>

            {/* Scan Action Button */}
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
                {isScanning
                  ? 'Scanning PresenSure BLE...'
                  : hasScanned
                  ? 'Rescan Room ESP32 BLE'
                  : 'Scan Room ESP32 BLE Broadcasts'}
              </Text>
            </Pressable>

            {/* Scan Results / Connectionless Beacon Data List */}
            <View className="mt-4">
              {isScanning && beacons.length === 0 ? (
                <View className="items-center py-8">
                  <ActivityIndicator color={theme.colors.primary} />
                  <Text className="mt-3 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
                    Listening for room ESP32 BLE broadcast signals...
                  </Text>
                </View>
              ) : null}

              {!isScanning && hasScanned && beacons.length === 0 ? (
                <View
                  className="items-center rounded-md border p-5"
                  style={{ borderColor: theme.colors.border }}>
                  <Ionicons name="radio-outline" size={32} color={theme.colors.textMuted} />
                  <Text className="mt-3 text-sm font-black" style={{ color: theme.colors.text }}>
                    No ESP32 BLE Broadcast Found
                  </Text>
                  <Text
                    className="mt-1 text-center text-xs font-bold leading-5"
                    style={{ color: theme.colors.textMuted }}>
                    Make sure you are inside room {expectedRoomName} and the ESP32 beacon is powered on.
                  </Text>
                </View>
              ) : null}

              {beacons.length > 0 && (
                <View className="gap-3">
                  {beacons.map((beacon) => {
                    const selected = selectedBeacon?.id === beacon.id;
                    const borderColor = beacon.isRecommended
                      ? theme.colors.success
                      : selected
                      ? theme.colors.primary
                      : theme.colors.border;

                    return (
                      <View
                        key={beacon.id}
                        className="rounded-xl border p-3.5"
                        style={{
                          borderColor,
                          borderWidth: beacon.isRecommended ? 2 : 1,
                          backgroundColor:
                            selected || beacon.isRecommended
                              ? theme.colors.primarySoft
                              : theme.colors.background,
                        }}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => setSelectedBeacon(beacon)}
                          className="flex-row items-center justify-between">
                          <View className="flex-row items-center flex-1">
                            <Ionicons
                              name={selected ? 'radio-button-on' : 'radio-button-off'}
                              size={20}
                              color={selected ? theme.colors.primary : theme.colors.textMuted}
                            />
                            <View className="ml-2.5 flex-1">
                              <Text className="text-sm font-black" style={{ color: theme.colors.text }}>
                                {beacon.name || 'PresenSure Beacon'}
                              </Text>
                              <Text
                                className="mt-0.5 text-xs font-bold"
                                style={{ color: theme.colors.textMuted }}>
                                {beacon.rssi !== null
                                  ? `Signal strength: ${beacon.rssi} dBm`
                                  : 'Signal strength unavailable'}
                              </Text>
                            </View>
                          </View>
                          {beacon.isRecommended && (
                            <View
                              className="rounded-full px-2.5 py-1"
                              style={{ backgroundColor: theme.colors.success }}>
                              <Text className="text-[10px] font-black uppercase text-white">
                                Room Match
                              </Text>
                            </View>
                          )}
                        </Pressable>

                        {/* Advertised Data Section - Connectionless */}
                        <AdvertisedDataCard beacon={beacon} />
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Action Button to Submit / Verify Attendance */}
            {selectedBeacon && (
              <View className="mt-4">
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={handleInitiateVerification}
                  className="min-h-[50px] flex-row items-center justify-center rounded-xl"
                  style={{
                    backgroundColor: theme.colors.primary,
                  }}>
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Ionicons name="checkmark-done-circle-outline" size={22} color="#FFFFFF" />
                  )}
                  <Text className="ml-2 text-base font-black text-white">
                    {isSubmitting
                      ? 'Submitting Attendance...'
                      : (activeSession?.verification_mode ??
                          selectedBeacon.parsedEsp32Payload?.verificationMode) === 'face' ||
                        (activeSession?.verification_mode ??
                          selectedBeacon.parsedEsp32Payload?.verificationMode) === 'ble_face'
                      ? 'Proceed to Face Verification'
                      : 'Verify Attendance via BLE'}
                  </Text>
                </Pressable>
              </View>
            )}

            {scanError && (
              <View className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 flex-row items-center gap-2">
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text className="flex-1 text-xs font-bold text-red-700">{scanError}</Text>
              </View>
            )}
          </View>
        </>
      )}

      {/* Face Gesture Challenge Modal */}
      <FaceGestureChallengeModal
        visible={faceModalVisible}
        onClose={() => setFaceModalVisible(false)}
        onSuccess={handleFaceVerificationSuccess}
      />
    </View>
  );
}
