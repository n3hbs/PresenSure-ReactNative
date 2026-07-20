import {
  BleATTErrorCode,
  BleError,
  BleErrorCode,
  BleManager,
  State,
  type Device,
  type Subscription,
} from "react-native-ble-plx";
import { Platform } from "react-native";

import { requestPresenSurePermission } from "@/features/permissions/permission-service";
import type { Esp32SessionConfiguration } from "@/types/attendance-session";

const SCAN_TIMEOUT_MS = 8_000;
const ADAPTER_STATE_TIMEOUT_MS = 5_000;
const CONNECTION_TIMEOUT_MS = 12_000;
const CONFIGURATION_ACK_TIMEOUT_MS = 10_000;
const PRESENSURE_SERVICE_UUID = "76b50000-a1b2-c3d4-e5f6-1234567890ab";
const DEVICE_INFO_CHARACTERISTIC_UUID = "76b50001-a1b2-c3d4-e5f6-1234567890ab";
const CONFIGURATION_CHARACTERISTIC_UUID = "76b50002-a1b2-c3d4-e5f6-1234567890ab";
const STATUS_CHARACTERISTIC_UUID = "76b50005-a1b2-c3d4-e5f6-1234567890ab";
const manager = new BleManager();

export type DetectedEsp32Beacon = {
  id: string;
  beaconId: string;
  name: string;
  rssi: number | null;
  isRecommended: boolean;
};

export type Esp32DeviceInfo = {
  device_id: string;
  protocol_version: number;
  firmware_version: string;
  platform: string;
};

export type ConnectedEsp32Beacon = {
  device: Device;
  info: Esp32DeviceInfo;
};

export type Esp32ConfigurationStatus = {
  code: number;
  status: string;
  active: boolean;
  configured: boolean;
  epoch: number;
  session_id?: string;
};

function bytesToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToText(value: string) {
  const binary = atob(value);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function parseJsonCharacteristic<T>(value: string | null, label: string): T {
  if (!value) throw new Error(`${label} returned an empty value.`);
  try {
    return JSON.parse(base64ToText(value)) as T;
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function validateDeviceInfo(value: Esp32DeviceInfo) {
  if (!value.device_id || value.protocol_version !== 1) {
    throw new Error("The ESP32 returned unsupported device information.");
  }
  return value;
}

function validateConfiguration(configuration: Esp32SessionConfiguration) {
  if (
    !configuration.session_id ||
    !configuration.rotating_secret ||
    !/^[a-f0-9]{64}$/.test(configuration.signature) ||
    ![1, 2, 3].includes(configuration.attendance_type) ||
    typeof configuration.continuous !== "boolean" ||
    configuration.start_time < 1_609_459_200 ||
    configuration.end_time <= configuration.start_time ||
    configuration.advertisement_interval_ms < 100 ||
    configuration.advertisement_interval_ms > 5_000
  ) {
    throw new Error("Laravel returned an invalid ESP32 beacon configuration.");
  }
}

function getDeviceName(device: Device) {
  return device.localName ?? device.name ?? "";
}

function normalizeBeaconText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/^prensesure[-_\s]*/i, "")
    .replace(/^presensure[-_\s]*/i, "")
    .replace(/[^a-z0-9]/g, "");
}

function isPresenSureEsp32Name(name: string) {
  const normalized = name.toLowerCase();
  return normalized.startsWith("presensure-") || normalized.startsWith("prensesure-");
}

function toDetectedBeacon(device: Device, scheduleRoom?: string | null): DetectedEsp32Beacon | null {
  const name = getDeviceName(device);
  if (!isPresenSureEsp32Name(name)) return null;

  const normalizedBeaconRoom = normalizeBeaconText(name);
  const normalizedScheduleRoom = normalizeBeaconText(scheduleRoom);

  return {
    id: device.id,
    beaconId: device.id,
    name,
    rssi: device.rssi ?? null,
    isRecommended:
      normalizedScheduleRoom.length > 0 &&
      normalizedBeaconRoom === normalizedScheduleRoom,
  };
}

function formatBleError(error: unknown, fallback: string) {
  if (!(error instanceof BleError)) {
    return error instanceof Error ? error : new Error(fallback);
  }

  switch (error.errorCode) {
    case BleErrorCode.DeviceConnectionFailed:
      return new Error(
        "The ESP32 rejected the BLE connection. Make sure its firmware exposes a connectable GATT service and try again.",
      );
    case BleErrorCode.DeviceDisconnected:
      return new Error("The ESP32 disconnected before setup finished. Move closer and try again.");
    case BleErrorCode.DeviceNotFound:
      return new Error("The ESP32 is no longer available. Scan for beacons again.");
    case BleErrorCode.ServicesDiscoveryFailed:
      return new Error(
        "Connected to the ESP32, but it did not expose a usable GATT service. Check the ESP32 BLE firmware.",
      );
    case BleErrorCode.CharacteristicWriteFailed:
      if (
        error.attErrorCode === BleATTErrorCode.InsufficientAuthentication ||
        error.attErrorCode === BleATTErrorCode.InsufficientAuthorization ||
        error.attErrorCode === BleATTErrorCode.InsufficientEncryption
      ) {
        return new Error(
          "The ESP32 requires an encrypted bond. Pair it with this phone, or remove its old Bluetooth bond and try again.",
        );
      }
      return new Error(`Unable to write the ESP32 configuration: ${error.message}`);
    default:
      return new Error(error.message || fallback);
  }
}

async function requestBleScanPermissions() {
  const scan = await requestPresenSurePermission("bluetoothScan");

  if (!scan.granted && scan.availability === "available") {
    throw new Error("Bluetooth scan permission is required to find the ESP32 beacon.");
  }

  // Android 12+ uses BLUETOOTH_SCAN. Location is only required for BLE scans
  // on Android 11 and older.
  if (Platform.OS === "android" && Number(Platform.Version) <= 30) {
    const location = await requestPresenSurePermission("fineLocation");
    if (!location.granted && location.availability === "available") {
      throw new Error("Location permission is required for BLE scanning on this Android version.");
    }
  }
}

async function requestBleConnectPermission() {
  const connect = await requestPresenSurePermission("bluetoothConnect");

  if (!connect.granted && connect.availability === "available") {
    throw new Error("Bluetooth connect permission is required to connect to the ESP32 beacon.");
  }
}

async function waitForPoweredOnAdapter() {
  const currentState = await manager.state();
  if (currentState === State.PoweredOn) return;

  if (currentState === State.PoweredOff) {
    throw new Error("Turn on Bluetooth and try again.");
  }
  if (currentState === State.Unauthorized) {
    throw new Error("Bluetooth access is disabled for PresenSure. Enable it in app settings.");
  }
  if (currentState === State.Unsupported) {
    throw new Error("This device does not support Bluetooth Low Energy.");
  }

  await new Promise<void>((resolve, reject) => {
    let subscription: Subscription | null = null;
    const timeout = setTimeout(() => {
      subscription?.remove();
      reject(new Error("Bluetooth is still starting. Wait a moment and try again."));
    }, ADAPTER_STATE_TIMEOUT_MS);

    subscription = manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        clearTimeout(timeout);
        subscription?.remove();
        resolve();
      } else if (state === State.PoweredOff) {
        clearTimeout(timeout);
        subscription?.remove();
        reject(new Error("Turn on Bluetooth and try again."));
      } else if (state === State.Unauthorized) {
        clearTimeout(timeout);
        subscription?.remove();
        reject(new Error("Bluetooth access is disabled for PresenSure. Enable it in app settings."));
      }
    }, true);
  });
}

