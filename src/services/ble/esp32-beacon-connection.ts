import {
  BleATTErrorCode,
  BleError,
  BleErrorCode,
  BleManager,
  State,
  type Device,
  type Subscription,
} from "react-native-ble-plx";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

import { requestPresenSurePermission } from "@/features/permissions/permission-service";
import {
  decodeBase64AdvertisementData,
  decodeBlePayload,
  encodeBlePayload,
  parseEsp32ManufacturerData,
  tryParseJsonPayload,
  type DecodedEsp32AdvertisementPayload,
} from "@/services/ble/ble-encoding";
import { PRESENSURE_BLE } from "@/services/ble/presensure-ble-protocol";
import type {
  Esp32ConfigurationStatus,
  Esp32StartSessionCommand,
  Esp32StopSessionCommand,
} from "@/types/attendance-session";
import { logError } from "@/utils/logger";

const SCAN_TIMEOUT_MS = 3_000;
const ADAPTER_STATE_TIMEOUT_MS = 5_000;
const CONNECTION_TIMEOUT_MS = 12_000;
const CONFIGURATION_ACK_TIMEOUT_MS = 10_000;
const manager = new BleManager();

export type DetectedEsp32Beacon = {
  id: string;
  beaconId: string;
  name: string;
  rssi: number | null;
  txPowerLevel?: number | null;
  serviceUUIDs?: string[] | null;
  manufacturerData?: string | null;
  serviceData?: Record<string, string> | null;
  decodedManufacturerData?: string | null;
  decodedServiceData?: Record<string, string> | null;
  advertisedPayload?: unknown | null;
  parsedEsp32Payload?: DecodedEsp32AdvertisementPayload | null;
  isRecommended: boolean;
};

export type ConnectedEsp32Beacon = {
  device: Device;
};

export class BluetoothPoweredOffError extends Error {
  constructor() {
    super("Bluetooth is turned off.");
    this.name = "BluetoothPoweredOffError";
  }
}

export function isBluetoothPoweredOffError(
  error: unknown,
): error is BluetoothPoweredOffError {
  return error instanceof BluetoothPoweredOffError;
}

export async function openBluetoothSettings() {
  if (Platform.OS === "android") {
    await Linking.sendIntent("android.settings.BLUETOOTH_SETTINGS");
    return;
  }

  await Linking.openSettings();
}

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

function validateStopCommand(command: Esp32StopSessionCommand) {
  if (
    command.command !== "STOP_SESSION" ||
    !command.session_id ||
    !Number.isInteger(command.schedule_id) ||
    command.schedule_id < 1
  ) {
    throw new Error("The stop command contains invalid ESP32 session data.");
  }
}

function getDeviceName(device: Device) {
  return device.localName ?? device.name ?? "";
}

function normalizeBeaconText(value?: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function isRoomMatched(beaconName: string, scheduleRoom?: string | null): boolean {
  if (!scheduleRoom) return false;
  const cleanRoom = scheduleRoom.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!cleanRoom) return false;

  const cleanBeacon = beaconName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const cleanBeaconWithoutPrefix = cleanBeacon.replace(/^(presensure|prensesure|esp32|beacon)/g, "");

  return (
    cleanBeacon.includes(cleanRoom) ||
    cleanBeaconWithoutPrefix.includes(cleanRoom) ||
    cleanBeacon === cleanRoom ||
    cleanBeaconWithoutPrefix === cleanRoom
  );
}

function isPresenSureDevice(name: string): boolean {
  if (!name) return false;
  const normalized = name.toLowerCase().trim();
  return normalized.includes("presensure") || normalized.includes("prensesure");
}

