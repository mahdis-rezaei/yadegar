import { useContinuity } from "@/lib/use-continuity";

function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? "" : "s"}`;
}

// A quiet archival card: continuity, not consistency. No streaks, no "you missed
// a day", only the accumulation of a life on the page. Renders nothing for an
// empty archive.
export function ContinuityCard() {
  const { data } = useContinuity();
  if (!data || data.pageCount === 0) return null;

  const stats: string[] = [plural(data.pageCount, "page")];
  if (data.spanYears && data.spanYears >= 1) {
    stats.push(`spanning ${plural(data.spanYears, "year")}`);
  }
  if (data.oldestPageAgeYears && data.oldestPageAgeYears >= 1) {
    stats.push(`your oldest page is ${plural(data.oldestPageAgeYears, "year")} old`);
  }
  if (data.reflectionCount >= 1) {
    stats.push(plural(data.reflectionCount, "reflection"));
  }

  const milestones: string[] = [];
  if (data.wroteFirstReflectionToday) {
    milestones.push("You wrote your first reflection today.");
  }
  if (data.oldestImportedAgeYears && data.oldestImportedAgeYears >= 1) {
    milestones.push(
      `Your first imported journal is now ${plural(
        data.oldestImportedAgeYears,
        "year",
      )} old.`,
    );
  }

  return (
    <div className="mb-8 rounded-2xl border border-border bg-surface/50 px-6 py-5">
      {data.writingSinceYear && (
        <p className="font-display text-lg text-deep-brown">
          You've been writing here since {data.writingSinceYear}.
        </p>
      )}
      <p className="font-sans text-sm text-soft-ink mt-1 leading-relaxed">
        {stats.join(" · ")}
      </p>
      {milestones.map((m) => (
        <p key={m} className="font-body text-sm text-accent-sepia/90 mt-3">
          {m}
        </p>
      ))}
    </div>
  );
}
