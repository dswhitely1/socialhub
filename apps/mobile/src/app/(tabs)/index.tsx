import { View, Text } from "react-native";

export default function FeedScreen() {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="text-2xl font-bold">Feed</Text>
      <Text className="text-gray-500 mt-2">
        Your unified feed will appear here.
      </Text>
    </View>
  );
}
