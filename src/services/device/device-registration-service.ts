import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { apiClient } from '@/services/api/client';
import { deleteSecureItem, getSecureItem, setSecureItem } from '@/services/storage/secure-storage';
import type {
  DeviceRegistrationPayload,
  DeviceRegistrationResponse,
  LocalDeviceIdentity,
  RegisteredDevice,
} from '@/types/device-registration';

const DEVICE_IDENTITY_KEY = 'presensure.device.identity';
const REGISTERED_DEVICE_KEY = 'presensure.device.registration';

function getAppVersion() {
  return Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';
}

function getBuildVersion() {
  return Constants.nativeBuildVersion ?? null;
}

function getPlatformName(): DeviceRegistrationPayload['platform'] {
  if (Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web') return Platform.OS;
  return 'unknown';
}

function normalizeRegisteredDevice(
  payload: DeviceRegistrationPayload,
  response?: DeviceRegistrationResponse,
): RegisteredDevice {
  const data = response?.data ?? {};

  return {
    deviceUuid: data.deviceUuid ?? data.device_uuid ?? payload.device_uuid,
    userId: data.userId ?? data.user_id ?? payload.user_id,
    status: data.status ?? 'active',
    deviceName: data.deviceName ?? data.device_name ?? payload.device_name,
    manufacturer: data.manufacturer ?? payload.manufacturer,
    model: data.model ?? payload.model,
    osName: data.osName ?? data.os_name ?? payload.os_name,
    osVersion: data.osVersion ?? data.os_version ?? payload.os_version,
    appVersion: data.appVersion ?? data.app_version ?? payload.app_version,
    buildVersion: data.buildVersion ?? data.build_version ?? payload.build_version,
    firstSeenAt: data.firstSeenAt ?? data.first_seen_at ?? null,
    lastUsedAt: data.lastUsedAt ?? data.last_used_at ?? null,
    serverId: data.serverId ?? data.id ?? null,
  };
}

export async function getOrCreateLocalDeviceIdentity(): Promise<LocalDeviceIdentity> {
  const storedIdentity = await getSecureItem(DEVICE_IDENTITY_KEY);

  if (storedIdentity) {
    try {
      return JSON.parse(storedIdentity) as LocalDeviceIdentity;
    } catch {
      await deleteSecureItem(DEVICE_IDENTITY_KEY);
    }
  }

  const identity: LocalDeviceIdentity = {
    deviceUuid: Crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  };

  await setSecureItem(DEVICE_IDENTITY_KEY, JSON.stringify(identity));
  return identity;
}

export async function buildDeviceRegistrationPayload(
  userId: string,
): Promise<DeviceRegistrationPayload> {
  const identity = await getOrCreateLocalDeviceIdentity();
  const manufacturer = Device.manufacturer ?? null;
  const model = Device.modelName ?? Device.modelId ?? null;
  const deviceName = [manufacturer, model].filter(Boolean).join(' ') || Device.deviceName || 'Android device';

  return {
    device_uuid: identity.deviceUuid,
    user_id: userId,
    device_name: deviceName,
    manufacturer,
    model,
    os_name: Device.osName ?? Platform.OS,
    os_version: Device.osVersion ?? null,
    platform: getPlatformName(),
    app_version: getAppVersion(),
    build_version: getBuildVersion(),
    push_token: null,
  };
}

export async function registerDevice(
  payload: DeviceRegistrationPayload,
): Promise<RegisteredDevice> {
  const response = await apiClient.post<DeviceRegistrationResponse>(
    '/api/mobile/devices/register',
    payload,
  );
  const registeredDevice = normalizeRegisteredDevice(payload, response.data);

  await AsyncStorage.setItem(REGISTERED_DEVICE_KEY, JSON.stringify(registeredDevice));
  return registeredDevice;
}

export async function getStoredDeviceRegistration(): Promise<RegisteredDevice | null> {
  const rawRegistration = await AsyncStorage.getItem(REGISTERED_DEVICE_KEY);
  if (!rawRegistration) return null;

  try {
    return JSON.parse(rawRegistration) as RegisteredDevice;
  } catch {
    await AsyncStorage.removeItem(REGISTERED_DEVICE_KEY);
    return null;
  }
}

export async function clearDeviceRegistration() {
  await AsyncStorage.removeItem(REGISTERED_DEVICE_KEY);
}
