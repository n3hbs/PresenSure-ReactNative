export type DeviceRegistrationStatus =
  | 'unregistered'
  | 'registering'
  | 'active'
  | 'revoked'
  | 'suspicious'
  | 'inactive'
  | 'error';

export type LocalDeviceIdentity = {
  deviceUuid: string;
  createdAt: string;
};

export type DeviceRegistrationPayload = {
  device_uuid: string;
  user_id: string;
  device_name: string;
  manufacturer: string | null;
  model: string | null;
  os_name: string;
  os_version: string | null;
  platform: 'android' | 'ios' | 'web' | 'unknown';
  app_version: string;
  build_version: string | null;
  push_token?: string | null;
};

export type RegisteredDevice = {
  deviceUuid: string;
  userId: string;
  status: Exclude<DeviceRegistrationStatus, 'registering' | 'error'>;
  deviceName: string;
  manufacturer: string | null;
  model: string | null;
  osName: string;
  osVersion: string | null;
  appVersion: string;
  buildVersion: string | null;
  firstSeenAt?: string | null;
  lastUsedAt?: string | null;
  serverId?: string | number | null;
};

export type DeviceRegistrationResponse = {
  message?: string;
  data?: Partial<RegisteredDevice> & {
    id?: string | number | null;
    device_uuid?: string;
    user_id?: string;
    status?: RegisteredDevice['status'];
    device_name?: string;
    os_name?: string;
    os_version?: string | null;
    app_version?: string;
    build_version?: string | null;
    first_seen_at?: string | null;
    last_used_at?: string | null;
  };
};
