import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  View,
} from "react-native";
import { Text } from "./text";
import { API_ORIGIN, getToken } from "../lib/api";
import {
  listAttachments,
  pickImage,
  uploadAttachment,
  deleteAttachment,
  photosAvailable,
  type Attachment,
} from "../lib/photos";

// A photos strip for a page: tap to add (library or camera), long-press a
// thumbnail to remove. Image bytes are auth'd, so each <Image> carries the token.
// On Today the page may not be saved yet — `ensureEntry` saves/creates it first
// (so a photo always has a page to attach to), matching the web.
export function EntryPhotos({
  entryId,
  ensureEntry,
  editable = true,
}: {
  entryId: string | null;
  ensureEntry?: () => Promise<string | null>;
  // When false (a read view), show existing photos only — no ＋ tile, no remove.
  editable?: boolean;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const t = await getToken();
    setToken(t);
    if (!entryId) {
      setItems([]);
      return;
    }
    try {
      setItems(await listAttachments(entryId));
    } catch {
      // leave as-is
    }
  }, [entryId]);

  useEffect(() => {
    void load();
  }, [load]);

  function source(id: string) {
    return {
      uri: `${API_ORIGIN}/api/attachments/${id}`,
      headers: {
        "X-Yadegar-Client": "mobile",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  }

  async function add(from: "library" | "camera") {
    setBusy(true);
    try {
      const picked = await pickImage(from);
      if (!picked) return;
      // Make sure there's a saved page to attach to (Today may be unsaved).
      const id = entryId ?? (ensureEntry ? await ensureEntry() : null);
      if (!id) {
        Alert.alert(
          "Write something first",
          "Add a sentence, and the photo will attach to today's page.",
        );
        return;
      }
      const row = await uploadAttachment(id, picked.uri, picked.width, picked.height);
      if (row) setItems((list) => [...list, row]);
      else Alert.alert("Couldn't add the photo", "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  function onAdd() {
    // Only the native picker needs the module — guard the action, not the tile,
    // so the ＋ never vanishes. A build without it shows a friendly note instead.
    if (!photosAvailable()) {
      Alert.alert(
        "Photos need the latest build",
        "Adding a photo turns on once the app is rebuilt with the photos update.",
      );
      return;
    }
    Alert.alert("Add a photo", undefined, [
      { text: "Photo Library", onPress: () => void add("library") },
      { text: "Take Photo", onPress: () => void add("camera") },
      { text: "Cancel", style: "cancel" },
    ]);
  }

  function onRemove(a: Attachment) {
    Alert.alert("Remove this photo?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          setItems((list) => list.filter((x) => x.id !== a.id));
          void deleteAttachment(a.id).catch(() => void load());
        },
      },
    ]);
  }

  // Read view with no photos: render nothing.
  if (!editable && items.length === 0) return null;

  return (
    <View className="mt-6">
      <View className="flex-row flex-wrap gap-3">
        {items.map((a) => (
          <Pressable key={a.id} onLongPress={editable ? () => onRemove(a) : undefined}>
            <Image
              source={source(a.id)}
              style={{ width: 96, height: 96, borderRadius: 14 }}
            />
          </Pressable>
        ))}
        {editable ? (
          <Pressable
            onPress={onAdd}
            disabled={busy}
            className="h-24 w-24 items-center justify-center rounded-2xl border border-border bg-surface"
          >
            {busy ? (
              <ActivityIndicator color="#3A2F25" />
            ) : (
              <Text className="text-soft-ink text-2xl">＋</Text>
            )}
          </Pressable>
        ) : null}
      </View>
      {editable && items.length > 0 ? (
        <Text className="text-faint-ink text-xs mt-2">
          Long-press a photo to remove it.
        </Text>
      ) : null}
    </View>
  );
}
