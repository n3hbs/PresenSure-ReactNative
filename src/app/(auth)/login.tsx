import { router } from 'expo-router';
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/app/providers/theme-provider';
import { useAuth } from '@/context/auth-context';
import {
  clearRememberedUserId,
  getRememberedUserId,
  storeRememberedUserId,
} from '@/utils/auth-storage';
import { isValidUserId } from '@/utils/validators';

export default function LoginScreen() {
  const theme = useAppTheme();
  const { signIn } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedUserId = userId.trim().toUpperCase();

  useEffect(() => {
    let isMounted = true;

    getRememberedUserId().then((rememberedUserId) => {
      if (!isMounted || !rememberedUserId) return;
      setUserId(rememberedUserId);
      setRememberMe(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleLogin() {
    setError(null);

    if (!isValidUserId(normalizedUserId)) {
      setError('Use C-0000-0000 or 0000-0000 format.');
      return;
    }

    if (!password) {
      setError('Enter your password.');
      return;
    }

    try {
      setIsSubmitting(true);
      await signIn({ user_id: normalizedUserId, password });
      if (rememberMe) {
        await storeRememberedUserId(normalizedUserId);
      } else {
        await clearRememberedUserId();
      }
      router.replace('/');
    } catch (loginError) {
      const message =
        loginError instanceof Error ? loginError.message : 'Unable to login. Please try again.';
      setError(message);
      Alert.alert('Login failed', message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#2563EB' }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ backgroundColor: theme.colors.background }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="flex-grow justify-center px-6 pb-[52px] pt-[30px]">
            <View className="mb-[22px] h-16 w-16 items-center justify-center rounded-[18px] bg-blue-600">
              <ShieldCheck size={34} color="#FFFFFF" />
            </View>
            <Text className="text-xs font-black tracking-[1.6px] text-blue-600">PRESENSURE</Text>
            <Text className="mt-2 text-[34px] font-black" style={{ color: theme.colors.text }}>Sign in</Text>
            <Text className="mt-2 max-w-[300px] text-[15px] leading-[22px]" style={{ color: theme.colors.textMuted }}>
              Use your student or account ID to continue.
            </Text>

            <View className="mt-[34px] gap-4">
              <View className="gap-2">
                <Text className="text-[13px] font-extrabold" style={{ color: theme.colors.text }}>User ID</Text>
                <View
                  className="min-h-14 flex-row items-center rounded-2xl px-[15px]"
                  style={{ backgroundColor: theme.colors.surface, borderRadius: 16 }}>
                  <User size={19} color={theme.colors.textMuted} />
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    keyboardType="default"
                    onChangeText={setUserId}
                    placeholder="C-0000-0000"
                    placeholderTextColor={theme.colors.textMuted}
                    returnKeyType="next"
                    className="flex-1 py-3 text-base font-bold text-slate-950"
                    style={{ color: theme.colors.text }}
                    value={userId}
                  />
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-[13px] font-extrabold" style={{ color: theme.colors.text }}>Password</Text>
                <View
                  className="min-h-14 flex-row items-center rounded-2xl px-[15px]"
                  style={{ backgroundColor: theme.colors.surface, borderRadius: 16 }}>
                  <Lock size={19} color={theme.colors.textMuted} />
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setPassword}
                    onSubmitEditing={handleLogin}
                    placeholder="Password"
                    placeholderTextColor={theme.colors.textMuted}
                    returnKeyType="done"
                    secureTextEntry={!isPasswordVisible}
                    className="flex-1 py-3 text-base font-bold text-slate-950"
                    style={{ color: theme.colors.text }}
                    value={password}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setIsPasswordVisible((current) => !current)}
                    className="h-[38px] w-[38px] items-center justify-center">
                    {isPasswordVisible ? (
                      <EyeOff size={20} color={theme.colors.textMuted} />
                    ) : (
                      <Eye size={20} color={theme.colors.textMuted} />
                    )}
                  </Pressable>
                </View>
              </View>

              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                onPress={() => setRememberMe((current) => !current)}
                className="min-h-11 flex-row items-center gap-2.5"
                style={({ pressed }) => pressed && { opacity: 0.76 }}>
                <View
                  className="h-[22px] w-[22px] items-center justify-center rounded-[7px] border-2"
                  style={{
                    backgroundColor: rememberMe ? theme.colors.primary : theme.colors.surface,
                    borderColor: rememberMe ? theme.colors.primary : theme.colors.border,
                  }}>
                  {rememberMe && <Check size={15} color="#FFFFFF" />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-extrabold" style={{ color: theme.colors.text }}>Remember me</Text>
                  <Text className="mt-0.5 text-xs font-semibold" style={{ color: theme.colors.textMuted }}>
                    Save this user ID for next time.
                  </Text>
                </View>
              </Pressable>

              {error && (
                <View className="min-h-11 flex-row items-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-3">
                  <AlertCircle size={18} color="#B91C1C" />
                  <Text className="flex-1 text-[13px] font-bold text-red-700">{error}</Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleLogin}
                className="mt-1 min-h-14 flex-row items-center justify-center gap-2.5 rounded-2xl bg-blue-600"
                style={({ pressed }) => (pressed || isSubmitting) && { opacity: 0.76 }}>
                <Text className="text-base font-black text-white">
                  {isSubmitting ? 'Signing in...' : 'Sign in'}
                </Text>
                <ArrowRight size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
