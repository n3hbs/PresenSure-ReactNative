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
import { decodeBlePayload, encodeBlePayload } from "@/services/ble/ble-encoding";
import { PRESENSURE_BLE } from "@/services/ble/presensure-ble-protocol";
import type {
  Esp32ConfigurationStatus,
  Esp32StartSessionCommand,
} from "@/types/attendance-session";
import { logError } from "@/utils/logger";

const SCAN_TIMEOUT_MS = 8_000;
const ADAPTER_STATE_TIMEOUT_MS = 5_000;
const CONNECTION_TIMEOUT_MS = 12_000;
const CONFIGURATION_ACK_TIMEOUT_MS = 10_000;
const manager = new BleManager();

export type DetectedEsp32Beacon = {
  id: string;
  beaconId: string;
  name: string;
  rssi: number | null;
  isRecommended: boolean;
};

export type ConnectedEsp32Beacon = {
  device: Device;
};

function parseJsonCharacteristic<T>(value: string | null, label: string): T {
  if (!value) throw new Error(`${label} returned an empty value.`);
  try {
    return decodeBlePayload<T>(value);
  } catch {
    throw new Error(`${label} returned invalid JSON.`);
  }
}

function validateConfiguration(configuration: Esp32StartSessionCommand) {
  if (
    configuration.command !== "START_SESSION" ||
    !configuration.session_id ||
    !Number.isInteger(configuration.schedule_id) ||
    configuration.schedule_id < 1 ||
    !configuration.subject_code ||
    !configuration.room_code ||
    !configuration.token ||
    !Number.isInteger(configuration.expires_at) ||
    configuration.expires_at <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error("The attendance session contains invalid ESP32 configuration data.");
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

    manager.startDeviceScan([PRESENSURE_BLE.serviceUuid], null, (scanError, device) => {
      if (settled) return;

      if (scanError) {
        logError("ble.scan.callback", scanError, {
          errorCode: scanError.errorCode,
        });
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
          refreshGatt: Platform.OS === "android" ? "OnConnected" : undefined,
          timeout: CONNECTION_TIMEOUT_MS,
        });

    if (!connectedDevice) {
      throw new Error("The selected ESP32 is no longer available. Scan again.");
    }

    const discoveredDevice = await connectedDevice.discoverAllServicesAndCharacteristics();
    const services = await discoveredDevice.services();
    const discoveredServiceUuids = services.map((service) => service.uuid.toLowerCase());
    console.log("[PresenSure:ble-services]", {
      blePeripheralId: deviceId,
      services: discoveredServiceUuids,
    });

    const presenSureService = services.find(
      (service) => service.uuid.toLowerCase() === PRESENSURE_BLE.serviceUuid,
    );

    if (!presenSureService) {
      throw new Error(
        `ESP32 advertised PresenSure but its GATT table does not contain ${PRESENSURE_BLE.serviceUuid}. ` +
          `Discovered services: ${discoveredServiceUuids.join(", ") || "none"}.`,
      );
    }

    const characteristics = await presenSureService.characteristics();
    const characteristicUuids = new Set(
      characteristics.map((characteristic) => characteristic.uuid.toLowerCase()),
    );
    console.log("[PresenSure:ble-characteristics]", {
      blePeripheralId: deviceId,
      serviceUuid: presenSureService.uuid,
      characteristics: [...characteristicUuids],
    });
    const requiredUuids = Object.values(PRESENSURE_BLE.characteristics);

    if (requiredUuids.some((uuid) => !characteristicUuids.has(uuid))) {
      const missingUuids = requiredUuids.filter((uuid) => !characteristicUuids.has(uuid));
      throw new Error(
        `The ESP32 PresenSure service is missing characteristics: ${missingUuids.join(", ")}.`,
      );
    }

    return { device: discoveredDevice } satisfies ConnectedEsp32Beacon;
  } catch (error) {
    logError("ble.connect", error, { blePeripheralId: deviceId });
    if (await manager.isDeviceConnected(deviceId).catch(() => false)) {
      await manager.cancelDeviceConnection(deviceId).catch(() => undefined);
    }
    throw formatBleError(error, "Unable to connect to the ESP32 beacon.");
  }
}

export async function configureEsp32Attendance(
  deviceId: string,
  configuration: Esp32StartSessionCommand,
) {
  validateConfiguration(configuration);
  if (!(await manager.isDeviceConnected(deviceId))) {
    throw new Error("The ESP32 disconnected before it could be configured.");
  }

  type ExpectedStatus = "READY" | "AUTHENTICATED" | "SESSION_STARTED";
  type StatusWaiter = {
    expected: ExpectedStatus;
    resolve: (status: Esp32ConfigurationStatus) => void;
    reject: (error: Error) => void;
  };

  let active = true;
  const statusState: { last: Esp32ConfigurationStatus | null } = { last: null };
  let monitoringError: Error | null = null;
  let waiter: StatusWaiter | null = null;
  let statusSubscription: Subscription | null = null;
  let disconnectSubscription: Subscription | null = null;

  function waitForStatus(expected: ExpectedStatus) {
    if (statusState.last?.status === expected) return Promise.resolve(statusState.last);
    if (monitoringError) return Promise.reject(monitoringError);
    if (waiter) {
      return Promise.reject(
        new Error(`Already waiting for ESP32 status ${waiter.expected}.`),
      );
    }

    return new Promise<Esp32ConfigurationStatus>((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiter = null;
        reject(new Error(`The ESP32 did not return ${expected}. Check its serial monitor.`));
      }, CONFIGURATION_ACK_TIMEOUT_MS);

      waiter = {
        expected,
        resolve: (status) => {
          clearTimeout(timeout);
          waiter = null;
          resolve(status);
        },
        reject: (error) => {
          clearTimeout(timeout);
          waiter = null;
          reject(error);
        },
      };
    });
  }

  function rejectWaiter(error: Error) {
    monitoringError = error;
    waiter?.reject(error);
  }

  try {
    disconnectSubscription = manager.onDeviceDisconnected(deviceId, (error) => {
      if (!active) return;
      rejectWaiter(
        formatBleError(error, "The ESP32 disconnected before confirming the session."),
      );
    });

    statusSubscription = manager.monitorCharacteristicForDevice(
      deviceId,
      PRESENSURE_BLE.serviceUuid,
      PRESENSURE_BLE.characteristics.status,
      (error, characteristic) => {
        if (!active) return;
        if (error) {
          rejectWaiter(
            formatBleError(
              error,
              "Unable to subscribe to ESP32 session status notifications.",
            ),
          );
          return;
        }
        if (!characteristic?.value) return;

        try {
          const status = parseJsonCharacteristic<Esp32ConfigurationStatus>(
            characteristic.value,
            "ESP32 status",
          );
          statusState.last = status;
          console.log("[PresenSure:ble-status]", {
            status: status.status,
            code: status.code,
            message: status.message,
          });

          if (status.status === "ERROR") {
            waiter?.reject(
              new Error(
                status.message ||
                  `ESP32 rejected the BLE command: ${status.code || "UNKNOWN_ERROR"}.`,
              ),
            );
          } else if (waiter?.expected === status.status) {
            waiter.resolve(status);
          }
        } catch (error) {
          rejectWaiter(
            error instanceof Error
              ? error
              : new Error("Invalid ESP32 status response."),
          );
        }
      },
    );

    await waitForStatus("READY");

    const encodedAuthentication = encodeBlePayload({
      command: "AUTHENTICATE",
      secret: PRESENSURE_BLE.developmentSecret,
    });
    const authenticationResult = waitForStatus("AUTHENTICATED");
    try {
      await manager.writeCharacteristicWithResponseForDevice(
        deviceId,
        PRESENSURE_BLE.serviceUuid,
        PRESENSURE_BLE.characteristics.authentication,
        encodedAuthentication,
      );
    } catch (error) {
      rejectWaiter(formatBleError(error, "Unable to authenticate with the ESP32."));
    }
    await authenticationResult;

    const encodedSession = encodeBlePayload({
      ...configuration,
      issued_at: Math.floor(Date.now() / 1000),
    });
    const sessionResult = waitForStatus("SESSION_STARTED");
    try {
      await manager.writeCharacteristicWithResponseForDevice(
        deviceId,
        PRESENSURE_BLE.serviceUuid,
        PRESENSURE_BLE.characteristics.session,
        encodedSession,
      );
    } catch (error) {
      rejectWaiter(
        formatBleError(error, "Unable to send the session configuration to the ESP32."),
      );
    }

    return await sessionResult;
  } catch (error) {
    const formattedError = formatBleError(error, "Unable to configure the ESP32 session.");
    logError("ble.session-command", formattedError, {
      blePeripheralId: deviceId,
      lastStatus: statusState.last?.status,
    });
    throw formattedError;
  } finally {
    active = false;
    statusSubscription?.remove();
    disconnectSubscription?.remove();
  }
}

export function subscribeToEsp32Disconnection(
  deviceId: string,
  listener: (message: string | null) => void,
) {
  return manager.onDeviceDisconnected(deviceId, (error) => {
    if (error) {
      logError("ble.disconnected", error, { blePeripheralId: deviceId });
    }
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
