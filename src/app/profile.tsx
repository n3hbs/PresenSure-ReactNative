import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

  return (
    <SafeAreaView className="flex-1 bg-slate-100" edges={['top']}>
      <View className="min-h-[58px] flex-row items-center px-4">
        <Pressable
          accessibilityLabel="Go back"
          accessibilityRole="button"
          onPress={() => router.back()}
          className="h-[42px] w-[42px] items-center justify-center rounded-full border border-slate-200 bg-white"
          style={({ pressed }) => pressed && { opacity: 0.78 }}>
          <Ionicons name="chevron-back" size={24} color="#0F172A" />
        </Pressable>
        <Text className="flex-1 text-center text-lg font-black text-slate-950">Profile</Text>
        <View className="h-[42px] w-[42px]" />
      </View>

      <View className="flex-1 items-center px-4 pt-[22px]">
        <View className="h-[116px] w-[116px] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-blue-100 shadow-lg shadow-slate-900/10">
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} className="h-full w-full" />
          ) : (
            <Text className="text-[34px] font-black text-blue-600">{initials}</Text>
          )}
        </View>

        <Text className="mt-[18px] text-center text-2xl font-black text-slate-950" numberOfLines={2}>
          {displayName}
        </Text>
        <Text className="mt-1.5 text-sm font-black text-blue-600">{roleName}</Text>

        <View className="mt-7 self-stretch overflow-hidden rounded-[18px] border border-slate-200 bg-white">
          <View className="min-h-[68px] flex-row items-center border-b border-slate-100 px-4">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-blue-50">
              <Ionicons name="person-circle-outline" size={18} color="#2563EB" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black text-slate-500">Full Name</Text>
              <Text className="mt-1 text-[15px] font-extrabold text-slate-950">{displayName}</Text>
            </View>
          </View>

          <View className="min-h-[68px] flex-row items-center border-b border-slate-100 px-4">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-blue-50">
              <Ionicons name="id-card-outline" size={18} color="#2563EB" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black text-slate-500">User ID</Text>
              <Text className="mt-1 text-[15px] font-extrabold text-slate-950">
                {user?.user_id ?? 'Not set'}
              </Text>
            </View>
          </View>

          <View className="min-h-[68px] flex-row items-center border-b border-slate-100 px-4">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-blue-50">
              <Ionicons name="school-outline" size={18} color="#2563EB" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black text-slate-500">Role</Text>
              <Text className="mt-1 text-[15px] font-extrabold text-slate-950">{roleName}</Text>
            </View>
          </View>

          <View className="min-h-[68px] flex-row items-center px-4">
            <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-blue-50">
              <Ionicons name="person-outline" size={18} color="#2563EB" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-xs font-black text-slate-500">Sex</Text>
              <Text className="mt-1 text-[15px] font-extrabold text-slate-950">
                {user?.sex ?? 'Not set'}
              </Text>
            </View>
          </View>
        </View>

        <View className="mt-3.5 flex-row items-center justify-center gap-[7px] self-stretch">
          <Ionicons name="phone-portrait-outline" size={16} color="#64748B" />
          <Text className="text-xs font-extrabold text-slate-500">
            Saved on this device for offline viewing
          </Text>
        </View>
      </View>

      <View className="p-4 pb-7">
        <Pressable
          accessibilityLabel="Logout"
          accessibilityRole="button"
          onPress={handleLogout}
          className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-2xl bg-red-600"
          style={({ pressed }) => pressed && { opacity: 0.78 }}>
          <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
          <Text className="text-base font-black text-white">Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
