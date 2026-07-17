import { useState, type FormEvent } from "react";
import { Link, useSearch, useLocation } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { AmbientField, SiteNav } from "@/components/site-chrome";

export default function ResetPassword() {
  const search = useSearch();
  const token = new URLSearchParams(search).get("token") ?? "";
  const reset = useResetPassword();
  const [, setLocation] = useLocation();

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Choose a password with at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await reset.mutateAsync({ data: { token, password } });
      setDone(true);
    } catch {
      setError("That link is invalid or has expired. Request a new one.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AmbientField />
      <SiteNav showWhy={false} />
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-[400px] text-center">
          {done ? (
            <>
              <h1 className="font-display text-3xl text-deep-brown mb-3">
                Your password is set.
              </h1>
              <button
                onClick={() => setLocation("/login")}
                className="rounded-full bg-deep-brown text-background px-6 py-2.5 font-sans text-sm hover:bg-ink transition-colors"
              >
                Sign in
              </button>
            </>
          ) : !token ? (
            <>
              <h1 className="font-display text-3xl text-deep-brown mb-3">
                Something's missing.
              </h1>
              <p className="font-body text-soft-ink mb-5">
                This reset link is incomplete. Please request a new one.
              </p>
              <Link
                href="/forgot-password"
                className="font-sans text-sm text-accent-sepia hover:text-deep-brown underline underline-offset-2"
              >
                Request a reset link
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl text-deep-brown mb-2">
                Choose a new password
              </h1>
              <p className="font-body text-soft-ink mb-7">
                At least 8 characters.
              </p>
              <form onSubmit={onSubmit} className="space-y-4 text-left">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-ink font-body outline-none focus:border-accent-sepia transition-colors"
                  data-testid="input-password"
                />
                {error && (
                  <p className="font-sans text-sm text-red-700">{error}</p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-deep-brown text-background py-2.5 font-sans text-sm hover:bg-ink transition-colors disabled:opacity-60"
                  data-testid="button-reset"
                >
                  {busy ? "Saving…" : "Set new password"}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