export async function scanForEsp32Beacons(scheduleRoom?: string | null) {
  await requestBleScanPermissions();
  await waitForPoweredOnAdapter();
  manager.stopDeviceScan();

  return new Promise<DetectedEsp32Beacon[]>((resolve, reject) => {
    const beacons = new Map<string, DetectedEsp32Beacon>();
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      manager.stopDeviceScan();
      resolve(
        [...beacons.values()].sort((first, second) => {
          if (first.isRecommended !== second.isRecommended) {
            return first.isRecommended ? -1 : 1;
          }

          return (second.rssi ?? -999) - (first.rssi ?? -999);
        }),
      );
    }, SCAN_TIMEOUT_MS);

    manager.startDeviceScan([PRESENSURE_SERVICE_UUID], null, (scanError, device) => {
      if (settled) return;

      if (scanError) {
        settled = true;
        clearTimeout(timeout);
        manager.stopDeviceScan();
        reject(new Error(scanError.message));
        return;
      }

      if (!device) return;

      const beacon = toDetectedBeacon(device, scheduleRoom);
      if (beacon) beacons.set(beacon.id, beacon);
    });
  });
}

export async function connectToEsp32Beacon(deviceId: string) {
  await requestBleConnectPermission();
  await waitForPoweredOnAdapter();
  manager.stopDeviceScan();

  try {
    const alreadyConnected = await manager.isDeviceConnected(deviceId);
    const connectedDevice = alreadyConnected
      ? (await manager.devices([deviceId]))[0]
      : await manager.connectToDevice(deviceId, {
          autoConnect: false,
          requestMTU: 517,
          timeout: CONNECTION_TIMEOUT_MS,
        });

    if (!connectedDevice) {
      throw new Error("The selected ESP32 is no longer available. Scan again.");
    }

    const discoveredDevice = await connectedDevice.discoverAllServicesAndCharacteristics();
    const deviceInfoCharacteristic = await discoveredDevice.readCharacteristicForService(
      PRESENSURE_SERVICE_UUID,
      DEVICE_INFO_CHARACTERISTIC_UUID,
    );
    const info = validateDeviceInfo(
      parseJsonCharacteristic<Esp32DeviceInfo>(
        deviceInfoCharacteristic.value,
        "ESP32 device information",
      ),
    );

    return { device: discoveredDevice, info } satisfies ConnectedEsp32Beacon;
  } catch (error) {
    if (await manager.isDeviceConnected(deviceId).catch(() => false)) {
      await manager.cancelDeviceConnection(deviceId).catch(() => undefined);
    }
    throw formatBleError(error, "Unable to connect to the ESP32 beacon.");
  }
}

