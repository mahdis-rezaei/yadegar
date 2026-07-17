import { Pressable, ScrollView, View } from "react-native";
import { Text } from "../../components/text";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// The Yadegar philosophy — the values behind the product, in its own voice.
// A calm reading page; mirrors the web /philosophy.
const TENETS: { title: string; body: string }[] = [
  {
    title: "Your words belong to you.",
    body: "Everything you write is yours. We encrypt your pages, never sell them, never train on them, never show them to anyone. You can export everything, more easily than you imported it, or delete it entirely, at any time. Leaving is always easy; that's how you know it's safe to stay.",
  },
  {
    title: "Memory is not productivity.",
    body: 'There are no streaks here. No badges, no "days active," no guilt for the weeks you didn\'t write. A life isn\'t measured in consistency. The only number we keep is the one that accumulates: the pages you\'ve kept, across the years of your life.',
  },
  {
    title: "Reflection matters more than optimization.",
    body: "Yadegar will not coach you, rate you, or tell you how to be better. It keeps your pages, and every so often brings one back, a thread, a forgotten page, a distance traveled, always pointing to your own words.",
  },
  {
    title: "AI never interprets your life.",
    body: "A model helps decide which of your own words to bring back, and it stays quiet when nothing honest surfaces. It never diagnoses you, never summarizes who you are, never explains what your life means. That is yours to know.",
  },
  {
    title: "The page has not changed. You have.",
    body: "That is the quiet magic of returning to old journals. The words stayed exactly where you left them; the person reading them grew. Yadegar exists to keep you in conversation with who you were, and who you're becoming.",
  },
];

export default function Philosophy() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: 24,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 56,
      }}
    >
      <Text className="text-xs uppercase tracking-widest text-faint-ink mb-4">
        What we believe
      </Text>
      <Text className="text-5xl text-deep-brown leading-tight">
        The Yadegar philosophy
      </Text>

      <View className="mt-12 gap-12">
        {TENETS.map((t) => (
          <View key={t.title}>
            <Text className="text-2xl text-deep-brown leading-snug mb-3">
              {t.title}
            </Text>
            <Text className="text-lg text-soft-ink leading-relaxed">{t.body}</Text>
          </View>
        ))}
      </View>

      <View className="h-px bg-border my-12" />

      <Text className="text-xl italic text-soft-ink leading-relaxed mb-8">
        Someone can switch journaling apps. But this is where your life lives.
      </Text>

      <Pressable
        onPress={() => router.push("/(app)/why")}
        className="self-start rounded-full bg-deep-brown px-7 py-3"
      >
        <Text className="text-background">Read why I built Yadegar →</Text>
      </Pressable>
    </ScrollView>
  );
}
