import { View, Text } from "react-native";

export default function NotificationsScreen() {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-2xl font-bold">Notifications</Text>
      <Text className="text-gray-500 mt-2">
        Your notifications will appear here.
      </Text>
    </View>
  );
}
