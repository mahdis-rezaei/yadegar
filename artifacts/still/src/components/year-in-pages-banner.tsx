import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

// "Your Year in Pages" is the most shareable, high-emotion artifact, so we
// surface it like Spotify Wrapped, at the two natural "look at my year" moments:
//   • New Year (late Dec features the year just lived; Jan features the one that
//     just ended), and
//   • the journaling anniversary (the month/day of your first page).
// Gentle and dismissible per occasion so it never nags.

function newYearFeatureYear(now: Date): number | null {
  const m = now.getMonth(); // 0–11
  if (m === 11 && now.getDate() >= 20) return now.getFullYear();
  if (m === 0) return now.getFullYear() - 1;
  return null;
}

type Summary = { firstEntryDate: string | null; count: number };

export function YearInPagesBanner() {
  const { data } = useQuery({
    queryKey: ["entries-summary"],
    queryFn: () =>
      customFetch<Summary>("/api/entries/summary", { responseType: "json" }),
    staleTime: 24 * 60 * 60 * 1000,
  });

  const now = new Date();

  // Anniversary: today shares the month/day of the first entry, ≥1 year on.
  let anniversaryYears = 0;
  const first = data?.firstEntryDate;
  if (first && /^\d{4}-\d{2}-\d{2}$/.test(first)) {
    const f = new Date(`${first}T00:00:00Z`);
    if (
      f.getUTCMonth() === now.getMonth() &&
      f.getUTCDate() === now.getDate()
    ) {
      anniversaryYears = now.getFullYear() - f.getUTCFullYear();
    }
  }

  const nyYear = newYearFeatureYear(now);

  // Anniversary takes precedence (rarer, more personal); else the New Year window.
  const occasion =
    anniversaryYears >= 1
      ? {
          year: now.getFullYear() - 1,
          dismissKey: `still:yip-anniv:${now.getFullYear()}`,
          text: `✦ ${anniversaryYears} ${anniversaryYears === 1 ? "year" : "years"} of writing here, as of today`,
        }
      : nyYear
        ? {
            year: nyYear,
            dismissKey: `still:yip-newyear:${nyYear}`,
            text: `✦ Your ${nyYear} in pages is ready`,
          }
        : null;

  const [dismissed, setDismissed] = useState(false);
  if (!occasion) return null;
  if (dismissed || localStorage.getItem(occasion.dismissKey) === "1")
    return null;

  return (
    <div className="mb-8 flex items-center justify-between gap-4 rounded-2xl border border-accent-sepia/30 bg-[#F3EAD7]/50 px-5 py-3.5">
      <Link
        href={`/letters/${occasion.year}`}
        className="font-sans text-sm text-deep-brown hover:text-ink transition-colors"
        data-testid="banner-year-in-pages"
      >
        {occasion.text}.{" "}
        <span className="underline underline-offset-2">
          look back on a year →
        </span>
      </Link>
      <button
        onClick={() => {
          localStorage.setItem(occasion.dismissKey, "1");
          setDismissed(true);
        }}
        className="shrink-0 font-sans text-xs text-soft-ink hover:text-ink transition-colors"
        data-testid="button-dismiss-yip"
      >
        dismiss
      </button>
    </div>
  );
}
