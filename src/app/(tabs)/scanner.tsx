import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, FlatList, PermissionsAndroid, Platform, Pressable, Text, View } from 'react-native';
import { BleManager, type Device, State } from 'react-native-ble-plx';
import { SafeAreaView } from 'react-native-safe-area-context';

const SCAN_DURATION_MS = 10_000;

async function requestBlePermissions() {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);

    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function signalLabel(rssi: number | null) {
  if (rssi === null) return 'Unknown';
  if (rssi >= -60) return 'Strong';
  if (rssi >= -80) return 'Nearby';
  return 'Weak';
}

export default function BleScannerScreen() {
  const [manager] = useState(() => new BleManager());
  const [devices, setDevices] = useState<Device[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState('Ready to scan');
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopScan = useCallback(() => {
    manager.stopDeviceScan();
    if (scanTimer.current) {
      clearTimeout(scanTimer.current);
      scanTimer.current = null;
    }
    setIsScanning(false);
    setStatus((current) => (current === 'Scanning nearby devices...' ? 'Scan complete' : current));
  }, [manager]);

  useEffect(() => {
    return () => {
      if (scanTimer.current) clearTimeout(scanTimer.current);
      manager.stopDeviceScan();
      manager.destroy();
    };
  }, [manager]);

  const startScan = useCallback(async () => {
    if (isScanning) {
      stopScan();
      return;
    }

    try {
      const hasPermission = await requestBlePermissions();
      if (!hasPermission) {
        setStatus('Bluetooth permission denied');
        Alert.alert('Permission needed', 'Allow Nearby devices access so PresenSure can discover BLE devices.');
        return;
      }

      const bluetoothState = await manager.state();
      if (bluetoothState !== State.PoweredOn) {
        setStatus('Bluetooth is turned off');
        Alert.alert('Bluetooth is off', 'Turn on Bluetooth, then try scanning again.');
        return;
      }

      setDevices([]);
      setIsScanning(true);
      setStatus('Scanning nearby devices...');

      manager.startDeviceScan(null, null, (error, device) => {
        if (error) {
          stopScan();
          setStatus(error.message);
          Alert.alert('Scan failed', error.message);
          return;
        }

        if (!device) return;

        setDevices((current) => {
          const next = new Map(current.map((item) => [item.id, item]));
          next.set(device.id, device);
          return [...next.values()].sort((a, b) => (b.rssi ?? -999) - (a.rssi ?? -999));
        });
      });

      scanTimer.current = setTimeout(stopScan, SCAN_DURATION_MS);
    } catch (error) {
      stopScan();
      const message = error instanceof Error ? error.message : 'Unable to start BLE scan.';
      setStatus(message);
      Alert.alert('Bluetooth error', message);
    }
  }, [isScanning, manager, stopScan]);

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <View className="flex-row items-center px-5 pb-[18px] pt-3">
        <View className="h-12 w-12 items-center justify-center rounded-[15px] bg-blue-600">
          <Ionicons name="bluetooth" size={26} color="#FFFFFF" />
        </View>
        <View className="ml-[13px]">
          <Text className="text-[11px] font-extrabold tracking-[1.5px] text-blue-600">PRESENSURE</Text>
          <Text className="text-[27px] font-extrabold text-slate-950">Nearby devices</Text>
        </View>
      </View>

      <View className="mx-5 flex-row items-center justify-between rounded-[18px] border border-slate-200 bg-white p-[18px]">
        <View>
          <Text className="text-[11px] font-extrabold tracking-[1.2px] text-slate-500">BLE SCANNER</Text>
          <Text className="mt-1 text-base font-bold text-slate-950">{status}</Text>
        </View>
        <View className={`h-3 w-3 rounded-full ${isScanning ? 'bg-green-500' : 'bg-slate-300'}`} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={startScan}
        className={`m-5 min-h-[54px] flex-row items-center justify-center gap-[9px] rounded-2xl ${
          isScanning ? 'bg-red-600' : 'bg-blue-600'
        }`}
        style={({ pressed }) => pressed && { opacity: 0.82 }}>
        <Ionicons name={isScanning ? 'stop' : 'scan'} size={20} color="#FFFFFF" />
        <Text className="text-base font-extrabold text-white">
          {isScanning ? 'Stop scanning' : 'Scan for devices'}
        </Text>
      </Pressable>

      <View className="mb-2.5 flex-row items-center px-5">
        <Text className="text-lg font-extrabold text-slate-950">Devices in range</Text>
        <Text className="ml-[9px] min-w-[25px] overflow-hidden rounded-xl bg-blue-100 px-[7px] py-[3px] text-center text-xs font-extrabold text-blue-700">
          {devices.length}
        </Text>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          devices.length === 0
            ? { flexGrow: 1, paddingHorizontal: 32, paddingBottom: 90 }
            : { paddingHorizontal: 20, paddingBottom: 110 }
        }
        ItemSeparatorComponent={() => <View className="h-2.5" />}
        renderItem={({ item }) => (
          <View className="min-h-[82px] flex-row items-center rounded-[17px] border border-slate-200 bg-white p-3.5">
            <View className="h-11 w-11 items-center justify-center rounded-[14px] bg-blue-50">
              <Ionicons name="hardware-chip-outline" size={22} color="#2563EB" />
            </View>
            <View className="mx-3 flex-1">
              <Text className="text-[15px] font-extrabold text-slate-950" numberOfLines={1}>
                {item.name ?? item.localName ?? 'Unnamed BLE device'}
              </Text>
              <Text className="mt-1 text-[11px] text-slate-400" numberOfLines={1}>
                {item.id}
              </Text>
            </View>
            <View className="items-end">
              <Ionicons name="cellular" size={17} color="#64748B" />
              <Text className="mt-1 text-[11px] font-bold text-slate-600">{signalLabel(item.rssi)}</Text>
              <Text className="mt-0.5 text-[10px] text-slate-400">
                {item.rssi === null ? '-' : `${item.rssi} dBm`}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center">
            <View className="h-[72px] w-[72px] items-center justify-center rounded-3xl bg-slate-200">
              <Ionicons name="radio-outline" size={34} color="#64748B" />
            </View>
            <Text className="mt-4 text-[17px] font-extrabold text-slate-950">No devices found yet</Text>
            <Text className="mt-[7px] max-w-[300px] text-center text-sm leading-[21px] text-slate-500">
              Make sure your BLE device is powered on and advertising, then start a scan.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
