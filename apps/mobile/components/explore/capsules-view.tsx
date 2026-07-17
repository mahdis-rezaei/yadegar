import { useCallback, useState } from "react";
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Text } from "../text";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  listCapsules,
  createCapsule,
  openCapsule,
  longDate,
  type Capsule,
} from "../../lib/extras";
import { KeyboardDone, KEYBOARD_DONE_ID } from "../keyboard-done";

// Memory Capsules: seal a letter to your future self; locked until its delivery
// date, then openable. Delivery is In 1/5/10 years or a chosen date (mirrors the
// web's Deliver dropdown). Used by the Explore tab and the standalone /capsules route.
// Native date wheel when the module is in the build; falls back to a typed field.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let DateTimePicker: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  DateTimePicker = require("@react-native-community/datetimepicker").default;
} catch {
  DateTimePicker = null;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRESETS = [1, 5, 10];

function isoYearsFromNow(years: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

export default function CapsulesView() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  // Delivery: a year preset, or a chosen date.
  const [mode, setMode] = useState<"years" | "date">("years");
  const [years, setYears] = useState(1);
  const [dateStr, setDateStr] = useState("");
  const [sealing, setSealing] = useState(false);

  const deliverLabel = mode === "date" ? "On a date…" : `In ${years} ${years === 1 ? "year" : "years"}`;

  function pickDeliver() {
    const options = [...PRESETS.map((y) => `In ${y} ${y === 1 ? "year" : "years"}`), "On a date…"];
    const choose = (i: number) => {
      if (i < PRESETS.length) {
        setMode("years");
        setYears(PRESETS[i]);
      } else {
        setMode("date");
      }
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { title: "Deliver", options: [...options, "Cancel"], cancelButtonIndex: options.length },
        (i) => {
          if (i != null && i < options.length) choose(i);
        },
      );
    } else {
      Alert.alert("Deliver", undefined, [
        ...options.map((label, i) => ({ text: label, onPress: () => choose(i) })),
        { text: "Cancel", style: "cancel" as const },
      ]);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listCapsules());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  async function seal() {
    if (!body.trim() || sealing) return;

    let deliverAt: string;
    if (mode === "years") {
      deliverAt = isoYearsFromNow(years);
    } else {
      if (!ISO_DATE.test(dateStr)) {
        Alert.alert("Pick a date", "Enter the delivery date as YYYY-MM-DD.");
        return;
      }
      const d = new Date(dateStr + "T12:00:00");
      if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
        Alert.alert("Choose a future date", "A capsule has to open sometime ahead.");
        return;
      }
      deliverAt = d.toISOString();
    }

    setSealing(true);
    try {
      const c = await createCapsule(body.trim(), deliverAt);
      setBody("");
      setItems((list) =>
        [c, ...list].sort((a, b) => a.deliverAt.localeCompare(b.deliverAt)),
      );
    } catch {
      // keep text for retry
    } finally {
      setSealing(false);
    }
  }

  async function open(c: Capsule) {
    try {
      const updated = await openCapsule(c.id);
      setItems((list) => list.map((x) => (x.id === c.id ? updated : x)));
    } catch {
      // ignore
    }
  }

  return (
    <>
      <ScrollView
        className="flex-1 bg-background"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: 16,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 48,
        }}
      >
        <Text className="text-4xl text-deep-brown">Send to your future self</Text>
        <Text className="text-soft-ink mt-1 leading-relaxed">
          Write a page and seal it for a later you. Once sealed, it can't be
          changed, a letter that waits.
        </Text>

        {/* compose */}
        <View className="mt-6 rounded-3xl border border-border bg-surface p-5 gap-4">
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Dear future me…"
            placeholderTextColor="#A59B8D"
            multiline
            textAlignVertical="top"
            inputAccessoryViewID={KEYBOARD_DONE_ID}
            className="min-h-[120px] text-base leading-6 text-ink"
          />
          <View>
            <Text className="text-faint-ink text-xs mb-2">Deliver</Text>
            <Pressable
              onPress={pickDeliver}
              className="flex-row items-center justify-between rounded-xl border border-border bg-background px-4 py-3"
            >
              <Text className="text-ink" style={{ fontSize: 14 }}>{deliverLabel}</Text>
              <Text className="text-faint-ink">⌄</Text>
            </Pressable>
            {mode === "date" ? (
              DateTimePicker ? (
                <View className="mt-2 self-start">
                  <DateTimePicker
                    value={dateStr ? new Date(dateStr + "T12:00:00") : new Date(Date.now() + 86400000)}
                    mode="date"
                    display="inline"
                    minimumDate={new Date(Date.now() + 86400000)}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    onChange={(_e: any, d?: Date) => {
                      if (d) setDateStr(d.toISOString().slice(0, 10));
                    }}
                  />
                </View>
              ) : (
                <TextInput
                  value={dateStr}
                  onChangeText={setDateStr}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#A59B8D"
                  autoCapitalize="none"
                  className="mt-2 rounded-xl border border-border bg-background px-4 py-3 text-ink"
                  style={{ fontSize: 14 }}
                />
              )
            ) : null}
          </View>
          <Pressable
            onPress={seal}
            disabled={!body.trim() || sealing}
            style={{ opacity: !body.trim() || sealing ? 0.5 : 1 }}
            className="items-center rounded-full bg-deep-brown py-3"
          >
            <Text className="text-background">{sealing ? "Sealing…" : "Seal it"}</Text>
          </Pressable>
        </View>

        {/* list */}
        {loading ? (
          <View className="min-h-60 items-center justify-center">
            <ActivityIndicator color="#3A2F25" />
          </View>
        ) : items.length === 0 ? null : (
          <View className="mt-8 gap-4">
            {items.map((c) => (
              <View key={c.id} className="rounded-3xl border border-border bg-surface p-5">
                {!c.delivered ? (
                  <>
                    <Text className="text-deep-brown text-lg">✉️ Sealed</Text>
                    <Text className="text-soft-ink mt-1">
                      Opens {longDate(c.deliverAt)}
                    </Text>
                  </>
                ) : c.body && c.openedAt ? (
                  <>
                    <Text className="text-faint-ink text-xs uppercase tracking-widest">
                      Delivered {longDate(c.deliverAt)}
                    </Text>
                    <Text className="text-ink mt-3 text-base leading-6">
                      {c.body}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text className="text-deep-brown text-lg">
                      A capsule has arrived.
                    </Text>
                    <Pressable
                      onPress={() => open(c)}
                      className="self-start mt-4 rounded-full bg-deep-brown px-5 py-2"
                    >
                      <Text className="text-background">Open it</Text>
                    </Pressable>
                  </>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <KeyboardDone />
    </>
  );
}
