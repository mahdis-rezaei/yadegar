import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { AmbientField, SiteNav } from "@/components/site-chrome";
import { PricingCards } from "@/components/pricing-cards";

// Public, shareable pricing page (yadegarjournal.com/pricing). Summarizes the
// plans (shared PricingCards) and answers the questions that actually convert,
// since the in-app FAQ is behind sign-in. Source of truth for numbers:
// docs/MONETIZATION-STRATEGY.md / docs/MEMBERSHIP-COMMS.md.

const FAQ: { q: string; a: string }[] = [
  {
    q: "What's a “fresh return”?",
    a: "It's when Yadegar reads across your years and brings back something new: a thread that keeps returning, a forgotten page, a distance you've travelled. That reading is the part with a real cost, so it's the one thing the free tier limits (4 a month). Re-opening anything that's already returned to you is always free.",
  },
  {
    q: "What's the difference between free and membership?",
    a: "Everything about the journal (writing, keeping, importing, exporting, browsing, and revisiting past returns) is free and unlimited on both. Membership only lifts the cap on new fresh returns, from 4 a month to unlimited.",
  },
  {
    q: "Is “unlimited” really unlimited?",
    a: "For any real journaling practice, yes. There's a high fair-use ceiling in the background to stop runaway automated use, but it sits far above any human pace, so a normal member never meets it.",
  },
  {
    q: "Can I cancel anytime? What happens to my pages?",
    a: "Cancel anytime from Settings → Membership; you keep access through the period you've paid for, then move back to the free tier. Your pages are never held hostage: every page, reflection, and saved return stays exactly where it is, and you can export everything whenever you like.",
  },
  {
    q: "How do payments work?",
    a: "Securely through Stripe. Yadegar never sees or stores your card. You can switch between monthly and annual, update your card, or cancel from the Stripe billing portal, reachable in Settings.",
  },
];

export default function Pricing() {
  const { user } = useAuth();

  return (
    <div className="relative min-h-[100dvh] flex flex-col">
      <AmbientField />
      <SiteNav />

      <main className="flex-1 w-full max-w-[720px] mx-auto px-6 py-12 md:py-20">
        <p className="font-sans text-xs uppercase tracking-[0.22em] text-faint-ink text-center mb-6">
          What it costs
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-deep-brown text-center leading-tight mb-3">
          Free to keep. Yours to deepen.
        </h1>
        <p className="font-body text-soft-ink text-center leading-relaxed mb-10 max-w-[34rem] mx-auto">
          Your journal is always free: write, keep, import, export, and revisit
          the pages that return to you, without limit. Membership lifts the cap on
          new returns: Yadegar reading across your years, whenever you like.
        </p>

        <PricingCards />

        <p className="font-body text-faint-ink text-sm text-center mt-7 max-w-[34rem] mx-auto">
          We gate the AI, never your journal. Your words are always yours to
          write, keep, and take with you.
        </p>

        <div className="flex items-center justify-center gap-3 mt-9">
          {user ? (
            <Link
              href="/settings/plan"
              className="rounded-full bg-deep-brown text-background px-8 py-3 font-sans text-sm hover:bg-ink transition-colors"
              data-testid="pricing-manage"
            >
              Go to membership
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full bg-deep-brown text-background px-8 py-3 font-sans text-sm hover:bg-ink transition-colors"
                data-testid="pricing-create"
              >
                Create account
              </Link>
              <Link
                href="/login"
                className="rounded-full border border-border bg-surface/70 text-ink px-8 py-3 font-sans text-sm hover:border-accent-sepia transition-colors"
              >
                Sign in
              </Link>
            </>
          )}
        </div>

        <section className="mt-16 md:mt-20 max-w-[40rem] mx-auto">
          <h2 className="font-display text-2xl text-deep-brown text-center mb-8">
            Questions about membership
          </h2>
          <div className="flex flex-col">
            {FAQ.map((item) => (
              <div
                key={item.q}
                className="py-5 border-t border-border/70 first:border-0"
              >
                <p className="font-body text-lg text-ink mb-1.5">{item.q}</p>
                <p className="font-body text-soft-ink leading-relaxed">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