export async function configureEsp32Attendance(
  deviceId: string,
  configuration: Esp32SessionConfiguration,
) {
  validateConfiguration(configuration);
  if (!(await manager.isDeviceConnected(deviceId))) {
    throw new Error("The ESP32 disconnected before it could be configured.");
  }

  const configurationJson = JSON.stringify(configuration);
  const encodedConfiguration = bytesToBase64(configurationJson);

  return new Promise<Esp32ConfigurationStatus>((resolve, reject) => {
    let settled = false;
    let writeStarted = false;
    let writeCompleted = false;
    let statusSubscription: Subscription | null = null;
    let disconnectSubscription: Subscription | null = null;

    const finish = (
      error: Error | null,
      status?: Esp32ConfigurationStatus,
    ) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      statusSubscription?.remove();
      disconnectSubscription?.remove();
      if (error) reject(error);
      else if (status) resolve(status);
    };

    const timeout = setTimeout(() => {
      finish(
        new Error(
          "The ESP32 did not acknowledge the session configuration. Check its serial monitor.",
        ),
      );
    }, CONFIGURATION_ACK_TIMEOUT_MS);

    const acceptedStatus = (): Esp32ConfigurationStatus => ({
      code: 0,
      status: "OK",
      active: true,
      configured: true,
      epoch: configuration.start_time,
      session_id: configuration.session_id,
    });

    const handleStatus = (status: Esp32ConfigurationStatus) => {
      if (status.code === 0 && status.status === "OK" && status.active) {
        finish(null, status);
      } else if (status.status !== "NO_ACTIVE_SESSION") {
        finish(
          new Error(
            `ESP32 rejected the session configuration: ${status.status || `code ${status.code}`}.`,
          ),
        );
      }
    };

    disconnectSubscription = manager.onDeviceDisconnected(deviceId, (error) => {
      if (!writeCompleted) {
        finish(formatBleError(error, "The ESP32 disconnected before configuration."));
        return;
      }

      // Current firmware disconnects only after it accepts and starts a valid
      // configuration. Its status notification can race with that disconnect.
      finish(null, acceptedStatus());
    });

    statusSubscription = manager.monitorCharacteristicForDevice(
      deviceId,
      PRESENSURE_SERVICE_UUID,
      STATUS_CHARACTERISTIC_UUID,
      (error, characteristic) => {
        if (error) {
          if (
            writeCompleted &&
            error instanceof BleError &&
            error.errorCode === BleErrorCode.DeviceDisconnected
          ) {
            finish(null, acceptedStatus());
          } else if (writeStarted) {
            finish(formatBleError(error, "Unable to read ESP32 status."));
          }
          return;
        }
        if (!writeStarted || !characteristic?.value) return;

        try {
          const status = parseJsonCharacteristic<Esp32ConfigurationStatus>(
            characteristic.value,
            "ESP32 status",
          );
          handleStatus(status);
        } catch (error) {
          finish(error instanceof Error ? error : new Error("Invalid ESP32 status response."));
        }
      },
    );

    writeStarted = true;
    manager
      .writeCharacteristicWithResponseForDevice(
        deviceId,
        PRESENSURE_SERVICE_UUID,
        CONFIGURATION_CHARACTERISTIC_UUID,
        encodedConfiguration,
      )
      .then(() => {
        writeCompleted = true;
        // The firmware notification can race its immediate disconnect. Reading
        // status also captures rejection responses when a notification is lost.
        setTimeout(() => {
          if (settled) return;
          manager
            .readCharacteristicForDevice(
              deviceId,
              PRESENSURE_SERVICE_UUID,
              STATUS_CHARACTERISTIC_UUID,
            )
            .then((characteristic) => {
              handleStatus(
                parseJsonCharacteristic<Esp32ConfigurationStatus>(
                  characteristic.value,
                  "ESP32 status",
                ),
              );
            })
            .catch((error) => {
              if (
                error instanceof BleError &&
                error.errorCode === BleErrorCode.DeviceDisconnected
              ) {
                finish(null, acceptedStatus());
              } else if (error instanceof Error) {
                finish(error);
              }
            });
        }, 250);
      })
      .catch((error) => {
        finish(formatBleError(error, "Unable to write the session configuration to the ESP32."));
      });
  });
}

export function subscribeToEsp32Disconnection(
  deviceId: string,
  listener: (message: string | null) => void,
) {
  return manager.onDeviceDisconnected(deviceId, (error) => {
    listener(error ? formatBleError(error, "The ESP32 disconnected.").message : null);
  });
}

export async function disconnectFromEsp32Beacon(deviceId: string) {
  if (await manager.isDeviceConnected(deviceId).catch(() => false)) {
    await manager.cancelDeviceConnection(deviceId);
  }
}

export async function isEsp32BeaconConnected(deviceId: string) {
  return manager.isDeviceConnected(deviceId).catch(() => false);
}
