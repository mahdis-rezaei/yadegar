import { Pressable } from "react-native";
import { Text } from "./text";
import { useRouter } from "expo-router";

// The "← Settings" link at the top of each settings sub-page (mirrors the web).
export function BackToSettings() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate("/(app)/settings")}
      hitSlop={8}
      className="mb-3 self-start"
    >
      <Text className="text-soft-ink" style={{ fontSize: 14 }}>
        ← Settings
      </Text>
    </Pressable>
  );
}
