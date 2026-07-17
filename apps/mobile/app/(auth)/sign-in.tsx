import { useEffect, useState } from "react";
import {
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";
import { Text } from "../../components/text";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useAuth } from "../../lib/auth";

// Email/password auth. Google + Sign in with Apple land in Phase 0.x (native
// flows). The look mirrors the web's calm auth screen. Reached from Welcome with
// ?mode=in|up.
export default function SignIn() {
  const { signIn, signUp, signInWithGoogle, signInWithApple } = useAuth();
  const params = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">(params.mode === "up" ? "up" : "in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [socialBusy, setSocialBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  async function submitGoogle() {
    setSocialBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch {
      setError("Google sign-in didn't work. Please try again.");
    } finally {
      setSocialBusy(false);
    }
  }

  async function submitApple() {
    if (busy || socialBusy || appleBusy) return;

    setAppleBusy(true);
    setError(null);
    try {
      await signInWithApple();
    } catch {
      setError("Apple sign-in didn't work. Please try again.");
    } finally {
      setAppleBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mode === "in") await signIn(email.trim(), password);
      else await signUp(email.trim(), password, name.trim() || undefined);
    } catch {
      setError("That didn't work. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Pressable
        onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/welcome"))}
        hitSlop={12}
        style={{ position: "absolute", top: 56, left: 20, zIndex: 10 }}
      >
        <Text className="text-soft-ink text-3xl">‹</Text>
      </Pressable>

      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 48,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-3xl text-deep-brown text-center">Yadegar</Text>
      <Text className="text-soft-ink text-center mt-1 mb-8">
        {mode === "in" ? "Welcome back." : "Begin your journal."}
      </Text>

      <Pressable
        onPress={submitGoogle}
        disabled={busy || socialBusy}
        className="border border-border bg-surface rounded-full py-3.5 items-center disabled:opacity-50"
      >
        {socialBusy ? (
          <ActivityIndicator color="#3A2F25" />
        ) : (
          <Text className="text-ink text-base">Continue with Google</Text>
        )}
      </Pressable>

      {appleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={24}
          style={{ height: 48, marginTop: 12 }}
          onPress={submitApple}
        />
      )}

      <View className="flex-row items-center gap-3 my-5">
        <View className="h-px flex-1 bg-border" />
        <Text className="text-faint-ink text-xs uppercase tracking-widest">
          or
        </Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      {mode === "up" && (
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Name (optional)"
          placeholderTextColor="#A59B8D"
          className="bg-surface border border-border rounded-xl px-4 py-3 mb-3 text-ink"
        />
      )}
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#A59B8D"
        autoCapitalize="none"
        keyboardType="email-address"
        className="bg-surface border border-border rounded-xl px-4 py-3 mb-3 text-ink"
      />
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#A59B8D"
        secureTextEntry
        className="bg-surface border border-border rounded-xl px-4 py-3 mb-4 text-ink"
      />

      {error && <Text className="text-accent-sepia text-sm mb-3">{error}</Text>}

      <Pressable
        onPress={submit}
        disabled={busy || !email || !password}
        className="bg-deep-brown rounded-full py-3.5 items-center disabled:opacity-50"
      >
        {busy ? (
          <ActivityIndicator color="#F7F1E6" />
        ) : (
          <Text className="text-background text-base">
            {mode === "in" ? "Sign in" : "Create account"}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => setMode(mode === "in" ? "up" : "in")}
        className="mt-6 items-center"
      >
        <Text className="text-soft-ink text-sm">
          {mode === "in"
            ? "New to Yadegar? Create one"
            : "Already have an account? Sign in"}
        </Text>
      </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
