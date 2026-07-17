import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  customFetch,
  getGetCurrentUserQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";

type Interval = "monthly" | "annual";

// Phase 2, the membership page. Free users see the pitch + a monthly/annual
// toggle and start Stripe Checkout; members manage/cancel through the Stripe
// Billing Portal. The plan itself flips via the webhook (source of truth), so
// after Checkout we just refetch /auth/me. Honest about the pre-Stripe state: if
// the backend isn't wired yet it answers 503 and we say "coming soon," never an
// error.
export default function Plan() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [interval, setIntervalState] = useState<Interval>("annual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Whether Stripe is wired on the server. Until then we show "coming soon"
  // instead of a purchase button that can't complete.
  const [billingEnabled, setBillingEnabled] = useState<boolean | null>(null);

  const isMember = user?.plan === "member";

  useEffect(() => {
    let alive = true;
    customFetch<{ enabled?: boolean }>("/api/billing/config", {
      responseType: "json",
    })
      .then((r) => alive && setBillingEnabled(r?.enabled === true))
      .catch(() => alive && setBillingEnabled(false));
    return () => {
      alive = false;
    };
  }, []);
  const status =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("status")
      : null;

  // Coming back from a successful Checkout: the webhook may land a beat later, so
  // refetch the user a couple of times so the plan flips to "member" on its own.
  useEffect(() => {
    if (status !== "success") return;
    const key = getGetCurrentUserQueryKey();
    queryClient.invalidateQueries({ queryKey: key });
    const t = setTimeout(
      () => queryClient.invalidateQueries({ queryKey: key }),
      3000,
    );
    return () => clearTimeout(t);
  }, [status, queryClient]);

  async function go(path: string, body?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const r = await customFetch<{ url?: string }>(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
        responseType: "json",
      });
      if (r?.url) {
        window.location.href = r.url;
        return;
      }
      setError("Something went wrong. Please try again in a moment.");
    } catch (err) {
      const e = err as { status?: number };
      setError(
        e?.status === 503
          ? "Membership isn't quite ready yet, it's coming very soon."
          : "Something went wrong. Please try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  const renews =
    user?.planRenewsAt != null
      ? new Date(user.planRenewsAt).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : null;

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <Link
          href="/settings"
          className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
        >
          ← Settings
        </Link>

        <h1 className="font-display text-4xl text-deep-brown mt-8 mb-3">
          Membership
        </h1>

        {status === "success" && (
          <p className="font-body text-lg text-deep-brown leading-relaxed mb-6">
            {isMember
              ? "Welcome, your years are open to you now."
              : "Welcome, your years are open to you now. Just finishing the last details…"}
          </p>
        )}
        {status === "cancelled" && (
          <p className="font-body text-soft-ink leading-relaxed mb-6">
            No problem, nothing changed. Your journal is yours, free, as always.
          </p>
        )}

        {isMember ? (
          <div className="border border-border rounded-xl bg-surface/60 p-6">
            <p className="font-body text-xl text-ink">You're a member</p>
            <p className="font-body text-soft-ink mt-2 leading-relaxed">
              Unlimited fresh returns across your years. Thank you for keeping
              Yadegar alive.
            </p>
            {renews && (
              <p className="font-body text-sm text-faint-ink mt-3">
                Renews {renews}.
              </p>
            )}
            <button
              onClick={() => go("/api/billing/portal")}
              disabled={busy}
              className="mt-5 font-sans text-sm rounded-full px-5 py-2 border border-border hover:border-accent-sepia transition-colors disabled:opacity-60"
              data-testid="manage-membership"
            >
              {busy ? "Opening…" : "Manage membership"}
            </button>
          </div>
        ) : (
          <>
            <p className="font-body text-soft-ink leading-relaxed mb-8 max-w-[34rem]">
              Your journal is always free: writing, keeping, importing, and
              revisiting the pages that return to you. Membership adds unlimited{" "}
              <span className="text-ink">fresh returns</span>: Yadegar reading
              across all your years, whenever you like.
            </p>

            {billingEnabled === true ? (
              <>
                <div className="inline-flex rounded-full border border-border bg-surface/60 p-1 mb-6">
                  {(["annual", "monthly"] as Interval[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setIntervalState(v)}
                      className={
                        "px-4 py-1.5 rounded-full font-sans text-sm transition-colors " +
                        (interval === v
                          ? "bg-deep-brown text-background"
                          : "text-soft-ink hover:text-ink")
                      }
                      data-testid={`interval-${v}`}
                    >
                      {v === "annual" ? "Annual" : "Monthly"}
                    </button>
                  ))}
                </div>

                <div className="border border-border rounded-xl bg-surface/60 p-6 max-w-[28rem]">
                  {interval === "annual" ? (
                    <>
                      <p className="font-body text-2xl text-ink">
                        $59.99
                        <span className="text-base text-soft-ink"> / year</span>
                      </p>
                      <p className="font-sans text-sm text-accent-sepia mt-1">
                        $5/mo, billed yearly · save 44%
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-body text-2xl text-ink">
                        $8.99<span className="text-base text-soft-ink"> / month</span>
                      </p>
                      <button
                        onClick={() => setIntervalState("annual")}
                        className="font-sans text-sm text-accent-sepia hover:text-deep-brown transition-colors mt-1"
                        data-testid="annual-nudge"
                      >
                        Save 44% with annual →
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => go("/api/billing/checkout", { interval })}
                    disabled={busy}
                    className="mt-5 font-sans text-sm rounded-full px-5 py-2.5 bg-deep-brown text-background hover:opacity-90 transition-opacity disabled:opacity-60"
                    data-testid="become-member"
                  >
                    {busy ? "Taking you to checkout…" : "Become a member"}
                  </button>
                  {user?.usage && user.usage.limit != null && (
                    <p className="font-body text-sm text-faint-ink mt-4">
                      You've used {user.usage.used} of about {user.usage.limit}{" "}
                      fresh returns this month. Revisiting what's already returned
                      is always free.
                    </p>
                  )}
                </div>
              </>
            ) : billingEnabled === false ? (
              <div className="border border-border rounded-xl bg-surface/60 p-6 max-w-[28rem]">
                <p className="font-body text-lg text-ink">Coming soon</p>
                <p className="font-body text-soft-ink text-sm mt-1 leading-relaxed">
                  Membership, unlimited fresh returns across your years, is
                  almost ready. Your journal stays free either way.
                </p>
                {user?.usage && user.usage.limit != null && (
                  <p className="font-body text-sm text-faint-ink mt-4">
                    You've used {user.usage.used} of about {user.usage.limit} fresh
                    returns this month. Revisiting what's already returned is always
                    free.
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}

        {error && (
          <p className="font-body text-sm text-soft-ink mt-4">{error}</p>
        )}
      </main>
    </div>
  );
}
