import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAppTheme } from '@/providers/theme-provider';
import { useAuth } from '@/context/auth-context';

export default function AuthLayout() {
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

  if (isAuthenticated) {
    return <Redirect href="/" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
