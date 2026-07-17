import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useRequestPasswordReset } from "@workspace/api-client-react";
import { AmbientField, SiteNav } from "@/components/site-chrome";

export default function ForgotPassword() {
  const request = useRequestPasswordReset();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      // Always succeeds (the server never reveals whether the email exists).
      await request.mutateAsync({ data: { email: email.trim() } });
    } catch {
      /* ignore, we show the same message regardless */
    } finally {
      setBusy(false);
      setSent(true);
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AmbientField />
      <SiteNav showWhy={false} />
      <main className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-[400px] text-center">
          {sent ? (
            <>
              <h1 className="font-display text-3xl text-deep-brown mb-3">
                Check your email.
              </h1>
              <p className="font-body text-soft-ink mb-6">
                If an account exists for that address, we've sent a link to set
                a new password.
              </p>
              <Link
                href="/login"
                className="font-sans text-sm text-accent-sepia hover:text-deep-brown underline underline-offset-2"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl text-deep-brown mb-2">
                Reset your password
              </h1>
              <p className="font-body text-soft-ink mb-7">
                Enter your email and we'll send you a link.
              </p>
              <form onSubmit={onSubmit} className="space-y-4 text-left">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoFocus
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-ink font-body outline-none focus:border-accent-sepia transition-colors"
                  data-testid="input-email"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-full bg-deep-brown text-background py-2.5 font-sans text-sm hover:bg-ink transition-colors disabled:opacity-60"
                  data-testid="button-send-reset"
                >
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <p className="text-center mt-5">
                <Link
                  href="/login"
                  className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
                >
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
