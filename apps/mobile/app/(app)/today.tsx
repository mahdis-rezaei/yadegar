import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import { Text } from "../../components/text";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { bringPageBack } from "../../lib/memories";
import { useRun, RunResult } from "../../components/memory-run";
import { OnThisDay } from "../../components/on-this-day";
import { EntryPhotos } from "../../components/entry-photos";
import { MicButton } from "../../components/mic-button";
import { RichEditor, type RichEditorHandle } from "../../components/rich-editor";
import { htmlToPlain, plainToHtml } from "../../lib/html";

type JournalEntry = {
  id: string;
  body: string;
  // Rich-text layer (sanitized HTML) — the editor's content; the plain `body`
  // is derived from it server-side.
  bodyRich?: string | null;
  entryDate: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

type DraftEnvelope = {
  body: string;
  updatedAt: string;
};

type SaveStatus =
  | "loading"
  | "idle"
  | "draft"
  | "saving"
  | "saved"
  | "offline"
  | "error";

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function friendlyDate(date = new Date()): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function readDraft(key: string): Promise<DraftEnvelope | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<DraftEnvelope>;
    if (typeof parsed.body === "string" && typeof parsed.updatedAt === "string") {
      return { body: parsed.body, updatedAt: parsed.updatedAt };
    }
  } catch {
    // Older/dev drafts may be plain strings.
    return { body: raw, updatedAt: new Date(0).toISOString() };
  }

  return null;
}

async function writeDraft(key: string, body: string): Promise<void> {
  await AsyncStorage.setItem(
    key,
    JSON.stringify({
      body,
      updatedAt: new Date().toISOString(),
    } satisfies DraftEnvelope),
  );
}

function statusLabel(status: SaveStatus): string {
  switch (status) {
    case "loading":
      return "Loading…";
    case "draft":
      return "Draft saved on this phone";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "offline":
      return "Offline draft";
    case "error":
      return "Could not save";
    default:
      return "Start writing";
  }
}

