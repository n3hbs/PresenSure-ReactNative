import { Ionicons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/app/providers/theme-provider';
import { useAuth } from '@/context/auth-context';
import {
  buildDeviceRegistrationPayload,
  registerDevice,
} from '@/services/device/device-registration-service';

export default function DeviceRegistrationScreen() {
  const theme = useAppTheme();
  const { isAuthenticated, isLoadingSession, user, refreshDeviceRegistration } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoadingSession) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  async function handleRegisterDevice() {
    if (!user?.user_id) return;

    setIsRegistering(true);
    setError(null);

    try {
      const payload = await buildDeviceRegistrationPayload(user.user_id);
      await registerDevice(payload);
      await refreshDeviceRegistration();
      router.replace('/');
    } catch (registrationError) {
      const message =
        registrationError instanceof Error
          ? registrationError.message
          : 'Unable to register this device.';
      setError(message);
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.spacing.screen }}>
        <View
          style={{
            alignItems: 'center',
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.card,
            borderWidth: 1,
            padding: 24,
          }}>
          <View
            style={{
              alignItems: 'center',
              backgroundColor: theme.colors.primarySoft,
              borderRadius: 18,
              height: 64,
              justifyContent: 'center',
              width: 64,
            }}>
            <Ionicons name="phone-portrait-outline" size={34} color={theme.colors.primary} />
          </View>

          <Text
            style={{
              color: theme.colors.text,
              fontSize: 24,
              fontWeight: '900',
              marginTop: 18,
              textAlign: 'center',
            }}>
            Register this device
          </Text>
          <Text
            style={{
              color: theme.colors.textMuted,
              fontSize: 14,
              lineHeight: 21,
              marginTop: 8,
              textAlign: 'center',
            }}>
            PresenSure records an app-specific device identity before attendance features are
            enabled. Hardware identifiers are not used as the only source of identity.
          </Text>

          {error ? (
            <View
              style={{
                backgroundColor: '#FEF2F2',
                borderColor: '#FECACA',
                borderRadius: theme.radii.input,
                borderWidth: 1,
                marginTop: 18,
                padding: 12,
                width: '100%',
              }}>
              <Text style={{ color: '#991B1B', fontSize: 13, fontWeight: '700' }}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            disabled={isRegistering}
            onPress={handleRegisterDevice}
            style={({ pressed }) => ({
              alignItems: 'center',
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radii.button,
              flexDirection: 'row',
              gap: 8,
              justifyContent: 'center',
              marginTop: 22,
              minHeight: 52,
              opacity: pressed || isRegistering ? 0.76 : 1,
              paddingHorizontal: 18,
              width: '100%',
            })}>
            {isRegistering ? <ActivityIndicator color="#FFFFFF" /> : null}
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>
              {isRegistering ? 'Registering...' : 'Register device'}
            </Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
