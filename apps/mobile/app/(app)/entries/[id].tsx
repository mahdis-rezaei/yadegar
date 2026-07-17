import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  TextInput,
  View,
} from "react-native";
import { Text } from "../../../components/text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../lib/api";
import {
  addToShelf,
  listCollections,
  addToCollection,
  type Collection,
} from "../../../lib/extras";
import { EntryPhotos } from "../../../components/entry-photos";
import { RichText } from "../../../components/rich-text";
import { RichEditor } from "../../../components/rich-editor";
import { htmlToPlain, plainToHtml } from "../../../lib/html";
import {
  updateEntryResurfacing,
  type ResurfacingPreference,
} from "../../../lib/settings";

type JournalEntry = {
  id: string;
  title?: string | null;
  body: string;
  bodyRich?: string | null;
  resurfacingPreference?: ResurfacingPreference;
  entryDate: string | null;
  source: string;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
};

type Reflection = {
  id: string;
  journalEntryId: string;
  body: string;
  reflectionDate: string;
  createdAt: string;
  updatedAt: string;
};

const RESURFACING: { value: ResurfacingPreference; label: string }[] = [
  { value: "normal", label: "Let Yadegar return this" },
  { value: "more_often", label: "Return this more often" },
  { value: "never", label: "Never return this automatically" },
];

