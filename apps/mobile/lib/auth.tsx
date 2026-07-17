import * as AppleAuthentication from "expo-apple-authentication";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { API_ORIGIN, api, setToken } from "./api";
import { registerForPush, unregisterForPush } from "./push";
import {
  configurePurchases,
  logOutPurchases,
  hasActiveMembership,
} from "./purchases";

WebBrowser.maybeCompleteAuthSession();

// Token auth for the native app. Mirrors the web's auth context shape, but the
// session lives as a bearer token in SecureStore (see lib/api).

export interface MobileUser {
  id: string;
  email: string;
  name?: string | null;
  plan?: "free" | "member";
  onboardingCompleted?: boolean;
  emailVerified?: boolean;
  usage?: { used: number; limit: number | null; atLimit: boolean };
  avatarUrl?: string | null;
  avatarColor?: string | null;
  hasPassword?: boolean;
}

interface AuthState {
  user: MobileUser | null;
  loading: boolean;
  // True when the account is a member — from the backend plan OR the live
  // RevenueCat entitlement on this device. The entitlement side means a fresh
  // purchase reflects instantly, without waiting for the webhook to flip `plan`.
  isMember: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  refresh: () => Promise<void>;
  // Re-read the local RevenueCat entitlement (call right after a purchase or
  // restore so the UI updates immediately).
  syncMembership: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Live RevenueCat entitlement for this device (see isMember below).
  const [entitled, setEntitled] = useState(false);

  const syncMembership = async () => {
    setEntitled(await hasActiveMembership());
  };

  // Identify the signed-in user to RevenueCat (sets app_user_id = users.id, so
  // the backend webhook maps purchases to the right account), then read their
  // current entitlement. No-ops off iOS or without the IAP module.
  useEffect(() => {
    if (!user?.id) {
      setEntitled(false);
      return;
    }
    void (async () => {
      await configurePurchases(user.id);
      await syncMembership();
    })();
  }, [user?.id]);

  // Member if the backend says so OR the device holds a live entitlement.
  const isMember = user?.plan === "member" || entitled;

  // Rehydrate from a stored token on launch.
  useEffect(() => {
    (async () => {
      try {
        const me = await api<MobileUser>("/auth/me");
        setUser(me);
        // Refresh this device's push registration on every authenticated launch
        // (the backend upserts; a rotated token self-heals). Fire-and-forget.
        void registerForPush();
      } catch {
        setUser(null); // no/invalid token
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    const r = await api<MobileUser & { token?: string }>("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    if (r.token) await setToken(r.token);
    setUser(r);
    void registerForPush();
  };

  const signUp = async (email: string, password: string, name?: string) => {
    const r = await api<MobileUser & { token?: string }>("/auth/register", {
      method: "POST",
      body: { email, password, ...(name ? { name } : {}) },
    });
    if (r.token) await setToken(r.token);
    setUser(r);
    void registerForPush();
  };

  const signInWithGoogle = async () => {
    const returnTo = Linking.createURL("auth/google");
    const startUrl = `${API_ORIGIN}/api/auth/google?client=mobile&returnTo=${encodeURIComponent(returnTo)}`;
    const result = await WebBrowser.openAuthSessionAsync(startUrl, returnTo);

    if (result.type !== "success") return;

    const url = new URL(result.url);
    const error = url.searchParams.get("error");
    const token = url.searchParams.get("token");

    if (error || !token) {
      throw new Error(error ?? "Google sign-in failed");
    }

    await setToken(token);
    const me = await api<MobileUser>("/auth/me");
    setUser(me);
    void registerForPush();
  };

  const signInWithApple = async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    if (!credential.identityToken) {
      throw new Error("Apple sign-in did not return an identity token");
    }

    const r = await api<MobileUser & { token?: string }>("/auth/apple/mobile", {
      method: "POST",
      body: {
        identityToken: credential.identityToken,
        fullName: credential.fullName,
        // Sent so the server can later exchange it for a refresh token and
        // revoke it on account deletion (App Store 5.1.1(v)). Single-use and
        // short-lived, so it must be captured here at sign-in.
        authorizationCode: credential.authorizationCode,
      },
    });

    if (r.token) await setToken(r.token);
    setUser(r);
    void registerForPush();
  };

  const signOut = async () => {
    // Unregister BEFORE logout/clearing the token — the DELETE call still needs
    // the bearer token, and logout invalidates the session server-side.
    await unregisterForPush();
    await logOutPurchases();
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // ignore network errors on sign-out
    }
    await setToken(null);
    setUser(null);
    setEntitled(false);
  };

  const completeOnboarding = async () => {
    await api("/auth/complete-onboarding", { method: "POST" });
    setUser((u) => (u ? { ...u, onboardingCompleted: true } : u));
  };

  // Re-pull the signed-in user (after a profile edit, so the header + pages
  // reflect a new name/avatar).
  const refresh = async () => {
    try {
      setUser(await api<MobileUser>("/auth/me"));
    } catch {
      // keep the current user on a transient failure
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isMember,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        signInWithApple,
        completeOnboarding,
        refresh,
        syncMembership,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
