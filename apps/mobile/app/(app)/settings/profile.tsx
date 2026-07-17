import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Text } from "../../../components/text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../../lib/auth";
import { updateProfile, changePassword } from "../../../lib/profile";
import { Avatar } from "../../../components/avatar";
import {
  AVATAR_COLORS,
  avatarColorFor,
  avatarPhotoAvailable,
  pickAvatarDataUrl,
} from "../../../lib/avatar";
import { BackToSettings } from "../../../components/settings-back";

function SectionLabel({ children }: { children: string }) {
  return (
    <Text className="text-xs uppercase tracking-widest text-faint-ink mb-3">
      {children}
    </Text>
  );
}

// Account → Your profile: avatar (photo or colour), display name, read-only
// email, save, and a signed-in password change. Mirrors the web.
export default function Profile() {
  const insets = useSafeAreaInsets();
  const { user, refresh } = useAuth();

  const [name, setName] = useState("");
  const [color, setColor] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Seed once the user loads / changes.
  useEffect(() => {
    setName(user?.name ?? "");
    setColor(user?.avatarColor ?? null);
    setAvatarUrl(user?.avatarUrl ?? null);
  }, [user?.name, user?.avatarColor, user?.avatarUrl]);

  const preview = { name, email: user?.email, avatarColor: color, avatarUrl };
  const effectiveColor = color ?? avatarColorFor(preview);

  const dirty =
    (user?.name ?? "") !== name.trim() ||
    (user?.avatarColor ?? null) !== color ||
    (user?.avatarUrl ?? null) !== avatarUrl;

  async function onPickPhoto() {
    if (!avatarPhotoAvailable()) {
      Alert.alert(
        "Photo avatars need the latest build",
        "Choosing a photo turns on once the app is rebuilt with the photo update. You can pick a colour now.",
      );
      return;
    }
    const url = await pickAvatarDataUrl();
    if (url) setAvatarUrl(url);
  }

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({ name: name.trim(), avatarColor: color, avatarUrl });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      Alert.alert("Couldn't save", "Please try again in a moment.");
    } finally {
      setSaving(false);
    }
  }

  // Password change (hidden for Google-only accounts).
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  async function onChangePassword() {
    setPwMsg(null);
    if (next.length < 8) {
      setPwMsg("Your new password must be at least 8 characters.");
      return;
    }
    setPwBusy(true);
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setPwMsg("Password changed ✓");
      setTimeout(() => setPwMsg(null), 3000);
    } catch {
      setPwMsg("Couldn't change it — check that your current password is right.");
    } finally {
      setPwBusy(false);
    }
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
      <Text className="text-4xl text-deep-brown">Your profile</Text>

      {/* Avatar + photo controls. */}
      <View className="mt-8 flex-row items-center gap-5">
        <Avatar user={preview} size={84} colorOverride={effectiveColor} />
        <View className="gap-1.5">
          <Pressable onPress={onPickPhoto} hitSlop={6}>
            <Text className="text-soft-ink">
              {avatarUrl ? "Change photo" : "Upload a photo"}
            </Text>
          </Pressable>
          {avatarUrl ? (
            <Pressable onPress={() => setAvatarUrl(null)} hitSlop={6}>
              <Text className="text-faint-ink">Remove photo</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Colour. */}
      <View className="mt-8">
        <SectionLabel>Choose a colour</SectionLabel>
        <View className="flex-row gap-3">
          {AVATAR_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: c,
                borderWidth: color === c ? 2 : 0,
                borderColor: "#3A2F25",
              }}
            />
          ))}
        </View>
        {avatarUrl ? (
          <Text className="text-faint-ink text-sm mt-2 leading-relaxed">
            Your photo is shown instead of the colour — remove it to use a colour.
          </Text>
        ) : null}
      </View>

      {/* Display name. */}
      <View className="mt-8">
        <SectionLabel>Display name</SectionLabel>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={80}
          placeholder="What should we call you?"
          placeholderTextColor="#A59B8D"
          className="rounded-xl border border-border bg-surface px-4 py-3 text-lg text-ink"
        />
        <Text className="text-faint-ink text-sm mt-2 leading-relaxed">
          Shown in the top bar and on your pages. Leave it blank to use your email.
        </Text>
      </View>

      {/* Email (read-only). */}
      <View className="mt-8">
        <SectionLabel>Email</SectionLabel>
        <Text className="text-lg text-soft-ink">{user?.email}</Text>
        <Text className="text-faint-ink text-sm mt-1 leading-relaxed">
          Your sign-in identity — it can't be changed here.
        </Text>
      </View>

      <View className="mt-8 flex-row items-center gap-4">
        <Pressable
          onPress={save}
          disabled={!dirty || saving}
          style={{ opacity: !dirty || saving ? 0.4 : 1 }}
          className="rounded-full bg-deep-brown px-6 py-2.5"
        >
          <Text className="text-background" style={{ fontSize: 13 }}>
            {saving ? "Saving…" : "Save changes"}
          </Text>
        </Pressable>
        {saved ? <Text className="text-soft-ink" style={{ fontSize: 13 }}>Saved ✓</Text> : null}
      </View>

      {/* Password. */}
      <View className="mt-12 pt-8 border-t border-border/50">
        <SectionLabel>Password</SectionLabel>
        {user?.hasPassword === false ? (
          <Text className="text-soft-ink leading-relaxed">
            You sign in with Google — there's no password to change.
          </Text>
        ) : (
          <>
            <View className="gap-3">
              <TextInput
                value={current}
                onChangeText={setCurrent}
                secureTextEntry
                autoCapitalize="none"
                textContentType="password"
                placeholder="Current password"
                placeholderTextColor="#A59B8D"
                className="rounded-xl border border-border bg-surface px-4 py-3 text-ink"
              />
              <TextInput
                value={next}
                onChangeText={setNext}
                secureTextEntry
                autoCapitalize="none"
                textContentType="newPassword"
                placeholder="New password (8+ characters)"
                placeholderTextColor="#A59B8D"
                className="rounded-xl border border-border bg-surface px-4 py-3 text-ink"
              />
            </View>
            <View className="mt-4 flex-row items-center gap-4">
              <Pressable
                onPress={onChangePassword}
                disabled={!current || !next || pwBusy}
                style={{ opacity: !current || !next || pwBusy ? 0.4 : 1 }}
                className="rounded-full border border-border bg-surface px-5 py-2"
              >
                <Text className="text-soft-ink" style={{ fontSize: 13 }}>
                  {pwBusy ? "Saving…" : "Change password"}
                </Text>
              </Pressable>
              {pwMsg ? (
                <Text className="text-soft-ink flex-1" style={{ fontSize: 13 }}>
                  {pwMsg}
                </Text>
              ) : null}
            </View>
          </>
        )}
      </View>
    </ScrollView>
  );
}