function longDate(value: string | null): string {
  if (!value) return "Undated";
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function shortDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function EntryDetail() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = useMemo(() => {
    const v = params.id;
    return Array.isArray(v) ? v[0] : v;
  }, [params.id]);

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [reflections, setReflections] = useState<Reflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode (read-by-default, like the web).
  const [editing, setEditing] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const draftHtmlRef = useRef("");

  // Reflections composer.
  const [reflecting, setReflecting] = useState(false);
  const [reflectionText, setReflectionText] = useState("");
  const [reflectionBusy, setReflectionBusy] = useState(false);

  // Keep / collections / favorite / delete.
  const [shelved, setShelved] = useState(false);
  const [collPickerOpen, setCollPickerOpen] = useState(false);
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [addedColl, setAddedColl] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!id) {
        setError("Entry not found.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const [row, refls] = await Promise.all([
          api<JournalEntry>(`/entries/${id}`),
          api<Reflection[]>(`/entries/${id}/reflections`),
        ]);
        if (cancelled) return;
        setEntry(row);
        setReflections(refls);
      } catch {
        if (!cancelled) setError("Could not load this page.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const backToLibrary = () => router.navigate("/(app)/explore?tab=library");

  async function patch(data: Record<string, unknown>) {
    if (!id) return;
    const saved = await api<JournalEntry>(`/entries/${id}`, { method: "PATCH", body: data });
    setEntry(saved);
    return saved;
  }

  function toggleFavorite() {
    if (!entry) return;
    const next = !entry.favorite;
    setEntry({ ...entry, favorite: next });
    patch({ favorite: next }).catch(() =>
      setEntry((e) => (e ? { ...e, favorite: !next } : e)),
    );
  }

  function changeResurf(v: ResurfacingPreference) {
    if (!entry || !id) return;
    const prev = entry.resurfacingPreference ?? "normal";
    setEntry({ ...entry, resurfacingPreference: v });
    updateEntryResurfacing(id, v).catch(() =>
      setEntry((e) => (e ? { ...e, resurfacingPreference: prev } : e)),
    );
  }

  async function onAddToShelf() {
    if (!id || shelved) return;
    setShelved(true);
    try {
      await addToShelf(id);
    } catch {
      setShelved(false);
    }
  }

  async function toggleCollPicker() {
    const next = !collPickerOpen;
    setCollPickerOpen(next);
    if (next && collections === null) {
      try {
        setCollections(await listCollections());
      } catch {
        setCollections([]);
      }
    }
  }

  async function onAddToCollection(c: Collection) {
    if (!id || addedColl.has(c.id)) return;
    setAddedColl((s) => new Set(s).add(c.id));
    try {
      await addToCollection(c.id, id);
    } catch {
      setAddedColl((s) => {
        const n = new Set(s);
        n.delete(c.id);
        return n;
      });
    }
  }

  function startEdit() {
    if (!entry) return;
    draftHtmlRef.current = entry.bodyRich ?? plainToHtml(entry.body);
    setDraftDate(entry.entryDate ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    const html = draftHtmlRef.current;
    const plain = htmlToPlain(html);
    if (!plain.trim()) {
      Alert.alert("Write something", "A page can't be empty.");
      return;
    }
    setSavingEdit(true);
    try {
      await patch({ body: plain, bodyRich: html, entryDate: draftDate || null });
      setEditing(false);
    } catch {
      Alert.alert("Couldn't save", "Please try again in a moment.");
    } finally {
      setSavingEdit(false);
    }
  }

  function exportEntry() {
    if (!entry) return;
    const lines = [longDate(entry.entryDate)];
    if (entry.title) lines.push("", entry.title);
    lines.push("", entry.body);
    for (const r of reflections) {
      lines.push("", "—", `Reflection · ${shortDate(r.reflectionDate)}`, "", r.body);
    }
    void Share.share({ message: lines.join("\n") });
  }

  async function doDelete() {
    if (!id) return;
    try {
      await api(`/entries/${id}`, { method: "DELETE" });
      backToLibrary();
    } catch {
      Alert.alert("Couldn't delete", "Please try again in a moment.");
    }
  }

  async function addReflection() {
    if (!id || reflectionBusy) return;
    const trimmed = reflectionText.trim();
    if (!trimmed) return;
    setReflectionBusy(true);
    try {
      const created = await api<Reflection>(`/entries/${id}/reflections`, {
        method: "POST",
        body: { body: trimmed },
      });
      setReflections((cur) => [...cur, created]);
      setReflectionText("");
      setReflecting(false);
    } catch {
      Alert.alert("Couldn't save", "Please try again in a moment.");
    } finally {
      setReflectionBusy(false);
    }
  }

  function removeReflection(rid: string) {
    setReflections((cur) => cur.filter((r) => r.id !== rid));
    void api(`/reflections/${rid}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: 14,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 48,
        }}
      >
        <Pressable onPress={backToLibrary} hitSlop={8} className="self-start">
          <Text className="text-soft-ink" style={{ fontSize: 14 }}>← Library</Text>
        </Pressable>

        {loading ? (
          <View className="min-h-80 items-center justify-center">
            <ActivityIndicator color="#3A2F25" />
          </View>
        ) : error || !entry ? (
          <View className="mt-10 rounded-3xl border border-border bg-surface p-5">
            <Text className="text-ink">{error ?? "This page could not be found."}</Text>
            <Pressable onPress={backToLibrary} className="mt-4">
              <Text className="text-deep-brown">Back to your Library</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-8">
            {/* Title (the date) + inline actions. */}
            <View className="flex-row items-start justify-between gap-3 mb-8">
              <Text className="flex-1 text-3xl text-deep-brown leading-tight">
                {longDate(entry.entryDate)}
              </Text>
              <View className="flex-row items-center gap-4 pt-1">
                <Pressable onPress={toggleCollPicker} hitSlop={6}>
                  <Text className="text-soft-ink" style={{ fontSize: 13 }}>Collections</Text>
                </Pressable>
                <Pressable onPress={onAddToShelf} disabled={shelved} hitSlop={6}>
                  <Text className="text-soft-ink" style={{ fontSize: 13 }}>
                    {shelved ? "On shelf ✓" : "Add to shelf"}
                  </Text>
                </Pressable>
                <Pressable onPress={toggleFavorite} hitSlop={6}>
                  <Text className={entry.favorite ? "text-accent-sepia text-2xl" : "text-faint-ink text-2xl"}>
                    {entry.favorite ? "★" : "☆"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {collPickerOpen ? (
              <View className="mb-6 rounded-3xl border border-border bg-surface p-4 gap-1">
                {collections === null ? (
                  <ActivityIndicator color="#3A2F25" />
                ) : collections.length === 0 ? (
                  <Text className="text-soft-ink leading-relaxed">
                    No collections yet. Make one in Explore → Collections.
                  </Text>
                ) : (
                  collections.map((c) => {
                    const added = addedColl.has(c.id);
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => onAddToCollection(c)}
                        disabled={added}
                        className="flex-row items-center justify-between py-2.5"
                      >
                        <Text className="text-ink">{c.name}</Text>
                        <Text className={added ? "text-accent-sepia" : "text-faint-ink"}>
                          {added ? "Added ✓" : "Add"}
                        </Text>
                      </Pressable>
                    );
                  })
                )}
              </View>
            ) : null}

            {editing ? (
              /* Edit mode. */
              <View>
                <TextInput
                  value={draftDate}
                  onChangeText={setDraftDate}
                  placeholder="Date (YYYY-MM-DD)"
                  placeholderTextColor="#A59B8D"
                  autoCapitalize="none"
                  className="self-start rounded-lg border border-border bg-surface px-3 py-2 text-soft-ink mb-4"
                  style={{ fontSize: 13 }}
                />
                <View className="rounded-3xl border border-border bg-surface overflow-hidden">
                  <RichEditor
                    initialHtml={draftHtmlRef.current}
                    placeholder="Write more…"
                    onChangeHtml={(h) => {
                      draftHtmlRef.current = h;
                    }}
                  />
                </View>
                <View className="mt-4 flex-row items-center gap-5">
                  <Pressable
                    onPress={() => void saveEdit()}
                    disabled={savingEdit}
                    className="rounded-full bg-deep-brown px-6 py-2"
                  >
                    <Text className="text-background" style={{ fontSize: 13 }}>
                      {savingEdit ? "Saving…" : "Save"}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => setEditing(false)}>
                    <Text className="text-soft-ink" style={{ fontSize: 13 }}>Cancel</Text>
                  </Pressable>
                </View>
                {id ? (
                  <View className="px-1">
                    <EntryPhotos entryId={id} editable />
                  </View>
                ) : null}
              </View>
            ) : (
              /* Read mode. */
              <>
                {entry.bodyRich ? (
                  <RichText html={entry.bodyRich} />
                ) : (
                  <Text className="text-lg text-ink leading-7">{entry.body}</Text>
                )}
                {id ? <EntryPhotos entryId={id} editable={false} /> : null}

                {/* Reflections. */}
                <View className="mt-12">
                  {reflections.length > 0 ? (
                    <View className="gap-7 mb-7">
                      {reflections.map((r) => (
                        <View key={r.id} className="border-l-2 border-accent-sepia/30 pl-5">
                          <View className="flex-row items-baseline justify-between gap-3 mb-1.5">
                            <Text className="text-xs uppercase tracking-widest text-faint-ink">
                              Reflection · {shortDate(r.reflectionDate)}
                            </Text>
                            <Pressable onPress={() => removeReflection(r.id)} hitSlop={6}>
                              <Text className="text-faint-ink text-xs">remove</Text>
                            </Pressable>
                          </View>
                          <Text className="text-lg text-soft-ink leading-relaxed">{r.body}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  {reflecting ? (
                    <View className="gap-3">
                      <TextInput
                        value={reflectionText}
                        onChangeText={setReflectionText}
                        autoFocus
                        multiline
                        textAlignVertical="top"
                        placeholder="Write to the person who wrote this…"
                        placeholderTextColor="#A59B8D"
                        className="min-h-[120px] rounded-lg border border-border bg-surface p-4 text-lg text-ink leading-relaxed"
                      />
                      <View className="flex-row items-center gap-5">
                        <Pressable
                          onPress={() => void addReflection()}
                          disabled={reflectionBusy || !reflectionText.trim()}
                          style={{ opacity: reflectionBusy || !reflectionText.trim() ? 0.5 : 1 }}
                          className="rounded-full bg-deep-brown px-6 py-2"
                        >
                          <Text className="text-background" style={{ fontSize: 13 }}>
                            {reflectionBusy ? "Saving…" : "Add reflection"}
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => {
                            setReflecting(false);
                            setReflectionText("");
                          }}
                        >
                          <Text className="text-soft-ink" style={{ fontSize: 13 }}>Cancel</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable onPress={() => setReflecting(true)} className="self-start">
                      <Text className="text-accent-sepia">Reflect on this page</Text>
                    </Pressable>
                  )}
                </View>

                {/* When Yadegar may return this. */}
                <View className="mt-14 pt-8 border-t border-border/60">
                  <Text className="text-xs uppercase tracking-widest text-faint-ink mb-3">
                    When Yadegar may return this
                  </Text>
                  <View className="flex-row flex-wrap gap-2">
                    {RESURFACING.map((opt) => {
                      const sel = (entry.resurfacingPreference ?? "normal") === opt.value;
                      return (
                        <Pressable
                          key={opt.value}
                          onPress={() => changeResurf(opt.value)}
                          className={
                            "rounded-full border px-4 py-1.5 " +
                            (sel ? "border-accent-sepia bg-surface" : "border-border bg-surface")
                          }
                        >
                          <Text className={sel ? "text-ink" : "text-soft-ink"} style={{ fontSize: 13 }}>
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Edit · Export · Delete. */}
                  <View className="mt-8 flex-row items-center gap-6">
                    <Pressable onPress={startEdit}>
                      <Text className="text-soft-ink" style={{ fontSize: 14 }}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={exportEntry}>
                      <Text className="text-soft-ink" style={{ fontSize: 14 }}>Export</Text>
                    </Pressable>
                    {confirmDelete ? (
                      <View className="flex-row items-center gap-3">
                        <Text className="text-soft-ink" style={{ fontSize: 13 }}>Delete this page?</Text>
                        <Pressable onPress={() => void doDelete()}>
                          <Text style={{ color: "#B4453A", fontSize: 14 }}>Delete</Text>
                        </Pressable>
                        <Pressable onPress={() => setConfirmDelete(false)}>
                          <Text className="text-soft-ink" style={{ fontSize: 14 }}>Keep</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Pressable onPress={() => setConfirmDelete(true)}>
                        <Text className="text-soft-ink" style={{ fontSize: 14 }}>Delete</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
