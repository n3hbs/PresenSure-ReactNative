import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/context/auth-context';
import { isValidUserId } from '@/utils/validators';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedUserId = userId.trim().toUpperCase();

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
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.container}>
            <View style={styles.brandMark}>
              <Ionicons name="shield-checkmark" size={34} color="#FFFFFF" />
            </View>
            <Text style={styles.eyebrow}>PRESENSURE</Text>
            <Text style={styles.title}>Sign in</Text>
            <Text style={styles.subtitle}>Use your student or account ID to continue.</Text>

            <View style={styles.form}>
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>User ID</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="person-outline" size={19} color="#64748B" />
                  <TextInput
                    autoCapitalize="characters"
                    autoCorrect={false}
                    keyboardType="default"
                    onChangeText={setUserId}
                    placeholder="C-0000-0000"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="next"
                    style={styles.input}
                    value={userId}
                  />
                </View>
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="lock-closed-outline" size={19} color="#64748B" />
                  <TextInput
                    autoCapitalize="none"
                    onChangeText={setPassword}
                    onSubmitEditing={handleLogin}
                    placeholder="Password"
                    placeholderTextColor="#94A3B8"
                    returnKeyType="done"
                    secureTextEntry={!isPasswordVisible}
                    style={styles.input}
                    value={password}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setIsPasswordVisible((current) => !current)}
                    style={styles.iconButton}>
                    <Ionicons
                      name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color="#475569"
                    />
                  </Pressable>
                </View>
              </View>

              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <Pressable
                accessibilityRole="button"
                disabled={isSubmitting}
                onPress={handleLogin}
                style={({ pressed }) => [
                  styles.loginButton,
                  (pressed || isSubmitting) && styles.buttonPressed,
                ]}>
                <Text style={styles.loginButtonText}>
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

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8FAFC' },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 52,
  },
  brandMark: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    marginBottom: 22,
  },
  eyebrow: { color: '#2563EB', fontSize: 12, fontWeight: '900', letterSpacing: 1.6 },
  title: { color: '#0F172A', fontSize: 34, fontWeight: '900', marginTop: 8 },
  subtitle: { color: '#64748B', fontSize: 15, lineHeight: 22, marginTop: 8, maxWidth: 300 },
  form: { marginTop: 34, gap: 16 },
  fieldGroup: { gap: 8 },
  label: { color: '#334155', fontSize: 13, fontWeight: '800' },
  inputShell: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D8E0EA',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  input: { flex: 1, color: '#0F172A', fontSize: 16, fontWeight: '700', paddingVertical: 12 },
  iconButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBox: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  errorText: { flex: 1, color: '#B91C1C', fontSize: 13, fontWeight: '700' },
  loginButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  loginButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  buttonPressed: { opacity: 0.76 },
});
