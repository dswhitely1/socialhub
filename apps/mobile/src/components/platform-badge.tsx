import { View, Text } from "react-native";
import { PLATFORM_DISPLAY_NAMES } from "@socialhub/shared";
import type { Platform } from "@socialhub/shared";

interface PlatformBadgeProps {
  platform: Platform;
}

export function PlatformBadge({ platform }: PlatformBadgeProps) {
  return (
    <View className="rounded-full bg-gray-100 px-3 py-1">
      <Text className="text-xs font-medium text-gray-700">
        {PLATFORM_DISPLAY_NAMES[platform]}
      </Text>
    </View>
  );
}
