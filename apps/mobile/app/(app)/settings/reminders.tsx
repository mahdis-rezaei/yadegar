import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { Text } from "../../../components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getNotifications,
  updateNotifications,
  type NudgeFreq,
} from "../../../lib/settings";
import { Segmented } from "../../../components/segmented";
import { BackToSettings } from "../../../components/settings-back";

// Nudges → Reminders: cadence for the write nudge and the page-brought-back
// nudge. Off by default; optimistic save.
const FREQ: { value: NudgeFreq; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export default function Reminders() {
  const insets = useSafeAreaInsets();
  const [writing, setWriting] = useState<NudgeFreq>("off");
  const [memory, setMemory] = useState<NudgeFreq>("off");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const n = await getNotifications();
        if (cancelled) return;
        setWriting(n.writingFrequency);
        setMemory(n.memoryFrequency);
      } catch {
        // defaults stand; controls still persist on change
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function setWritingFreq(v: NudgeFreq) {
    const prev = writing;
    setWriting(v);
    updateNotifications({ writingFrequency: v }).catch(() => setWriting(prev));
  }
  function setMemoryFreq(v: NudgeFreq) {
    const prev = memory;
    setMemory(v);
    updateNotifications({ memoryFrequency: v }).catch(() => setMemory(prev));
  }

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
      <Text className="text-4xl text-deep-brown">Nudges</Text>
      <Text className="text-soft-ink mt-2 leading-relaxed">
        Gentle, never guilt. No streaks, no "you missed a day." Just a quiet note
        now and then, and only when there's something honest to send. Both are off
        unless you turn them on.
      </Text>

      {loading ? (
        <View className="min-h-60 items-center justify-center">
          <ActivityIndicator color="#3A2F25" />
        </View>
      ) : (
        <View className="mt-10 gap-10">
          <View>
            <Text className="text-lg text-ink mb-1">A nudge to write</Text>
            <Text className="text-soft-ink text-sm mb-4 leading-relaxed">
              "What wants to be written today?", a small invitation, by email.
            </Text>
            <Segmented value={writing} options={FREQ} onChange={setWritingFreq} />
          </View>
          <View>
            <Text className="text-lg text-ink mb-1">A page brought back</Text>
            <Text className="text-soft-ink text-sm mb-4 leading-relaxed">
              Yadegar reads across your years and emails you one page worth
              returning to, or stays quiet when nothing honest surfaces.
            </Text>
            <Segmented value={memory} options={FREQ} onChange={setMemoryFreq} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}