export default function Today() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const entryDate = useMemo(() => localDateKey(), []);
  const today = useMemo(() => friendlyDate(), []);
  const draftKey = useMemo(
    () => `yadegar.today.${user?.email ?? "unknown"}.${entryDate}`,
    [entryDate, user?.email],
  );

  const [entryId, setEntryId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [lastSavedBody, setLastSavedBody] = useState("");
  const [status, setStatus] = useState<SaveStatus>("loading");

  const loadedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveSequenceRef = useRef(0);
  // `body` holds the editor's rich HTML; the server derives the plain body from it.
  const editorRef = useRef<RichEditorHandle>(null);

  // "Bring a page back" — the engine read, right here on Today (as on the web).
  const pageBack = useRun();

  useEffect(() => {
    let cancelled = false;

    async function loadToday() {
      loadedRef.current = false;
      setStatus("loading");

      const [year, month] = entryDate.split("-");

      try {
        const [draft, entries] = await Promise.all([
          readDraft(draftKey),
          api<JournalEntry[]>(`/entries?year=${year}&month=${Number(month)}`),
        ]);

        if (cancelled) return;

        const todayEntry =
          entries.find(
            (entry) => entry.entryDate === entryDate && entry.source === "manual",
          ) ?? null;

        // The editor works in HTML: use the saved rich layer, or wrap a plain
        // page's text into HTML so it opens cleanly in the editor.
        const serverHtml = todayEntry
          ? (todayEntry.bodyRich ?? plainToHtml(todayEntry.body))
          : "";
        const serverUpdatedAt = todayEntry?.updatedAt ?? new Date(0).toISOString();

        const draftIsNewer =
          draft &&
          draft.body !== serverHtml &&
          new Date(draft.updatedAt).getTime() > new Date(serverUpdatedAt).getTime();

        const initial = draftIsNewer ? draft.body : serverHtml;
        setEntryId(todayEntry?.id ?? null);
        setLastSavedBody(serverHtml);
        setBody(initial);
        editorRef.current?.setHtml(initial);

        if (draftIsNewer) setStatus("offline");
        else setStatus(htmlToPlain(serverHtml).trim() ? "saved" : "idle");
      } catch {
        const draft = await readDraft(draftKey);
        if (cancelled) return;

        const initial = draft?.body ?? "";
        setBody(initial);
        editorRef.current?.setHtml(initial);
        setLastSavedBody("");
        setStatus(htmlToPlain(initial).trim() ? "offline" : "idle");
      } finally {
        loadedRef.current = true;
      }
    }

    void loadToday();

    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [draftKey, entryDate]);

  useEffect(() => {
    if (!loadedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    void writeDraft(draftKey, body);

    const plain = htmlToPlain(body);

    if (body === lastSavedBody) {
      setStatus(plain.trim() ? "saved" : "idle");
      return;
    }

    if (!plain.trim()) {
      setStatus("draft");
      return;
    }

    setStatus("draft");

    saveTimerRef.current = setTimeout(() => {
      const sequence = saveSequenceRef.current + 1;
      saveSequenceRef.current = sequence;

      async function save() {
        setStatus("saving");

        // `body` is the editor's HTML. Send it as bodyRich (the server sanitizes
        // it and derives the canonical plain `body`); `plain` is just a fallback.
        const payload = { body: plain, bodyRich: body, entryDate };

        try {
          const saved = entryId
            ? await api<JournalEntry>(`/entries/${entryId}`, {
                method: "PATCH",
                body: payload,
              })
            : await api<JournalEntry>("/entries", {
                method: "POST",
                body: payload,
              });

          if (saveSequenceRef.current !== sequence) return;

          setEntryId(saved.id);
          // Keep the editor + local draft on the HTML we hold (saved.body is the
          // stripped plain version, which would lose the formatting).
          setLastSavedBody(body);
          await writeDraft(draftKey, body);
          setStatus("saved");
        } catch {
          if (saveSequenceRef.current !== sequence) return;
          setStatus("offline");
        }
      }

      void save();
    }, 1200);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [body, draftKey, entryDate, entryId, lastSavedBody]);

  // Save/create today's page on demand (so a photo always has a page to attach
  // to). Returns the entry id, or null if it couldn't be created.
  async function ensureEntry(): Promise<string | null> {
    if (entryId) return entryId;
    try {
      const plain = htmlToPlain(body);
      const saved = await api<JournalEntry>("/entries", {
        method: "POST",
        body: { body: plain || " ", bodyRich: body, entryDate },
      });
      setEntryId(saved.id);
      setLastSavedBody(body);
      return saved.id;
    } catch {
      return null;
    }
  }

  // Once today's page is saved with content, mirror the web's "kept" footer.
  const keptToday = !!entryId && htmlToPlain(body).trim().length > 0;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        contentContainerStyle={{
          paddingTop: 14,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 48,
        }}
      >
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <Text className="text-4xl text-deep-brown">Today</Text>
            <Text className="text-soft-ink mt-1">{today}</Text>
            <Pressable
              onPress={() => editorRef.current?.focus()}
              hitSlop={6}
              className="self-start mt-1"
            >
              <Text className="text-xs text-faint-ink">{statusLabel(status)}</Text>
            </Pressable>
          </View>

          {/* The engine read, right on Today (as on the web). */}
          <Pressable
            onPress={() => void pageBack.run(() => bringPageBack({}))}
            disabled={pageBack.pending}
            style={{ opacity: pageBack.pending ? 0.5 : 1 }}
            className="rounded-full border border-border bg-surface px-4 py-2"
          >
            <Text className="text-soft-ink" style={{ fontSize: 13 }}>
              {pageBack.pending ? "Reading…" : "✦ Bring a page back"}
            </Text>
          </Pressable>
        </View>

        <RunResult
          pending={pageBack.pending}
          elapsed={pageBack.elapsed}
          result={pageBack.result}
        />
        {!pageBack.pending && pageBack.result ? (
          <Pressable onPress={pageBack.reset} hitSlop={8} className="mt-2 self-start">
            <Text className="text-xs text-faint-ink">close</Text>
          </Pressable>
        ) : null}

        {/* Date-based returns from this day in years past, quiet when empty. */}
        <OnThisDay />

        <Text className="text-ink text-lg mt-10 leading-relaxed">
          {user?.name ? `Hello, ${user.name}.` : "Hello."} What do you want to
          remember about today?
        </Text>

        <View className="mt-6 rounded-3xl border border-border bg-surface overflow-hidden">
          <Text className="text-xs uppercase tracking-widest text-faint-ink px-4 pt-4 pb-1">
            Today's page
          </Text>
          {status === "loading" ? (
            <View className="min-h-80 items-center justify-center">
              <ActivityIndicator color="#3A2F25" />
            </View>
          ) : (
            <RichEditor
              ref={editorRef}
              initialHtml={body}
              onChangeHtml={setBody}
              placeholder="Start with one sentence…"
            />
          )}
          <View className="h-px bg-border mt-2" />
          <View className="px-4 pt-3">
            <MicButton onInsert={(t) => editorRef.current?.insertText(t)} />
          </View>
          <View className="px-4 pb-4">
            <EntryPhotos entryId={entryId} ensureEntry={ensureEntry} />
          </View>
        </View>

        {keptToday ? (
          <Pressable
            onPress={() => router.push("/(app)/explore?tab=library")}
            className="mt-4 self-start"
            hitSlop={6}
          >
            <Text className="text-soft-ink leading-relaxed">
              You've kept 1 page today — it's in your Library →
            </Text>
          </Pressable>
        ) : (
          <Text className="text-faint-ink text-sm mt-4 leading-relaxed">
            Your words save privately to this phone first, then sync to Yadegar
            when the connection is available.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
