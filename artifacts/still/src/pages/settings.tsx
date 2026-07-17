import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page";

export default function Settings() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <PageHeader title="Settings" />


        <section className="mb-10">
          <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
            Account
          </p>
          <Link
            href="/settings/profile"
            className="block border border-border rounded-xl bg-surface/60 p-5 hover:border-accent-sepia transition-colors"
          >
            {user?.name && (
              <p className="font-body text-lg text-ink">{user.name}</p>
            )}
            <p className="font-body text-soft-ink">{user?.email}</p>
            <p className="font-sans text-sm text-soft-ink mt-2">
              Edit your profile →
            </p>
          </Link>
        </section>

        <section className="mb-10">
          <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
            Membership
          </p>
          <Link
            href="/settings/plan"
            className="block border border-border rounded-xl bg-surface/60 p-5 hover:border-accent-sepia transition-colors"
          >
            {user?.plan === "member" ? (
              <>
                <p className="font-body text-lg text-ink">Member</p>
                <p className="font-body text-soft-ink text-sm mt-1 leading-relaxed">
                  Unlimited fresh returns across your years. Manage membership →
                </p>
              </>
            ) : (
              <>
                <p className="font-body text-lg text-ink">Your journal, free</p>
                <p className="font-body text-soft-ink text-sm mt-1 leading-relaxed">
                  Writing, keeping, importing, and revisiting the pages that return
                  to you are always free and unlimited.
                </p>
                {user?.usage && user.usage.limit != null && (
                  <p className="font-body text-sm text-faint-ink mt-3">
                    Fresh returns this month: {user.usage.used} of about{" "}
                    {user.usage.limit}.
                  </p>
                )}
                <p className="font-sans text-sm text-soft-ink mt-3">
                  See membership →
                </p>
              </>
            )}
          </Link>
        </section>

        <section className="mb-10">
          <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
            Nudges
          </p>
          <Link
            href="/settings/notifications"
            className="block border border-border rounded-xl bg-surface/60 p-5 hover:border-accent-sepia transition-colors"
          >
            <p className="font-body text-lg text-ink">Reminders</p>
            <p className="font-body text-soft-ink text-sm mt-1">
              A gentle nudge to write, or a page brought back, your cadence, off
              by default.
            </p>
          </Link>
        </section>

        <section className="mb-10">
          <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
            What returns
          </p>
          <Link
            href="/settings/resurfacing"
            className="block border border-border rounded-xl bg-surface/60 p-5 hover:border-accent-sepia transition-colors"
          >
            <p className="font-body text-lg text-ink">Muted periods</p>
            <p className="font-body text-soft-ink text-sm mt-1">
              Fence off a season you'd rather not have return, without deleting
              a thing.
            </p>
          </Link>
        </section>

        <section className="mb-10">
          <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
            Your data
          </p>
          <Link
            href="/settings/privacy"
            className="block border border-border rounded-xl bg-surface/60 p-5 hover:border-accent-sepia transition-colors"
          >
            <p className="font-body text-lg text-ink">Privacy &amp; your pages</p>
            <p className="font-body text-soft-ink text-sm mt-1">
              Export everything, or delete your account, anytime.
            </p>
          </Link>
          <p className="font-body text-sm text-faint-ink mt-3 leading-relaxed">
            Your pages are private. Yadegar never shares your journals, they're
            encrypted at rest, and yours to export or delete whenever you like.
          </p>
          <Link
            href="/philosophy"
            className="inline-block mt-3 font-sans text-sm text-soft-ink hover:text-ink transition-colors"
          >
            The Yadegar philosophy →
          </Link>
        </section>

        <section className="mb-10">
          <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
            Help
          </p>
          <Link
            href="/help"
            className="block border border-border rounded-xl bg-surface/60 p-5 hover:border-accent-sepia transition-colors"
          >
            <p className="font-body text-lg text-ink">Help &amp; FAQ</p>
            <p className="font-body text-soft-ink text-sm mt-1">
              Answers to common questions about every part of Yadegar.
            </p>
          </Link>
        </section>

        <button
          onClick={async () => {
            await logout();
            setLocation("/login");
          }}
          className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
          data-testid="button-signout"
        >
          Sign out
        </button>
      </main>
    </div>
  );
}
