import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AuthProvider } from "@/context/auth-context";
import "../global.css";

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="schedule-detail"
          options={{
            animation: "fade",
            presentation: "card",
          }}
        />
        <Stack.Screen
          name="profile"
          options={{
            animation: "slide_from_right",
            presentation: "card",
          }}
        />
      </Stack>
    </AuthProvider>
  );
}
