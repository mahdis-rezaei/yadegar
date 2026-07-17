import { useEffect, useState } from "react";
import {
  View,
  Pressable,
  Modal,
  ScrollView,
  Linking,
  Keyboard,
} from "react-native";
import { Text } from "./text";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../lib/auth";
import { Avatar } from "./avatar";

// The fixed top bar, rendered as the navigator header on every signed-in screen:
// a back arrow (when there's somewhere to go back to) + the Yadegar wordmark on
// the left, and a ☰ on the right that opens the FULL menu — mirroring the web's
// nav (Today · Look back · Returns · Explore items · Shop · account). Pure JS
// (RN Modal) — no native drawer dependency.

type Item = { label: string; to?: string; action?: () => void };

export function AppHeader() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [kbVisible, setKbVisible] = useState(false);
  const canBack = router.canGoBack();

  // When the keyboard is up, the header's ☰ becomes a "Done" — always reachable
  // at the top, never fighting the keyboard. Works on every screen (incl. search).
  useEffect(() => {
    const show = Keyboard.addListener("keyboardWillShow", () => setKbVisible(true));
    const hide = Keyboard.addListener("keyboardWillHide", () => setKbVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  function go(to: string) {
    setOpen(false);
    router.push(to as never);
  }

  const sections: { title?: string; items: Item[] }[] = [
    {
      items: [
        { label: "Today", to: "/(app)/today" },
        { label: "Look back", to: "/(app)/look-back" },
        { label: "Explore", to: "/(app)/explore" },
        {
          label: "Shop",
          action: () => {
            setOpen(false);
            void Linking.openURL("https://yadegarjournal.com/shop");
          },
        },
      ],
    },
    {
      items: [
        { label: "Settings", to: "/(app)/settings" },
        { label: "My profile", to: "/(app)/settings/profile" },
        { label: "Membership", to: "/(app)/membership" },
        { label: "Help & FAQ", to: "/(app)/help" },
        { label: "About Yadegar", to: "/(app)/why" },
        {
          label: "Sign out",
          action: () => {
            setOpen(false);
            void signOut();
          },
        },
      ],
    },
  ];

  return (
    <View
      style={{ paddingTop: insets.top }}
      className="bg-background border-b border-border/60"
    >
      <View className="flex-row items-center justify-between px-5 py-2.5">
        <View className="flex-row items-center gap-2">
          {canBack ? (
            <Pressable onPress={() => router.back()} hitSlop={10}>
              <Text className="text-soft-ink text-2xl">‹</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => go("/(app)/today")} hitSlop={8}>
            <Text className="text-xl text-deep-brown">
              Yadegar <Text className="text-soft-ink text-sm">یادگار</Text>
            </Text>
          </Pressable>
        </View>
        {kbVisible ? (
          <Pressable
            onPress={() => Keyboard.dismiss()}
            hitSlop={10}
            className="rounded-full border border-border bg-surface px-4 py-1.5"
          >
            <Text className="text-deep-brown text-base" style={{ fontWeight: "600" }}>
              Done
            </Text>
          </Pressable>
        ) : (
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => setOpen(true)} hitSlop={8}>
              <Avatar user={user} size={28} />
            </Pressable>
            <Pressable
              onPress={() => setOpen(true)}
              hitSlop={10}
              className="rounded-full border border-border bg-surface px-3 py-1.5"
            >
              <Text className="text-deep-brown text-lg">☰</Text>
            </Pressable>
          </View>
        )}
      </View>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
          <View className="flex-row items-center justify-between px-6 py-4">
            <Text className="text-2xl text-deep-brown">
              Yadegar <Text className="text-soft-ink text-base">یادگار</Text>
            </Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Text className="text-soft-ink text-lg">✕</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 24,
              paddingBottom: insets.bottom + 32,
            }}
          >
            {sections.map((s, i) => (
              <View key={i} className="mt-6">
                {s.title ? (
                  <Text className="text-xs uppercase tracking-widest text-faint-ink mb-2">
                    {s.title}
                  </Text>
                ) : null}
                {s.items.map((it) => (
                  <Pressable
                    key={it.label}
                    onPress={() => (it.to ? go(it.to) : it.action?.())}
                    className="py-3 border-b border-border/50"
                  >
                    <Text className="text-xl text-deep-brown">{it.label}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
