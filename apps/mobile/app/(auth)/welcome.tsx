import { useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../components/text";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// The pre-login landing — an editorial scroll that lets someone feel Yadegar
// before signing in. Mirrors the web landing, MINUS the pricing/membership
// section (App Store rules: no external subscription prices or web checkout in
// the app; membership arrives via in-app purchase). "Free to start" is fine.

const STEPS = [
  { n: "01", t: "Write", d: "Write today's page, or bring in years of old ones. It doesn't need to be wise, only honest." },
  { n: "02", t: "Keep", d: "Your pages are kept private and encrypted, sorted by date and by year. Yours alone." },
  { n: "03", t: "Return", d: "When you ask, Yadegar reads across your years and places one page back in front of you, or stays quiet when nothing honest surfaces." },
  { n: "04", t: "Reflect", d: "Write back to the person who wrote it. Letters across time, kept side by side." },
];

// Fictional, illustrative example returns (never a real user's words).
const TONES = {
  sepia: { backgroundColor: "rgba(138,111,77,0.13)", color: "#8A6F4D" },
  sage: { backgroundColor: "rgba(120,134,102,0.16)", color: "#5e6a4d" },
  blush: { backgroundColor: "rgba(185,138,120,0.16)", color: "#9c6a58" },
} as const;

const RETURNS: { tag: string; tone: keyof typeof TONES; date: string; quote: string; note: string }[] = [
  {
    tag: "a forgotten page",
    tone: "sepia",
    date: "March 2017",
    quote: "Couldn't sleep, so I sat on the fire escape and watched the city not need me at all. It was strangely kind.",
    note: "A page you'd forgotten you wrote.",
  },
  {
    tag: "what kept returning",
    tone: "sage",
    date: "2014 to 2024",
    quote: "One more week, then I'll really begin.",
    note: "The same gentle promise, made to yourself for ten years.",
  },
  {
    tag: "something you knew",
    tone: "blush",
    date: "August 2016",
    quote: "Ready was never going to be a feeling. It's a door you walk through scared.",
    note: "A line you wrote years ago that still holds.",
  },
];


function Eyebrow({ children }: { children: string }) {
  return (
    <Text className="text-xs uppercase tracking-widest text-faint-ink text-center mb-5">
      {children}
    </Text>
  );
}

function DemoCard({ r }: { r: (typeof RETURNS)[number] }) {
  return (
    <View className="rounded-3xl border border-border bg-surface p-5">
      <View className="flex-row items-center justify-between mb-3">
        <View
          style={{ backgroundColor: TONES[r.tone].backgroundColor }}
          className="rounded-full px-3 py-1"
        >
          <Text
            style={{ color: TONES[r.tone].color, fontSize: 11 }}
            className="uppercase tracking-wider"
          >
            {r.tag}
          </Text>
        </View>
        <Text className="text-faint-ink text-xs">{r.date}</Text>
      </View>
      <Text className="text-lg italic text-deep-brown leading-snug mb-3">
        “{r.quote}”
      </Text>
      <Text className="text-soft-ink text-sm leading-relaxed">{r.note}</Text>
    </View>
  );
}

// Try-it-yourself demo: tap "Bring a page back" to reveal a (fictional) returned
// page, then rotate through more — the same interaction logged-out users get on
// the web, so they can feel Yadegar before signing in.
function ReturnDemo({ onCreate }: { onCreate: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const [i, setI] = useState(0);

  if (!revealed) {
    return (
      <View className="items-center">
        <Pressable
          onPress={() => setRevealed(true)}
          className="rounded-full border border-accent-sepia/40 bg-surface px-6 py-3"
        >
          <Text className="text-ink">✦ Bring a page back</Text>
        </Pressable>
        <Text className="text-faint-ink text-xs mt-3">
          a glimpse of what Yadegar returns
        </Text>
      </View>
    );
  }

  return (
    <View>
      <DemoCard r={RETURNS[i % RETURNS.length]} />
      <View className="flex-row items-center justify-center gap-6 mt-5">
        <Pressable onPress={() => setI((n) => n + 1)}>
          <Text className="text-soft-ink" style={{ fontSize: 13 }}>
            Show me another →
          </Text>
        </Pressable>
        <Pressable onPress={onCreate}>
          <Text className="text-accent-sepia" style={{ fontSize: 13 }}>
            Read across your own years
          </Text>
        </Pressable>
      </View>
      <Text className="text-faint-ink text-xs text-center mt-4">
        These are examples. With your own journals, every page is yours.
      </Text>
    </View>
  );
}

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const createAccount = () => router.push("/(auth)/sign-in?mode=up");
  const signIn = () => router.push("/(auth)/sign-in?mode=in");

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 40,
      }}
    >
      {/* Top nav */}
      <View className="flex-row items-center px-6 py-2">
        <Text className="text-xl text-deep-brown">
          Yadegar <Text className="text-soft-ink text-sm">یادگار</Text>
        </Text>
      </View>

      {/* Hero */}
      <View className="items-center px-6 mt-12">
        <Text className="text-3xl text-soft-ink" style={{ writingDirection: "rtl" }}>
          یادگار
        </Text>
        <Text
          className="text-7xl text-deep-brown mt-1"
          style={{ fontFamily: "Fraunces-SemiBold" }}
        >
          Yadegar
        </Text>
        <Text className="text-sm italic text-accent-sepia mt-2 text-center">
          Persian: a keepsake, the thing that remains
        </Text>
        <Text className="text-lg text-soft-ink leading-relaxed mt-6 text-center">
          A companion to a lifelong journaling practice. It reads across your
          years and brings back one page worth returning to, in your own words.
        </Text>
        <View className="flex-row gap-3 mt-8">
          <Pressable
            onPress={signIn}
            className="rounded-full border border-border bg-surface px-7 py-3"
          >
            <Text className="text-ink" style={{ fontSize: 13 }}>Sign in</Text>
          </Pressable>
          <Pressable onPress={createAccount} className="rounded-full bg-deep-brown px-7 py-3">
            <Text className="text-background" style={{ fontSize: 13 }}>Create account</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => router.push("/(auth)/why")}
          className="mt-4"
          hitSlop={6}
        >
          <Text className="text-soft-ink" style={{ fontSize: 13 }}>
            Why I built this →
          </Text>
        </Pressable>
      </View>

      {/* What comes back */}
      <View className="px-6 pt-24 pb-16">
        <Eyebrow>What comes back</Eyebrow>
        <Text className="text-3xl text-deep-brown text-center leading-tight mb-8">
          Not a summary of your life. One page, returned at the moment it's true
          again.
        </Text>
        <ReturnDemo onCreate={createAccount} />
      </View>

      {/* How it works */}
      <View className="px-6 py-12">
        <Eyebrow>How it works</Eyebrow>
        <View>
          {STEPS.map((s, i) => (
            <View
              key={s.n}
              className={"flex-row gap-5 py-6 " + (i > 0 ? "border-t border-border/70" : "")}
            >
              <Text className="text-2xl text-faint-ink" style={{ width: 36 }}>{s.n}</Text>
              <View className="flex-1">
                <Text className="text-2xl text-deep-brown mb-1.5">{s.t}</Text>
                <Text className="text-soft-ink leading-relaxed">{s.d}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* The word */}
      <View className="px-6 py-16 items-center">
        <Eyebrow>The word</Eyebrow>
        <Text className="text-7xl text-deep-brown mb-3" style={{ writingDirection: "rtl" }}>
          یادگار
        </Text>
        <Text className="text-soft-ink italic mb-1">yadegar · Persian, noun</Text>
        <Text className="text-faint-ink text-sm mb-6">
          said <Text className="text-soft-ink">yaa-deh-gar</Text>
        </Text>
        <Text className="text-lg text-soft-ink leading-relaxed text-center mb-4">
          A keepsake. A memento. The trace a person, or a time, leaves behind. The
          thing that remains.
        </Text>
        <Text className="text-soft-ink leading-relaxed text-center">
          Some journals are lost in moves. Some are thrown away by mistake. But the
          pages that remain can still speak.
        </Text>
      </View>

      {/* A note from the maker */}
      <View className="px-6 py-12 items-center">
        <Eyebrow>A note from the maker</Eyebrow>
        <Text className="text-2xl italic text-deep-brown leading-snug text-center mb-5">
          “I didn't know it then, but I was building a conversation with myself. One
          that would last decades.”
        </Text>
        <Text className="text-soft-ink leading-relaxed text-center mb-6">
          I've kept a journal through every version of myself, and lost some of them
          along the way. Yadegar is for the pages that remain.
        </Text>
        <Pressable onPress={() => router.push("/(auth)/why")}>
          <Text className="text-accent-sepia">Read the full story →</Text>
        </Pressable>
      </View>

      {/* Final CTA */}
      <View className="px-6 pt-12 pb-8 items-center">
        <Text className="text-4xl text-deep-brown text-center mb-4">
          Meet the person you used to be.
        </Text>
        <Text className="text-soft-ink text-center leading-relaxed mb-8">
          Free to start, membership when you're ready. Private by default,
          encrypted, and always in your own words.
        </Text>
        <View className="flex-row gap-3">
          <Pressable onPress={createAccount} className="rounded-full bg-deep-brown px-7 py-3">
            <Text className="text-background" style={{ fontSize: 13 }}>Create account</Text>
          </Pressable>
          <Pressable onPress={signIn} className="rounded-full border border-border bg-surface px-7 py-3">
            <Text className="text-ink" style={{ fontSize: 13 }}>Sign in</Text>
          </Pressable>
        </View>
      </View>

      {/* Footer */}
      <View className="px-6 pt-6 items-center gap-2">
        <Text className="text-soft-ink italic text-sm text-center">
          Offer the meaning, never push the moment.
        </Text>
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.push("/(auth)/why")}>
            <Text className="text-faint-ink text-xs">Why Yadegar</Text>
          </Pressable>
          <Text className="text-faint-ink text-xs">·</Text>
          <Pressable onPress={() => void Linking.openURL("https://yadegarjournal.com/privacy-policy")}>
            <Text className="text-faint-ink text-xs">Privacy</Text>
          </Pressable>
          <Text className="text-faint-ink text-xs">·</Text>
          <Pressable onPress={() => void Linking.openURL("https://yadegarjournal.com/terms")}>
            <Text className="text-faint-ink text-xs">Terms</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
