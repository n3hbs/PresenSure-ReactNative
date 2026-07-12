import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BleManager, type Device, State } from 'react-native-ble-plx';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';

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
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] ===
        PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

function signalLabel(rssi: number | null) {
  if (rssi === null) return 'Unknown';
  if (rssi >= -60) return 'Strong';
  if (rssi >= -80) return 'Nearby';
  return 'Weak';
}

export default function BleScannerScreen() {
  const { signOut } = useAuth();
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
    setStatus((current) => (current === 'Scanning nearby devices…' ? 'Scan complete' : current));
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
        Alert.alert(
          'Permission needed',
          'Allow Nearby devices access so PresenSure can discover BLE devices.',
        );
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
      setStatus('Scanning nearby devices…');

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

  const handleLogout = useCallback(async () => {
    if (isScanning) stopScan();
    await signOut();
    router.replace('/login');
  }, [isScanning, signOut, stopScan]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconBox}>
            <Ionicons name="bluetooth" size={26} color="#FFFFFF" />
          </View>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PRESENSURE</Text>
            <Text style={styles.title}>Nearby devices</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Logout"
          accessibilityRole="button"
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutButton, pressed && styles.buttonPressed]}>
          <Ionicons name="log-out-outline" size={22} color="#DC2626" />
        </Pressable>
      </View>

      <View style={styles.statusCard}>
        <View>
          <Text style={styles.statusLabel}>BLE SCANNER</Text>
          <Text style={styles.statusText}>{status}</Text>
        </View>
        <View style={[styles.statusDot, isScanning && styles.statusDotActive]} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={startScan}
        style={({ pressed }) => [
          styles.scanButton,
          isScanning && styles.stopButton,
          pressed && styles.buttonPressed,
        ]}>
        <Ionicons name={isScanning ? 'stop' : 'scan'} size={20} color="#FFFFFF" />
        <Text style={styles.scanButtonText}>{isScanning ? 'Stop scanning' : 'Scan for devices'}</Text>
      </Pressable>

      <View style={styles.listHeader}>
        <Text style={styles.listTitle}>Devices in range</Text>
        <Text style={styles.deviceCount}>{devices.length}</Text>
      </View>

      <FlatList
        data={devices}
        keyExtractor={(item) => item.id}
        contentContainerStyle={devices.length === 0 ? styles.emptyList : styles.deviceList}
        renderItem={({ item }) => (
          <View style={styles.deviceCard}>
            <View style={styles.deviceIcon}>
              <Ionicons name="hardware-chip-outline" size={22} color="#2563EB" />
            </View>
            <View style={styles.deviceDetails}>
              <Text style={styles.deviceName} numberOfLines={1}>
                {item.name ?? item.localName ?? 'Unnamed BLE device'}
              </Text>
              <Text style={styles.deviceId} numberOfLines={1}>
                {item.id}
              </Text>
            </View>
            <View style={styles.signal}>
              <Ionicons name="cellular" size={17} color="#64748B" />
              <Text style={styles.signalText}>{signalLabel(item.rssi)}</Text>
              <Text style={styles.rssi}>{item.rssi === null ? '—' : `${item.rssi} dBm`}</Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="radio-outline" size={34} color="#64748B" />
            </View>
            <Text style={styles.emptyTitle}>No devices found yet</Text>
            <Text style={styles.emptyText}>
              Make sure your BLE device is powered on and advertising, then start a scan.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { marginLeft: 13 },
  eyebrow: { color: '#2563EB', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  title: { color: '#0F172A', fontSize: 27, fontWeight: '800', letterSpacing: -0.5 },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  statusCard: {
    marginHorizontal: 20,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: { color: '#64748B', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  statusText: { color: '#0F172A', fontSize: 16, fontWeight: '700', marginTop: 5 },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#CBD5E1' },
  statusDotActive: { backgroundColor: '#22C55E' },
  scanButton: {
    margin: 20,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  stopButton: { backgroundColor: '#DC2626' },
  buttonPressed: { opacity: 0.82 },
  scanButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  listTitle: { color: '#0F172A', fontSize: 18, fontWeight: '800' },
  deviceCount: {
    marginLeft: 9,
    minWidth: 25,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
    textAlign: 'center',
    backgroundColor: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '800',
  },
  deviceList: { paddingHorizontal: 20, paddingBottom: 110, gap: 10 },
  deviceCard: {
    minHeight: 82,
    padding: 14,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceDetails: { flex: 1, marginHorizontal: 12 },
  deviceName: { color: '#0F172A', fontSize: 15, fontWeight: '800' },
  deviceId: { color: '#94A3B8', fontSize: 11, marginTop: 5 },
  signal: { alignItems: 'flex-end' },
  signalText: { color: '#475569', fontSize: 11, fontWeight: '700', marginTop: 3 },
  rssi: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
  emptyList: { flexGrow: 1, paddingHorizontal: 32, paddingBottom: 90 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { color: '#0F172A', fontSize: 17, fontWeight: '800', marginTop: 16 },
  emptyText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 7,
    maxWidth: 300,
  },
});
