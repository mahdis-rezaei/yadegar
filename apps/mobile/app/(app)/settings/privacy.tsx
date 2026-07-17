import { useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  View,
} from "react-native";
import { Text } from "../../../components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../lib/auth";
import {
  fetchExport,
  deleteAccount,
  type ExportFormat,
  type ExportScope,
} from "../../../lib/settings";
import { BackToSettings } from "../../../components/settings-back";

const DATA: { title: string; body: string }[] = [
  {
    title: "Your identity",
    body: "Your display name, email, and avatar (a colour or a small photo) are stored in a Postgres database. You sign in with email + password or Google.",
  },
  {
    title: "Your pages",
    body: "Every entry, its words, formatting, and date, is encrypted at rest (AES-256-GCM) before it touches the database. The API only ever returns your pages to you, signed in; there is no public endpoint, so they're never reachable without your session.",
  },
  {
    title: "Your photos",
    body: "Photos you add to a page are encrypted and kept in private object storage, never on a public CDN. The app fetches each one server-side with a private key and decrypts it only for you.",
  },
  {
    title: "Reminders",
    body: "If you turn on nudges, only your timezone and cadence are stored, never the content of a page, to time them.",
  },
];

const SCOPE_LABELS: Record<ExportScope, string> = {
  all: "Everything",
  favorites: "Favorites",
};

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs uppercase tracking-widest text-faint-ink mb-3">
      {children}
    </Text>
  );
}

// Your data → Privacy & your pages: the privacy promise, exactly what's stored,
// portable exports, and account deletion. Mirrors the web.
export default function Privacy() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const [scope, setScope] = useState<ExportScope>("all");
  const [busy, setBusy] = useState(false);

  function pickScope() {
    const opts: ExportScope[] = ["all", "favorites"];
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: "Include", options: [...opts.map((o) => SCOPE_LABELS[o]), "Cancel"], cancelButtonIndex: opts.length },
        (i) => {
          if (i != null && i < opts.length) setScope(opts[i]);
        },
      );
    } else {
      Alert.alert("Include", undefined, [
        ...opts.map((o) => ({ text: SCOPE_LABELS[o], onPress: () => setScope(o) })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  }

  async function doExport(format: ExportFormat) {
    setBusy(true);
    try {
      const text = await fetchExport(format, scope);
      await Share.share({ message: text });
    } catch {
      Alert.alert("Export failed", "Couldn't prepare your export. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  function onDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently erases all your pages, reflections, and returns. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
              await signOut();
            } catch {
              setBusy(false);
              Alert.alert("Couldn't delete", "Something went wrong. Please try again.");
            }
          },
        },
      ],
    );
  }

  const formats: { format: ExportFormat; label: string }[] = [
    { format: "markdown", label: "Markdown" },
    { format: "text", label: "Plain text" },
    { format: "json", label: "JSON (complete archive)" },
  ];

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{
        paddingTop: 14,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 48,
      }}
    >
      <BackToSettings />
      <Text className="text-4xl text-deep-brown leading-tight">
        Your pages belong to you.
      </Text>

      <View className="mt-5 gap-4">
        <Text className="text-soft-ink leading-relaxed">
          Yadegar keeps your journals so you can write, return, and reflect across
          time. They are private to your account.
        </Text>
        <Text className="text-soft-ink leading-relaxed">
          To find what's worth returning to, Yadegar reads your words with an AI
          model, privately, only to choose a page to bring back. Your writing is
          never used to train it, never shown to anyone else, and never sold.
        </Text>
        <Text className="text-soft-ink leading-relaxed">
          You can take everything with you, or remove it entirely, whenever you
          like.
        </Text>
      </View>

      {/* About your data. */}
      <View className="mt-8 rounded-3xl border border-border bg-surface p-5">
        <SectionLabel>About your data</SectionLabel>
        <Text className="text-soft-ink leading-relaxed mb-4">
          Here is exactly what Yadegar stores, where, and how it's kept private:
        </Text>
        <View className="gap-5">
          {DATA.map((d) => (
            <View key={d.title}>
              <Text className="text-ink">{d.title}</Text>
              <Text className="text-soft-ink text-sm mt-1 leading-relaxed">
                {d.body}
              </Text>
            </View>
          ))}
        </View>
        <Text className="text-faint-ink text-sm mt-5 leading-relaxed">
          Your pages are never shared with third parties or used to train anyone's
          models. Deleting your account permanently removes everything, your
          profile, all pages, and any photos, immediately and irreversibly.
        </Text>
      </View>

      <Text className="text-soft-ink mt-4 leading-relaxed">
        Read our{" "}
        <Text
          className="text-deep-brown"
          onPress={() => void Linking.openURL("https://yadegarjournal.com/privacy-policy")}
        >
          Privacy Policy
        </Text>{" "}
        and{" "}
        <Text
          className="text-deep-brown"
          onPress={() => void Linking.openURL("https://yadegarjournal.com/terms")}
        >
          Terms
        </Text>
        .
      </Text>

      {/* Export. */}
      <View className="mt-10">
        <Text className="text-2xl text-deep-brown">Export my journals</Text>
        <Text className="text-soft-ink mt-1 leading-relaxed">
          Your journals belong to you — leaving is easier than arriving. Take them
          in any format, anytime.
        </Text>

        <View className="mt-5 flex-row items-center gap-2">
          <Text className="text-faint-ink" style={{ fontSize: 13 }}>Include</Text>
          <Pressable onPress={pickScope} className="border-b border-border">
            <Text className="text-ink" style={{ fontSize: 13 }}>
              {SCOPE_LABELS[scope]} ⌄
            </Text>
          </Pressable>
          <Text className="text-faint-ink" style={{ fontSize: 12 }}>
            (applies to Markdown & text)
          </Text>
        </View>

        <View className="mt-4 gap-2">
          {formats.map((f) => (
            <Pressable
              key={f.format}
              onPress={() => void doExport(f.format)}
              disabled={busy}
              className="items-center rounded-full border border-border bg-surface py-3"
            >
              <Text className="text-ink" style={{ fontSize: 14 }}>{f.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text className="text-faint-ink text-sm mt-3 leading-relaxed">
          Markdown & text include your pages and the reflections beneath them. JSON
          is the complete archive.
        </Text>
      </View>

      {/* Delete. */}
      <View className="mt-10 pt-6 border-t border-border/50">
        <Pressable onPress={onDelete} disabled={busy}>
          <Text style={{ color: "#B4453A" }}>Delete my account</Text>
          <Text className="text-faint-ink text-sm mt-1 leading-relaxed">
            Removes everything, permanently.
          </Text>
        </Pressable>
      </View>

      {busy ? (
        <View className="mt-6 items-center">
          <ActivityIndicator color="#3A2F25" />
        </View>
      ) : null}
    </ScrollView>
  );
}
