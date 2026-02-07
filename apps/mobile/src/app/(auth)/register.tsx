import { View, Text, Pressable } from "react-native";

export default function RegisterScreen() {
  return (
    <View className="flex-1 items-center justify-center p-8">
      <Text className="text-3xl font-bold mb-2">SocialHub</Text>
      <Text className="text-gray-500 mb-8">Create your account</Text>
      <Pressable className="w-full rounded-lg border border-gray-300 p-4 mb-3">
        <Text className="text-center">Sign up with Google</Text>
      </Pressable>
      <Pressable className="w-full rounded-lg border border-gray-300 p-4">
        <Text className="text-center">Sign up with GitHub</Text>
      </Pressable>
    </View>
  );
}