function toDetectedBeacon(device: Device, scheduleRoom?: string | null): DetectedEsp32Beacon | null {
  const name = getDeviceName(device);
  const serviceUuids = (device.serviceUUIDs ?? []).map((u) => u.toLowerCase());
  const targetServiceUuid = PRESENSURE_BLE.serviceUuid.toLowerCase();

  const manufacturerData = device.manufacturerData ?? null;
  const parsedEsp32Payload = parseEsp32ManufacturerData(manufacturerData);
  const isManufacturerMatch = Boolean(parsedEsp32Payload);

  const isUuidMatch = serviceUuids.includes(targetServiceUuid);
  const isMatch = isRoomMatched(name, scheduleRoom);
  const isNameMatch = isPresenSureDevice(name);

  // Accept if it has valid 23-byte ESP32 broadcast payload, PresenSure GATT service, matching room, or PresenSure name
  if (!isManufacturerMatch && !isUuidMatch && !isNameMatch && !isMatch) {
    return null;
  }

  const decodedManufacturerData = decodeBase64AdvertisementData(manufacturerData);
  const serviceData = device.serviceData ?? null;

  let decodedServiceData: Record<string, string> | null = null;
  let advertisedPayload: unknown | null = null;

  if (serviceData) {
    decodedServiceData = {};
    for (const [uuid, base64Val] of Object.entries(serviceData)) {
      const decodedText = decodeBase64AdvertisementData(base64Val);
      if (decodedText) {
        decodedServiceData[uuid] = decodedText;
        const parsedJson = tryParseJsonPayload(decodedText);
        if (parsedJson && !advertisedPayload) {
          advertisedPayload = parsedJson;
        }
      }
    }
  }

  if (!advertisedPayload && decodedManufacturerData) {
    advertisedPayload = tryParseJsonPayload(decodedManufacturerData);
  }

  const displayName = name || (scheduleRoom ? `PresenSure (${scheduleRoom})` : "PresenSure Beacon");

  return {
    id: device.id,
    beaconId: device.id,
    name: displayName,
    rssi: device.rssi ?? null,
    txPowerLevel: device.txPowerLevel ?? null,
    serviceUUIDs: device.serviceUUIDs ?? null,
    manufacturerData,
    serviceData,
    decodedManufacturerData,
    decodedServiceData,
    advertisedPayload,
    parsedEsp32Payload,
    isRecommended: isMatch || isManufacturerMatch,
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
  if (Platform.OS === "android") {
    if (Number(Platform.Version) >= 31) {
      const scan = await requestPresenSurePermission("bluetoothScan");
      if (!scan.granted && scan.availability === "available") {
        throw new Error("Nearby devices (Bluetooth Scan) permission is required to find the ESP32 beacon.");
      }

      await requestPresenSurePermission("bluetoothConnect");
    }

    // Location permission is mandatory on Android for BLE discovery when neverForLocation is false
    const location = await requestPresenSurePermission("fineLocation");
    if (!location.granted && location.availability === "available") {
      throw new Error("Location permission is required for Bluetooth scanning on Android. Please grant Location permission in App Settings.");
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
    throw new BluetoothPoweredOffError();
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
        reject(new BluetoothPoweredOffError());
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

    manager.startDeviceScan(null, null, (scanError, device) => {
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
      if (beacon) {
        // Deduplicate: merge if beacon with same name or same session hash already exists
        const existingKey = [...beacons.keys()].find((key) => {
          const existing = beacons.get(key);
          if (!existing) return false;
          if (existing.id === beacon.id) return true;
          if (
            existing.parsedEsp32Payload?.sessionHash &&
            beacon.parsedEsp32Payload?.sessionHash &&
            existing.parsedEsp32Payload.sessionHash === beacon.parsedEsp32Payload.sessionHash
          ) {
            return true;
          }
          if (
            existing.name &&
            beacon.name &&
            existing.name.toLowerCase().trim() === beacon.name.toLowerCase().trim()
          ) {
            return true;
          }
          return false;
        });

        if (existingKey) {
          const existing = beacons.get(existingKey)!;
          beacons.set(existingKey, {
            ...existing,
            ...beacon,
            id: existing.id,
            beaconId: existing.beaconId,
            name: (beacon.name && beacon.name !== "PresenSure Beacon") ? beacon.name : existing.name,
            rssi: Math.max(existing.rssi ?? -999, beacon.rssi ?? -999),
            parsedEsp32Payload: beacon.parsedEsp32Payload ?? existing.parsedEsp32Payload,
            isRecommended: existing.isRecommended || beacon.isRecommended,
          });
        } else {
          beacons.set(beacon.id, beacon);
        }
      }
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

async function sendEsp32SessionCommand(
  deviceId: string,
  configuration: Esp32StartSessionCommand | Esp32StopSessionCommand,
  expectedSessionStatus: "SESSION_STARTED" | "SESSION_STOPPED",
) {
  if (!(await manager.isDeviceConnected(deviceId))) {
    throw new Error("The ESP32 disconnected before it could be configured.");
  }

  type ExpectedStatus =
    | "READY"
    | "AUTHENTICATED"
    | "SESSION_STARTED"
    | "SESSION_STOPPED";
  type StatusWaiter = {
    expected: ExpectedStatus[];
    resolve: (status: Esp32ConfigurationStatus) => void;
    reject: (error: Error) => void;
  };

  let active = true;
  const statusState: { last: Esp32ConfigurationStatus | null } = { last: null };
  let monitoringError: Error | null = null;
  let waiter: StatusWaiter | null = null;
  let statusSubscription: Subscription | null = null;
  let disconnectSubscription: Subscription | null = null;

  function waitForStatus(expected: ExpectedStatus | ExpectedStatus[]) {
    const expectedStatuses = Array.isArray(expected) ? expected : [expected];
    if (
      statusState.last &&
      expectedStatuses.includes(statusState.last.status as ExpectedStatus)
    ) {
      return Promise.resolve(statusState.last);
    }
    if (monitoringError) return Promise.reject(monitoringError);
    if (waiter) {
      return Promise.reject(
        new Error(`Already waiting for ESP32 status ${waiter.expected.join(" or ")}.`),
      );
    }

    return new Promise<Esp32ConfigurationStatus>((resolve, reject) => {
      const timeout = setTimeout(() => {
        waiter = null;
        reject(
          new Error(
            `The ESP32 did not return ${expectedStatuses.join(" or ")}. Check its serial monitor.`,
          ),
        );
      }, CONFIGURATION_ACK_TIMEOUT_MS);

      waiter = {
        expected: expectedStatuses,
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


          if (status.status === "ERROR") {
            waiter?.reject(
              new Error(
                status.message ||
                  `ESP32 rejected the BLE command: ${status.code || "UNKNOWN_ERROR"}.`,
              ),
            );
          } else if (
            waiter?.expected.includes(status.status as ExpectedStatus)
          ) {
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

    await waitForStatus(
      configuration.command === "STOP_SESSION"
        ? ["READY", "SESSION_STARTED", "SESSION_STOPPED"]
        : "READY",
    );

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
    const sessionResult = waitForStatus(expectedSessionStatus);
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

export async function configureEsp32Attendance(
  deviceId: string,
  configuration: Esp32StartSessionCommand,
) {
  validateConfiguration(configuration);
  return sendEsp32SessionCommand(deviceId, configuration, "SESSION_STARTED");
}

export async function stopEsp32Attendance(
  deviceId: string,
  command: Esp32StopSessionCommand,
) {
  validateStopCommand(command);
  return sendEsp32SessionCommand(deviceId, command, "SESSION_STOPPED");
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
