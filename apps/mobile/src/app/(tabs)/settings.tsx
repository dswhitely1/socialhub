import { View, Text } from "react-native";

export default function SettingsScreen() {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-2xl font-bold">Settings</Text>
      <Text className="text-gray-500 mt-2">
        Manage your account settings here.
      </Text>
    </View>
  );
}
