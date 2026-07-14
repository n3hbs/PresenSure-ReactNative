import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

import { useAuth } from '@/context/auth-context';
import {
  clearRememberedUserId,
  getRememberedUserId,
  storeRememberedUserId,
} from '@/utils/auth-storage';
import { isValidUserId } from '@/utils/validators';

export default function LoginScreen() {
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
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View className="flex-grow justify-center px-6 pb-[52px] pt-[30px]">
            <View className="mb-[22px] h-16 w-16 items-center justify-center rounded-[18px] bg-blue-600">
              <Ionicons name="shield-checkmark" size={34} color="#FFFFFF" />
            </View>
            <Text className="text-xs font-black tracking-[1.6px] text-blue-600">PRESENSURE</Text>
            <Text className="mt-2 text-[34px] font-black text-slate-950">Sign in</Text>
            <Text className="mt-2 max-w-[300px] text-[15px] leading-[22px] text-slate-500">
              Use your student or account ID to continue.
            </Text>

            <View className="mt-[34px] gap-4">
              <View className="gap-2">
                <Text className="text-[13px] font-extrabold text-slate-700">User ID</Text>
                <View className="min-h-14 flex-row items-center rounded-2xl border border-slate-300 bg-white px-[15px]">
                  <Ionicons name="person-outline" size={19} color="#64748B" />
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    keyboardType="default"
                    onChangeText={setUserId}
                    placeholder="C-0000-0000"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="next"
                    className="flex-1 py-3 text-base font-bold text-slate-950"
                    value={userId}
                  />
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-[13px] font-extrabold text-slate-700">Password</Text>
                <View className="min-h-14 flex-row items-center rounded-2xl border border-slate-300 bg-white px-[15px]">
                  <Ionicons name="lock-closed-outline" size={19} color="#64748B" />
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setPassword}
                    onSubmitEditing={handleLogin}
                    placeholder="Password"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="done"
                    secureTextEntry={!isPasswordVisible}
                    className="flex-1 py-3 text-base font-bold text-slate-950"
                    value={password}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setIsPasswordVisible((current) => !current)}
                    className="h-[38px] w-[38px] items-center justify-center">
                    <Ionicons
                      name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#475569"
                    />
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
                  className={`h-[22px] w-[22px] items-center justify-center rounded-[7px] border-2 ${
                    rememberMe ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white'
                  }`}>
                  {rememberMe && <Ionicons name="checkmark" size={15} color="#FFFFFF" />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-extrabold text-slate-950">Remember me</Text>
                  <Text className="mt-0.5 text-xs font-semibold text-slate-500">
                    Save this user ID for next time.
                  </Text>
                </View>
              </Pressable>

              {error && (
                <View className="min-h-11 flex-row items-center gap-2 rounded-[14px] border border-red-200 bg-red-50 px-3">
                  <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
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
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
