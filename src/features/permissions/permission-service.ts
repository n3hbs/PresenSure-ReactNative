import * as Notifications from 'expo-notifications';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

import type {
  PermissionCheckResult,
  PermissionRequestResult,
  PresenSurePermission,
} from '@/types/permissions';

type AndroidPermissionName = Parameters<typeof PermissionsAndroid.check>[0];

const ANDROID_PERMISSION_NAMES: Partial<Record<PresenSurePermission, AndroidPermissionName>> = {
  bluetoothScan: 'android.permission.BLUETOOTH_SCAN' as AndroidPermissionName,
  bluetoothConnect: 'android.permission.BLUETOOTH_CONNECT' as AndroidPermissionName,
  bluetoothAdvertise: 'android.permission.BLUETOOTH_ADVERTISE' as AndroidPermissionName,
  camera: PermissionsAndroid.PERMISSIONS.CAMERA,
  fineLocation: PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
};

export const permissionDescriptors: Record<
  PresenSurePermission,
  {
    title: string;
    rationale: string;
    minAndroidVersion?: number;
  }
> = {
  bluetoothScan: {
    title: 'Nearby device scanning',
    rationale: 'PresenSure will use this later to discover authorized attendance broadcasts.',
    minAndroidVersion: 31,
  },
  bluetoothConnect: {
    title: 'Bluetooth connection state',
    rationale: 'PresenSure will use this later to confirm Bluetooth availability during attendance.',
    minAndroidVersion: 31,
  },
  bluetoothAdvertise: {
    title: 'Bluetooth advertising',
    rationale: 'PresenSure will use this later only for instructor phone broadcasting.',
    minAndroidVersion: 31,
  },
  camera: {
    title: 'Camera',
    rationale: 'PresenSure will use this later for biometric enrollment and verification.',
  },
  notifications: {
    title: 'Notifications',
    rationale: 'PresenSure uses notifications for attendance and synchronization updates.',
    minAndroidVersion: 33,
  },
  fineLocation: {
    title: 'Location compatibility',
    rationale: 'Some Android BLE libraries require location permission for Bluetooth discovery.',
  },
};

function isAndroidPermissionAvailable(permission: PresenSurePermission) {
  const minVersion = permissionDescriptors[permission].minAndroidVersion;
  return Platform.OS === 'android' && (!minVersion || Number(Platform.Version) >= minVersion);
}

export async function checkPresenSurePermission(
  permission: PresenSurePermission,
): Promise<PermissionCheckResult> {
  if (permission === 'notifications') {
    if (!isAndroidPermissionAvailable(permission)) {
      return {
        permission,
        granted: Platform.OS !== 'android',
        canAskAgain: false,
        availability: Platform.OS === 'android' ? 'unsupported' : 'android-only',
      };
    }

    const current = await Notifications.getPermissionsAsync();
    return {
      permission,
      granted: current.granted,
      canAskAgain: current.canAskAgain,
      availability: 'available',
    };
  }

  if (!isAndroidPermissionAvailable(permission)) {
    return {
      permission,
      granted: Platform.OS !== 'android',
      canAskAgain: false,
      availability: Platform.OS === 'android' ? 'unsupported' : 'android-only',
    };
  }

  const androidPermission = ANDROID_PERMISSION_NAMES[permission];
  if (!androidPermission) {
    return {
      permission,
      granted: false,
      canAskAgain: false,
      availability: 'unsupported',
    };
  }

  const granted = await PermissionsAndroid.check(androidPermission);

  return {
    permission,
    granted,
    canAskAgain: !granted,
    availability: 'available',
  };
}

export async function requestPresenSurePermission(
  permission: PresenSurePermission,
): Promise<PermissionRequestResult> {
  const current = await checkPresenSurePermission(permission);
  if (current.granted || current.availability !== 'available') {
    return { ...current, deniedPermanently: false };
  }

  if (permission === 'notifications') {
    const requested = await Notifications.requestPermissionsAsync();
    return {
      permission,
      granted: requested.granted,
      canAskAgain: requested.canAskAgain,
      availability: 'available',
      deniedPermanently: !requested.granted && !requested.canAskAgain,
    };
  }

  const androidPermission = ANDROID_PERMISSION_NAMES[permission];
  if (!androidPermission) {
    return { ...current, deniedPermanently: true };
  }

  const result = await PermissionsAndroid.request(androidPermission, {
    title: permissionDescriptors[permission].title,
    message: permissionDescriptors[permission].rationale,
    buttonPositive: 'Continue',
    buttonNegative: 'Not now',
  });

  return {
    permission,
    granted: result === PermissionsAndroid.RESULTS.GRANTED,
    canAskAgain: result !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    availability: 'available',
    deniedPermanently: result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
  };
}

export async function openApplicationSettings() {
  await Linking.openSettings();
}
