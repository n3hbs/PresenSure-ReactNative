import { Alert, Platform } from "react-native";

import { openBluetoothSettings } from "@/services/ble/esp32-beacon-connection";

export function showBluetoothOffAlert() {
  const opensBluetoothSettings = Platform.OS === "android";

  Alert.alert(
    "Bluetooth is off",
    opensBluetoothSettings
      ? "Turn on Bluetooth to scan for and connect to the ESP32."
      : "Turn on Bluetooth to scan for and connect to the ESP32. You can review PresenSure's Bluetooth access in Settings.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: opensBluetoothSettings ? "Open Bluetooth Settings" : "Open Settings",
        onPress: () => {
          void openBluetoothSettings().catch(() => {
            Alert.alert(
              "Unable to open Settings",
              "Open your phone's Settings and turn on Bluetooth, then return to PresenSure.",
            );
          });
        },
      },
    ],
  );
}
