import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Text } from "../../components/text";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  pasteImport,
  updateParsedEntry,
  confirmImport,
  fileImportAvailable,
  pickImportFileText,
  type ImportReview,
  type ParsedEntry,
} from "../../lib/import";
import { longDate } from "../../lib/extras";
import { KeyboardDone, KEYBOARD_DONE_ID } from "../../components/keyboard-done";

type Phase = "paste" | "review" | "done";

export default function Import() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("paste");
  const [raw, setRaw] = useState("");
  const [review, setReview] = useState<ImportReview | null>(null);
  const [entries, setEntries] = useState<ParsedEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  const includedCount = entries.filter((e) => e.include).length;

  async function chooseFile() {
    if (!fileImportAvailable()) {
      Alert.alert(
        "File import needs the latest build",
        "Choosing a file turns on once the app is rebuilt. You can paste your writing now.",
      );
      return;
    }
    const text = await pickImportFileText();
    if (text) setRaw(text);
  }

  async function find() {
    if (!raw.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await pasteImport(raw);
      setReview(r);
      setEntries(r.entries);
      setPhase("review");
    } catch {
      setError("Couldn't read that. Try pasting again.");
    } finally {
      setBusy(false);
    }
  }

  function toggle(entry: ParsedEntry) {
    if (!review) return;
    const next = !entry.include;
    setEntries((list) =>
      list.map((e) => (e.id === entry.id ? { ...e, include: next } : e)),
    );
    updateParsedEntry(review.id, entry.id, { include: next }).catch(() => {
      // revert on failure
      setEntries((list) =>
        list.map((e) => (e.id === entry.id ? { ...e, include: entry.include } : e)),
      );
    });
  }

  async function confirm() {
    if (!review || includedCount === 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await confirmImport(review.id);
      setImportedCount(res.importedCount);
      setPhase("done");
    } catch {
      setError("Couldn't finish the import. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: 14,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 48,
        }}
      >

        <Text className="text-4xl text-deep-brown">Import</Text>

        {phase === "paste" ? (
          <>
            <Text className="text-soft-ink mt-2 leading-relaxed">
              Paste past journaling — from notes, a doc, anywhere. Yadegar will
              split it into dated pages for you to review before anything is saved.
            </Text>
            <View className="mt-6 rounded-3xl border border-border bg-surface px-5 py-4">
              <TextInput
                value={raw}
                onChangeText={setRaw}
                multiline
                textAlignVertical="top"
                placeholder="Paste your writing here…"
                placeholderTextColor="#A59B8D"
                className="min-h-[260px] text-base leading-6 text-ink"
                inputAccessoryViewID={KEYBOARD_DONE_ID}
              />
            </View>
            <Pressable onPress={chooseFile} className="mt-3 self-start" hitSlop={6}>
              <Text className="text-accent-sepia" style={{ fontSize: 13 }}>
                …or choose a .txt / .md file →
              </Text>
            </Pressable>
            {error ? (
              <Text className="text-accent-sepia mt-3">{error}</Text>
            ) : null}
            <Pressable
              onPress={find}
              disabled={!raw.trim() || busy}
              style={{ opacity: !raw.trim() || busy ? 0.5 : 1 }}
              className="mt-5 items-center rounded-full bg-deep-brown py-4"
            >
              {busy ? (
                <ActivityIndicator color="#F7F1E6" />
              ) : (
                <Text className="text-background">Find entries</Text>
              )}
            </Pressable>
          </>
        ) : phase === "review" ? (
          <>
            <Text className="text-soft-ink mt-2 leading-relaxed">
              Found {entries.length} {entries.length === 1 ? "page" : "pages"}.
              Untick any you don't want, then import.
            </Text>

            <View className="mt-6 gap-3">
              {entries.map((e) => (
                <Pressable
                  key={e.id}
                  onPress={() => toggle(e)}
                  className="flex-row gap-3 rounded-3xl border border-border bg-surface p-4"
                >
                  <View
                    className={
                      "mt-0.5 h-5 w-5 items-center justify-center rounded-md border " +
                      (e.include
                        ? "bg-deep-brown border-deep-brown"
                        : "border-border bg-background")
                    }
                  >
                    {e.include ? (
                      <Text className="text-background" style={{ fontSize: 12 }}>
                        ✓
                      </Text>
                    ) : null}
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-faint-ink">
                      {e.detectedDate ? longDate(e.detectedDate) : "No date detected"}
                      {e.dateConfidence === "low" || e.dateConfidence === "unknown"
                        ? " · guessed"
                        : ""}
                    </Text>
                    <Text
                      className="text-ink mt-1 leading-6"
                      numberOfLines={3}
                    >
                      {e.body.replace(/\s+/g, " ").trim()}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>

            {error ? (
              <Text className="text-accent-sepia mt-3">{error}</Text>
            ) : null}
            <Pressable
              onPress={confirm}
              disabled={includedCount === 0 || busy}
              style={{ opacity: includedCount === 0 || busy ? 0.5 : 1 }}
              className="mt-6 items-center rounded-full bg-deep-brown py-4"
            >
              {busy ? (
                <ActivityIndicator color="#F7F1E6" />
              ) : (
                <Text className="text-background">
                  Import {includedCount} {includedCount === 1 ? "page" : "pages"}
                </Text>
              )}
            </Pressable>
          </>
        ) : (
          <View className="mt-10 items-center">
            <Text className="text-2xl text-deep-brown text-center">
              Imported {importedCount} {importedCount === 1 ? "page" : "pages"}.
            </Text>
            <Text className="text-soft-ink mt-2 text-center leading-relaxed">
              They're in your Library now — and Yadegar can read across them.
            </Text>
            <Pressable
              onPress={() => router.replace("/(app)/library")}
              className="mt-8 rounded-full bg-deep-brown px-6 py-3"
            >
              <Text className="text-background">Go to Library</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      <KeyboardDone />
    </KeyboardAvoidingView>
  );
}
