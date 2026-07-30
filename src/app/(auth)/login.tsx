import { router } from 'expo-router';
import { AlertCircle, ArrowRight, Check, Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollView as ScrollViewType,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StatusBar } from 'react-native';

import { useAuth } from '@/context/auth-context';
import {
  clearRememberedUserId,
  getRememberedUserId,
  storeRememberedUserId,
} from '@/utils/auth-storage';
import { isValidUserId } from '@/utils/validators';

const lightTheme = {
  background: '#F8FAFC',
  surface: '#F1F5F9',
  border: '#CBD5E1',
  text: '#0F172A',
  textMuted: '#64748B',
  primary: '#2563EB',
};

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollViewRef = useRef<ScrollViewType>(null);

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

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
      requestAnimationFrame(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      });
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function scrollFormControlsIntoView() {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }

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
    <SafeAreaView style={{ flex: 1, backgroundColor: lightTheme.background }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ backgroundColor: lightTheme.background }}>
        <ScrollView
          ref={scrollViewRef}
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: isKeyboardVisible ? 'flex-start' : 'center',
            paddingBottom: isKeyboardVisible ? 220 : 120,
            paddingHorizontal: 24,
            paddingTop: isKeyboardVisible ? 18 : 30,
          }}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View>
            <View className="mb-[22px] h-16 w-16 items-center justify-center rounded-[18px] bg-blue-600">
              <ShieldCheck size={34} color="#FFFFFF" />
            </View>
            <Text className="text-xs font-black tracking-[1.6px] text-blue-600">PRESENSURE</Text>
            <Text className="mt-2 text-[34px] font-black" style={{ color: lightTheme.text }}>Sign in</Text>
            <Text className="mt-2 max-w-[300px] text-[15px] leading-[22px]" style={{ color: lightTheme.textMuted }}>
              Use your student or account ID to continue.
            </Text>

            <View className="mt-[34px] gap-4">
              <View className="gap-2">
                <Text className="text-[13px] font-extrabold" style={{ color: lightTheme.text }}>User ID</Text>
                <View
                  className="min-h-14 flex-row items-center rounded-2xl px-[15px]"
                  style={{ backgroundColor: lightTheme.surface, borderRadius: 16 }}>
                  <User size={19} color={lightTheme.textMuted} />
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    keyboardType="default"
                    onChangeText={setUserId}
                    onFocus={scrollFormControlsIntoView}
                    placeholder="C-0000-0000"
                    placeholderTextColor={lightTheme.textMuted}
                    returnKeyType="next"
                    className="flex-1 py-3 text-base font-bold text-slate-950"
                    style={{ color: lightTheme.text }}
                    value={userId}
                  />
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-[13px] font-extrabold" style={{ color: lightTheme.text }}>Password</Text>
                <View
                  className="min-h-14 flex-row items-center rounded-2xl px-[15px]"
                  style={{ backgroundColor: lightTheme.surface, borderRadius: 16 }}>
                  <Lock size={19} color={lightTheme.textMuted} />
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setPassword}
                    onFocus={scrollFormControlsIntoView}
                    onSubmitEditing={handleLogin}
                    placeholder="Password"
                    placeholderTextColor={lightTheme.textMuted}
                    returnKeyType="done"
                    secureTextEntry={!isPasswordVisible}
                    className="flex-1 py-3 text-base font-bold text-slate-950"
                    style={{ color: lightTheme.text }}
                    value={password}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setIsPasswordVisible((current) => !current)}
                    className="h-[38px] w-[38px] items-center justify-center">
                    {isPasswordVisible ? (
                      <EyeOff size={20} color={lightTheme.textMuted} />
                    ) : (
                      <Eye size={20} color={lightTheme.textMuted} />
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
                    backgroundColor: rememberMe ? lightTheme.primary : lightTheme.surface,
                    borderColor: rememberMe ? lightTheme.primary : lightTheme.border,
                  }}>
                  {rememberMe && <Check size={15} color="#FFFFFF" />}
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-extrabold" style={{ color: lightTheme.text }}>Remember me</Text>
                  <Text className="mt-0.5 text-xs font-semibold" style={{ color: lightTheme.textMuted }}>
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
