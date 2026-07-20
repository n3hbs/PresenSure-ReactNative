import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from "react-native";

import { useAppTheme } from "@/app/providers/theme-provider";
import type { DetectedEsp32Beacon } from "@/services/ble/esp32-beacon-connection";

type Esp32BeaconPickerModalProps = {
  beacons: DetectedEsp32Beacon[];
  isScanning: boolean;
  onClose: () => void;
  onConfirm: (beacon: DetectedEsp32Beacon) => void;
  onScan: () => void;
  onSelect: (beacon: DetectedEsp32Beacon) => void;
  roomName?: string | null;
  selectedBeacon: DetectedEsp32Beacon | null;
  visible: boolean;
};

export function Esp32BeaconPickerModal({
  beacons,
  isScanning,
  onClose,
  onConfirm,
  onScan,
  onSelect,
  roomName,
  selectedBeacon,
  visible,
}: Esp32BeaconPickerModalProps) {
  const theme = useAppTheme();
  const expectedRoomName = roomName ?? "ROOM";

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/40">
        <View
          className="max-h-[82%] rounded-t-[24px] border px-5 pb-6 pt-5"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
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
                Recommended room: {roomName ?? "Not set"}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: theme.colors.surfaceMuted }}>
              <Ionicons name="close" size={22} color={theme.colors.textMuted} />
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={isScanning}
            onPress={onScan}
            className="mt-5 flex-row items-center justify-center rounded-md border p-3"
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
              {isScanning ? "Scanning PresenSure BLE" : "Scan again"}
            </Text>
          </Pressable>

          <ScrollView className="mt-4" showsVerticalScrollIndicator={false}>
            {isScanning && beacons.length === 0 ? (
              <View className="items-center py-8">
                <ActivityIndicator color={theme.colors.primary} />
                <Text className="mt-3 text-sm font-bold" style={{ color: theme.colors.textMuted }}>
                  Looking for PresenSure BLE beacons
                </Text>
              </View>
            ) : null}

            {!isScanning && beacons.length === 0 ? (
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
                    onPress={() => onSelect(beacon)}
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
                        name={selected ? "radio-button-on" : "radio-button-off"}
                        size={20}
                        color={selected ? theme.colors.primary : theme.colors.textMuted}
                      />
                      <View className="ml-2 flex-1">
                        <Text className="text-sm font-black" style={{ color: theme.colors.text }}>
                          {beacon.name}
                        </Text>
                        <Text className="mt-0.5 text-xs font-bold" style={{ color: theme.colors.textMuted }}>
                          ID: {beacon.beaconId}
                          {beacon.rssi !== null ? ` | RSSI ${beacon.rssi}` : ""}
                        </Text>
                      </View>
                      {beacon.isRecommended ? (
                        <View className="rounded-full px-2 py-1" style={{ backgroundColor: theme.colors.success }}>
                          <Text className="text-[10px] font-black uppercase" style={{ color: "#FFFFFF" }}>
                            Match
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {selectedBeacon && !selectedBeacon.isRecommended ? (
            <Text
              className="mt-3 text-center text-xs font-bold leading-5"
              style={{ color: theme.colors.danger }}>
              This beacon does not match {roomName ?? "the scheduled room"}. Select the beacon
              marked Match.
            </Text>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={!selectedBeacon?.isRecommended || isScanning}
            onPress={() => {
              if (selectedBeacon?.isRecommended) onConfirm(selectedBeacon);
            }}
            className="mt-4 min-h-[48px] items-center justify-center rounded-md"
            style={{
              backgroundColor: selectedBeacon?.isRecommended
                ? theme.colors.primary
                : theme.colors.border,
            }}>
            <Text className="text-base font-black" style={{ color: "#FFFFFF" }}>
              Connect Selected Beacon
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
