import { useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import { AmbientField, SiteNav } from "@/components/site-chrome";
import { Landing } from "@/components/landing";

type View = "hero" | "signin" | "register";

function errorFromQuery(search: string): string | null {
  const code = new URLSearchParams(search).get("error");
  if (code === "google_unconfigured")
    return "Google sign-in isn't set up yet, use your email below.";
  if (code === "google_failed")
    return "Google sign-in didn't complete. Please try again.";
  return null;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const { login, register, loginWithGoogle } = useAuth();

  const initialError = errorFromQuery(search);
  const [view, setView] = useState<View>(initialError ? "signin" : "hero");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [submitting, setSubmitting] = useState(false);

  const isForm = view === "signin" || view === "register";

  const goto = (next: View) => {
    setError(null);
    setView(next);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (view === "register" && password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      if (view === "signin") {
        await login(email.trim(), password);
      } else {
        await register(email.trim(), password, name.trim() || undefined);
      }
      setLocation("/");
    } catch (err) {
      setError(
        err instanceof Error
          ? messageFor(err.message, view)
          : "Something went wrong. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (view === "hero") {
    return (
      <Landing
        onCreate={() => goto("register")}
        onSignIn={() => goto("signin")}
      />
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AmbientField />
      <SiteNav />

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <AnimatePresence mode="wait">
          <motion.div
            key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="w-full max-w-[400px]"
            >
              <h2 className="font-display text-3xl text-deep-brown text-center mb-1.5">
                {view === "signin" ? "Welcome back" : "Begin"}
              </h2>
              <p className="font-body text-soft-ink text-center mb-7">
                {view === "signin"
                  ? "Return to your past selves."
                  : "Start a quiet record of what endures."}
              </p>

              <div className="bg-surface/80 backdrop-blur-sm border border-border rounded-2xl p-7 shadow-sm">
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="w-full flex items-center justify-center gap-3 rounded-full border border-border bg-background hover:border-accent-sepia transition-colors py-2.5 text-ink font-sans text-sm"
                  data-testid="button-google"
                >
                  <GoogleMark />
                  Continue with Google
                </button>

                <div className="flex items-center gap-3 my-5">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-faint-ink text-[0.65rem] uppercase tracking-[0.18em] font-sans">
                    or
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {view === "register" && (
                    <Field label="Name (optional)">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        className={inputClass}
                        data-testid="input-name"
                      />
                    </Field>
                  )}
                  <Field label="Email">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      className={inputClass}
                      data-testid="input-email"
                    />
                  </Field>
                  <Field label="Password">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={
                        view === "signin" ? "current-password" : "new-password"
                      }
                      className={inputClass}
                      data-testid="input-password"
                    />
                  </Field>

                  {error && (
                    <p
                      className="font-sans text-sm text-red-700"
                      data-testid="text-error"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-full bg-deep-brown text-background py-2.5 font-sans text-sm hover:bg-ink transition-colors disabled:opacity-60"
                    data-testid="button-submit"
                  >
                    {submitting
                      ? "One moment…"
                      : view === "signin"
                        ? "Sign in"
                        : "Create account"}
                  </button>
                </form>
              </div>

              {view === "signin" && (
                <p className="text-center mt-4">
                  <Link
                    href="/forgot-password"
                    className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
                  >
                    Forgot password?
                  </Link>
                </p>
              )}

              <p className="text-center text-soft-ink mt-6 font-body">
                {view === "signin"
                  ? "New to Yadegar?"
                  : "Already have an account?"}{" "}
                <button
                  type="button"
                  onClick={() =>
                    goto(view === "signin" ? "register" : "signin")
                  }
                  className="text-accent-sepia underline underline-offset-2"
                  data-testid="button-toggle-mode"
                >
                  {view === "signin" ? "Create one" : "Sign in"}
                </button>
              </p>

              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => goto("hero")}
                  className="font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
                  data-testid="button-back"
                >
                  ← back
                </button>
              </div>
          </motion.div>
        </AnimatePresence>
      </main>

      {!isForm && (
        <footer className="text-center pb-8 font-sans text-xs text-faint-ink space-y-2">
          <p>Offer the meaning, never push the moment.</p>
          <p className="space-x-3">
            <Link href="/privacy-policy" className="hover:text-soft-ink transition-colors">
              Privacy
            </Link>
            <span aria-hidden>·</span>
            <Link href="/terms" className="hover:text-soft-ink transition-colors">
              Terms
            </Link>
          </p>
        </footer>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-ink font-body outline-none focus:border-accent-sepia transition-colors";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block font-sans text-xs text-soft-ink mb-1.5 tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

function messageFor(raw: string, view: View): string {
  if (raw.includes("401")) return "Incorrect email or password.";
  if (raw.includes("409"))
    return "That email is already registered. Sign in instead.";
  if (raw.includes("400"))
    return view === "register"
      ? "Enter a valid email and an 8+ character password."
      : "Enter your email and password.";
  return "Something went wrong. Please try again.";
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.49h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.89 2.68-6.63z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
