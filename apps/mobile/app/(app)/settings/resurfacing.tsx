import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Text } from "../../../components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getPreferences,
  updatePreferences,
  listMutes,
  addMute,
  deleteMute,
  type MemorySensitivity,
  type ResurfaceMute,
} from "../../../lib/settings";
import { BackToSettings } from "../../../components/settings-back";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const OPTIONS: { value: MemorySensitivity; label: string; desc: string }[] = [
  {
    value: "open",
    label: "Open",
    desc: 'Yadegar may bring a page back on its own, a gentle nudge, and "on this day" pages when you visit.',
  },
  {
    value: "gentle",
    label: "Gentle",
    desc: "No memory nudges. Pages still appear quietly in the app when you're here, but Yadegar won't reach out.",
  },
  {
    value: "protected",
    label: "Protected",
    desc: 'Nothing returns unbidden. Pages come back only when you go looking. Look back, Calendar, Search, or "Bring a page back."',
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs uppercase tracking-widest text-faint-ink mb-3">
      {children}
    </Text>
  );
}

// What returns: how freely memories resurface (radio cards), the safety note,
// and muted periods (date ranges that never resurface). Mirrors the web.
export default function Resurfacing() {
  const insets = useSafeAreaInsets();
  const [sensitivity, setSensitivity] = useState<MemorySensitivity>("open");
  const [mutes, setMutes] = useState<ResurfaceMute[]>([]);
  const [muteStart, setMuteStart] = useState("");
  const [muteEnd, setMuteEnd] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, m] = await Promise.all([
          getPreferences(),
          listMutes().catch(() => [] as ResurfaceMute[]),
        ]);
        if (cancelled) return;
        setSensitivity(p.memorySensitivity);
        setMutes(m);
      } catch {
        // defaults stand
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setSens(v: MemorySensitivity) {
    const prev = sensitivity;
    setSensitivity(v);
    updatePreferences(v).catch(() => setSensitivity(prev));
  }

  async function onAddMute() {
    if (!ISO_DATE.test(muteStart) || !ISO_DATE.test(muteEnd)) {
      Alert.alert("Check the dates", "Use the format YYYY-MM-DD for both dates.");
      return;
    }
    if (muteStart > muteEnd) {
      Alert.alert("Check the dates", "The start date must be on or before the end date.");
      return;
    }
    try {
      const row = await addMute(muteStart, muteEnd);
      setMutes((list) => [row, ...list]);
      setMuteStart("");
      setMuteEnd("");
    } catch {
      Alert.alert("Couldn't mute that period", "Please try again in a moment.");
    }
  }

  function onRemoveMute(m: ResurfaceMute) {
    setMutes((list) => list.filter((x) => x.id !== m.id));
    void deleteMute(m.id).catch(() => setMutes((list) => [m, ...list]));
  }

  return (
    <ScrollView
      className="flex-1 bg-background"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingTop: 14,
        paddingHorizontal: 24,
        paddingBottom: insets.bottom + 48,
      }}
    >
      <BackToSettings />
      <Text className="text-4xl text-deep-brown">What returns</Text>
      <Text className="text-soft-ink mt-2 leading-relaxed">
        You decide what comes back. Some seasons are harder to revisit than
        others — these are yours to set.
      </Text>

      {loading ? (
        <View className="min-h-60 items-center justify-center">
          <ActivityIndicator color="#3A2F25" />
        </View>
      ) : (
        <>
          <View className="mt-8">
            <SectionLabel>How memories return</SectionLabel>
            <View className="gap-3">
              {OPTIONS.map((o) => {
                const sel = o.value === sensitivity;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => setSens(o.value)}
                    className={
                      "rounded-2xl border p-4 flex-row gap-3 " +
                      (sel ? "border-accent-sepia bg-surface" : "border-border bg-surface")
                    }
                  >
                    <View
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 9,
                        borderWidth: 1.5,
                        borderColor: sel ? "#8A6F4D" : "#CBBBA0",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 2,
                      }}
                    >
                      {sel ? (
                        <View
                          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#8A6F4D" }}
                        />
                      ) : null}
                    </View>
                    <View className="flex-1">
                      <Text className="text-lg text-ink">{o.label}</Text>
                      <Text className="text-soft-ink text-sm mt-1 leading-relaxed">
                        {o.desc}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            <Text className="text-faint-ink text-sm mt-4 leading-relaxed">
              Whatever you choose, body-image and active-crisis pages are never
              resurfaced, and muted periods below are always respected.
            </Text>
          </View>

          <View className="mt-10">
            <SectionLabel>Muted periods</SectionLabel>
            {mutes.length === 0 ? (
              <Text className="text-soft-ink leading-relaxed">
                Nothing is muted. Every eligible page can return.
              </Text>
            ) : (
              <View className="gap-2">
                {mutes.map((m) => (
                  <View
                    key={m.id}
                    className="flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3"
                  >
                    <Text className="text-ink">
                      {m.startDate} → {m.endDate}
                    </Text>
                    <Pressable onPress={() => onRemoveMute(m)} hitSlop={8}>
                      <Text className="text-faint-ink" style={{ fontSize: 13 }}>
                        Remove
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>

          <View className="mt-10">
            <SectionLabel>Mute a period</SectionLabel>
            <View className="gap-4">
              <View>
                <Text className="text-soft-ink mb-2">From</Text>
                <TextInput
                  value={muteStart}
                  onChangeText={setMuteStart}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#A59B8D"
                  autoCapitalize="none"
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-ink"
                />
              </View>
              <View>
                <Text className="text-soft-ink mb-2">To</Text>
                <TextInput
                  value={muteEnd}
                  onChangeText={setMuteEnd}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#A59B8D"
                  autoCapitalize="none"
                  className="rounded-xl border border-border bg-surface px-4 py-3 text-ink"
                />
              </View>
              <Pressable
                onPress={onAddMute}
                className="items-center rounded-full bg-deep-brown py-3.5"
              >
                <Text className="text-background">Mute this period</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}
