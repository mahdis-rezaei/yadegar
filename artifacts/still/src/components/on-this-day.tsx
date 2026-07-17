import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useOnThisDay,
  useOnThisDayFramed,
  onThisDayLabel,
} from "@/lib/use-on-this-day";
import { usePreferences } from "@/lib/use-preferences";
import { DateMemoryCard } from "@/components/date-memory-card";
import { MemoryCard } from "@/components/memory-card";

// The On This Day section on Today. Stays SILENT (renders nothing) when there's
// nothing from this day in years past, never an empty box, never a nudge to
// look. A quiet link leads to the fuller Look Back browse. In "protected"
// memory-sensitivity, it doesn't auto-surface at all (nothing returns unbidden).
//
// The LEAD is voiced: the engine, scoped to just this date's entries, frames one
// line in Yadegar's voice (Facebook-Memories, but warm). Because that's a model
// read (slow on first compute, cached after), it loads PROGRESSIVELY, the raw
// most-recent page shows instantly and is replaced by the voiced card when ready,
// so the section is never blank or blocking. A collapsible year ladder lets you
// step through each year on this date (birthdays, anniversaries).
export function OnThisDay() {
  const queryClient = useQueryClient();
  const { data: prefs } = usePreferences();
  const { data: raw, isLoading } = useOnThisDay();
  const [showYears, setShowYears] = useState(false);

  const isProtected = prefs?.memorySensitivity === "protected";
  // Strict "On this day": only pages from the EXACT calendar day in prior years.
  // (Cross-year reflection lives in Then & Now on Look Back.) Silent otherwise.
  const years = (raw ?? []).filter((m) => m.onThisExactDay);
  const hasYears = years.length > 0;

  // Only run the (model-backed) voice pass when we'll actually show it.
  const framedQ = useOnThisDayFramed(!isProtected && hasYears);
  const framed = framedQ.data?.framed ?? null;

  if (isProtected) return null;
  if (isLoading || !hasYears) return null;

  const lead = years[0];
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["on-this-day"] });

  return (
    <section className="mb-10">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-display text-2xl text-deep-brown">On this day</h2>
        <Link
          href="/look-back"
          className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
        >
          Look back →
        </Link>
      </div>

      {/* Voiced highlight first; while it computes, the raw lead shows instantly. */}
      {framed ? (
        <MemoryCard memory={framed} />
      ) : (
        <div className="space-y-2">
          <DateMemoryCard
            heading={onThisDayLabel(lead)}
            memory={lead}
            onChanged={refresh}
          />
          {framedQ.isLoading && (
            <p className="font-sans text-xs text-faint-ink pl-1">
              Yadegar is reading this day…
            </p>
          )}
        </div>
      )}

      {/* Year ladder, step through each year on this date. */}
      {years.length > 1 && (
        <div className="mt-4">
          <button
            onClick={() => setShowYears((v) => !v)}
            className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
          >
            {showYears
              ? "Hide other years"
              : `See each year (${years.length})`}
          </button>
          {showYears && (
            <div className="space-y-4 mt-4">
              {years.map((m) => (
                <DateMemoryCard
                  key={m.entryId}
                  heading={onThisDayLabel(m)}
                  memory={m}
                  onChanged={refresh}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
