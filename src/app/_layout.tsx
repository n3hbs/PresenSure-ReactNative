import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#2563EB',
          tabBarInactiveTintColor: '#64748B',
          tabBarStyle: {
            height: 68,
            paddingTop: 7,
            paddingBottom: 9,
            borderTopColor: '#E2E8F0',
            backgroundColor: '#FFFFFF',
          },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'BLE Scanner',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="bluetooth" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="face-recognition"
          options={{
            title: 'Face',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="scan-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen name="explore" options={{ href: null }} />
      </Tabs>
    </>
  );
}
