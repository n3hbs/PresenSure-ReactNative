import { router } from 'expo-router';
import {
  ChevronLeft,
  GraduationCap,
  IdCard,
  LogOut,
  Moon,
  Smartphone,
  Sun,
  User,
  UserCircle,
} from 'lucide-react-native';
import { useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/app/providers/theme-provider';
import { useAuth } from '@/context/auth-context';

function getProfileImageUri(user: ReturnType<typeof useAuth>['user']) {
  return (
    user?.profile?.imagelink ??
    user?.image ??
    user?.avatar ??
    user?.profile_photo ??
    user?.profile_image ??
    null
  );
}

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { signOut, user } = useAuth();

  const displayName = useMemo(() => {
    if (!user) return 'Student';
    return [user.first_name, user.middle_initial, user.last_name, user.suffix]
      .filter(Boolean)
      .join(' ');
  }, [user]);

  const initials = useMemo(() => {
    if (!user) return 'S';
    return `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || 'S';
  }, [user]);

  const profileImageUri = getProfileImageUri(user);
  const roleName = user?.role?.role_name ?? 'Student';

  async function handleLogout() {
    await signOut();
    router.replace('/login');
  }

  const isDarkMode = theme.mode === 'dark';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#2563EB' }} edges={['top']}>
      <View className="min-h-[58px] flex-row items-center bg-blue-600 px-4">
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          className="h-[42px] w-[42px] items-center justify-center rounded-full bg-white/15"
          style={({ pressed }) => pressed && { opacity: 0.78 }}>
          <ChevronLeft size={24} color="#FFFFFF" />
        </Pressable>
        <Text className="flex-1 text-center text-lg font-black text-white">Profile</Text>
        <View className="h-[42px] w-[42px]" />
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{ alignItems: 'center', paddingBottom: 18, paddingHorizontal: 16, paddingTop: 22 }}
        showsVerticalScrollIndicator={false}>
        <View
          className="h-[116px] w-[116px] items-center justify-center overflow-hidden rounded-full border-4 shadow-lg shadow-slate-900/10"
          style={{ backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.surface }}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} className="h-full w-full" />
          ) : (
            <Text style={{ color: theme.colors.primary, fontSize: 34, fontWeight: '900' }}>{initials}</Text>
          )}
        </View>

        <Text
          className="mt-[18px] text-center text-2xl font-black"
          numberOfLines={2}
          style={{ color: theme.colors.text }}>
          {displayName}
        </Text>
        <Text className="mt-1.5 text-sm font-black" style={{ color: theme.colors.primary }}>
          {roleName}
        </Text>

        <View
          className="mt-7 self-stretch overflow-hidden rounded-[18px]"
          style={{ backgroundColor: theme.colors.surface, borderRadius: 18 }}>
          <View className="min-h-[68px] flex-row items-center px-4">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.primarySoft }}>
              <UserCircle size={18} color={theme.colors.primary} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black" style={{ color: theme.colors.textMuted }}>Full Name</Text>
              <Text className="mt-1 text-[15px] font-extrabold" style={{ color: theme.colors.text }}>{displayName}</Text>
            </View>
          </View>

          <View className="min-h-[68px] flex-row items-center px-4">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.primarySoft }}>
              <IdCard size={18} color={theme.colors.primary} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black" style={{ color: theme.colors.textMuted }}>User ID</Text>
              <Text className="mt-1 text-[15px] font-extrabold" style={{ color: theme.colors.text }}>
                {user?.user_id ?? 'Not set'}
              </Text>
            </View>
          </View>

          <View className="min-h-[68px] flex-row items-center px-4">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.primarySoft }}>
              <GraduationCap size={18} color={theme.colors.primary} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black" style={{ color: theme.colors.textMuted }}>Role</Text>
              <Text className="mt-1 text-[15px] font-extrabold" style={{ color: theme.colors.text }}>{roleName}</Text>
            </View>
          </View>

          <View className="min-h-[68px] flex-row items-center px-4">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full" style={{ backgroundColor: theme.colors.primarySoft }}>
              <User size={18} color={theme.colors.primary} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black" style={{ color: theme.colors.textMuted }}>Sex</Text>
              <Text className="mt-1 text-[15px] font-extrabold" style={{ color: theme.colors.text }}>
                {user?.sex ?? 'Not set'}
              </Text>
            </View>
          </View>
        </View>

        <View
          className="mt-4 self-stretch rounded-[18px] p-4"
          style={{ backgroundColor: theme.colors.surface, borderRadius: 18 }}>
          <Text className="text-xs font-black uppercase tracking-[1.1px]" style={{ color: theme.colors.textMuted }}>
            Appearance
          </Text>
          <Pressable
            accessibilityRole="switch"
            accessibilityState={{ checked: isDarkMode }}
            onPress={() => theme.setMode(isDarkMode ? 'light' : 'dark')}
            className="mt-3 h-[54px] justify-center p-1.5"
            style={({ pressed }) => ({
              backgroundColor: theme.colors.background,
              borderRadius: 999,
              overflow: 'hidden',
              opacity: pressed ? 0.82 : 1,
            })}>
            <View className="flex-row">
              <View
                className="h-[42px] flex-1 flex-row items-center justify-center gap-2"
                style={{
                  backgroundColor: !isDarkMode ? theme.colors.primary : 'transparent',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}>
                <Sun size={18} color={!isDarkMode ? '#FFFFFF' : theme.colors.textMuted} />
                <Text
                  className="text-sm font-black"
                  style={{ color: !isDarkMode ? '#FFFFFF' : theme.colors.textMuted }}>
                  Light
                </Text>
              </View>
              <View
                className="h-[42px] flex-1 flex-row items-center justify-center gap-2"
                style={{
                  backgroundColor: isDarkMode ? theme.colors.primary : 'transparent',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}>
                <Moon size={18} color={isDarkMode ? '#FFFFFF' : theme.colors.textMuted} />
                <Text
                  className="text-sm font-black"
                  style={{ color: isDarkMode ? '#FFFFFF' : theme.colors.textMuted }}>
                  Dark
                </Text>
              </View>
            </View>
          </Pressable>
        </View>

        <View className="mt-3.5 flex-row items-center justify-center gap-[7px] self-stretch">
          <Smartphone size={16} color={theme.colors.textMuted} />
          <Text className="text-xs font-extrabold" style={{ color: theme.colors.textMuted }}>
            Saved on this device for offline viewing
          </Text>
        </View>
      </ScrollView>

      <View style={{ backgroundColor: theme.colors.background, padding: 16, paddingBottom: 28 }}>
        <Pressable
          accessibilityLabel="Logout"
          accessibilityRole="button"
          onPress={handleLogout}
          className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl"
          style={({ pressed }) => ({
            backgroundColor: '#DC2626',
            borderRadius: 16,
            opacity: pressed ? 0.78 : 1,
          })}>
          <LogOut size={20} color="#FFFFFF" />
          <Text className="text-base font-black text-white">Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
