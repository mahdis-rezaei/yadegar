import { Pressable, View } from "react-native";
import { Text } from "../../components/text";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WhyNote } from "../../components/why-note";

// Signed-out "why I built this" — the native maker's note, pushed over Welcome.
// The (auth) stack hides its header, so we add our own back affordance.
export default function WhyAuth() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <View style={{ paddingTop: insets.top + 6 }} className="px-4 pb-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          className="self-start px-2 py-1"
          accessibilityLabel="Back"
        >
          <Text className="text-3xl text-deep-brown">‹</Text>
        </Pressable>
      </View>
      <WhyNote topInset={4} />
    </View>
  );
}
