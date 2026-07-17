import { Redirect, Tabs } from 'expo-router';
import { CalendarDays, Home, ShieldCheck } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

import { useAppTheme } from '@/app/providers/theme-provider';
import { useAuth } from '@/context/auth-context';

const TAB_SIDE_MARGIN = 16;

export default function TabsLayout() {
  const theme = useAppTheme();
  const { isAuthenticated, isLoadingSession } = useAuth();

  if (isLoadingSession) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          backgroundColor: theme.colors.background,
          justifyContent: 'center',
        }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          marginHorizontal: TAB_SIDE_MARGIN,
          bottom: 18,
          height: 70,
          borderRadius: 999,
          paddingTop: 7,
          paddingBottom: 8,
          borderTopWidth: 0,
          backgroundColor: theme.colors.surface,
          shadowColor: '#0F172A',
          shadowOpacity: 0.16,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 8 },
          elevation: 10,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: 'Attendance',
          tabBarIcon: ({ color, size }) => (
            <ShieldCheck color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color, size }) => (
            <CalendarDays color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ href: null }}
      />
      <Tabs.Screen name="scanner" options={{ href: null }} />
      <Tabs.Screen name="face-recognition" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}
