import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Feed" }}
      />
      <Tabs.Screen
        name="notifications"
        options={{ title: "Notifications" }}
      />
      <Tabs.Screen
        name="platforms"
        options={{ title: "Platforms" }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings" }}
      />
    </Tabs>
  );
}
