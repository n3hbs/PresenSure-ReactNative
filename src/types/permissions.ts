export type PresenSurePermission =
  | 'bluetoothScan'
  | 'bluetoothConnect'
  | 'bluetoothAdvertise'
  | 'camera'
  | 'notifications'
  | 'fineLocation';

export type PermissionAvailability = 'available' | 'android-only' | 'unsupported';

export type PermissionCheckResult = {
  permission: PresenSurePermission;
  granted: boolean;
  canAskAgain: boolean;
  availability: PermissionAvailability;
};

export type PermissionRequestResult = PermissionCheckResult & {
  deniedPermanently: boolean;
};
