import { Stack } from "expo-router";
import { AppProvider } from "../providers/app-provider";
import "../global.css";

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
      </Stack>
    </AppProvider>
  );
}
