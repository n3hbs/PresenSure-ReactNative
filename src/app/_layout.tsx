import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@/app/providers/app-providers";
import { useAppTheme } from "@/app/providers/theme-provider";
import "../global.css";

function RootNavigator() {
  const theme = useAppTheme();

  return (
    <>
      <StatusBar style={theme.statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(enrollment)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="device-registration" />
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
    </>
  );
}

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
