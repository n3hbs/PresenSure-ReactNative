import { Stack, usePathname } from "expo-router";
import { StatusBar } from "react-native";

import { AppProviders } from "@/app/providers/app-providers";
import { useAppTheme } from "@/app/providers/theme-provider";
import "../global.css";

function RootNavigator() {
  const pathname = usePathname();
  const theme = useAppTheme();
  const hasBlueTopArea =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/profile";

  return (
    <>
      <StatusBar
        backgroundColor={hasBlueTopArea ? "#2563EB" : theme.colors.background}
        barStyle={theme.resolvedMode === "dark" ? "light-content" : "dark-content"}
      />
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
