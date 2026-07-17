import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";

// A ONE-TIME, dismissible "membership is here" announcement for free users —
// awareness, not nagging. Shown only once membership is actually purchasable
// (billing configured), only to free accounts, and never again after dismiss.
const DISMISS_KEY = "still:membership-announce";

export function MembershipAnnounceBanner() {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["billing-config"],
    queryFn: () =>
      customFetch<{ enabled?: boolean }>("/api/billing/config", {
        responseType: "json",
      }),
    staleTime: 60 * 60 * 1000,
  });
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.plan === "member") return null;
  if (data?.enabled !== true) return null;
  if (dismissed || localStorage.getItem(DISMISS_KEY) === "1") return null;

  return (
    <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-accent-sepia/30 bg-[#F3EAD7]/50 px-5 py-3.5">
      <Link
        href="/pricing"
        className="font-sans text-sm text-deep-brown hover:text-ink transition-colors"
        data-testid="banner-membership"
      >
        ✦ Membership is here: unlimited fresh returns across your years.{" "}
        <span className="underline underline-offset-2">See membership →</span>
      </Link>
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setDismissed(true);
        }}
        className="shrink-0 font-sans text-xs text-soft-ink hover:text-ink transition-colors"
        data-testid="button-dismiss-membership"
      >
        dismiss
      </button>
    </div>
  );
}
