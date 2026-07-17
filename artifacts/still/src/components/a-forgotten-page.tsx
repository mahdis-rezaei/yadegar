import { useEffect, useState } from "react";
import { type MemoryRunResult } from "@workspace/api-client-react";
import { runMemoryRequest } from "@/lib/run-job";
import { MemoryCard } from "@/components/memory-card";
import { DateMemoryCard } from "@/components/date-memory-card";
import { type DateMemory } from "@/lib/use-look-back";

// "A page you'd forgotten", an old page that's slipped out of view, read back in
// Yadegar's voice (not just a raw excerpt, which is what made this feel dead).
// Button-gated (so it never fires the engine just by being on screen), then
// "show another →" rotates through the forgotten set. If the engine stays silent
// on a thin page, we fall back to the raw page so it's never blank.
export function AForgottenPage({
  forgotten,
  onChanged,
}: {
  forgotten: DateMemory[];
  onChanged: () => void;
}) {
  const [i, setI] = useState(-1);
  const [pending, setPending] = useState(false);
  const [voice, setVoice] = useState<MemoryRunResult | null>(null);
  const current = i >= 0 ? forgotten[i] : undefined;

  // Voicing one page is a model read too, show calm, time-aware reassurance so
  // a few seconds' wait never reads as "stuck" (matches Today / what-keeps-returning).
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [pending]);

  async function show(next: number) {
    const entry = forgotten[next];
    if (!entry) return;
    setI(next);
    setVoice(null);
    setPending(true);
    try {
      setVoice(
        await runMemoryRequest("/api/memories/run", {
          entryIds: [entry.entryId],
        }),
      );
    } catch {
      setVoice({ surfaced: false, reason: "error" });
    } finally {
      setPending(false);
    }
  }

  // Pick a forgotten page at random so the first pull isn't always the same
  // (most-forgotten) page; when re-rolling, avoid repeating the current one.
  function pickIndex(exclude: number): number {
    const len = forgotten.length;
    if (len <= 1) return 0;
    if (exclude < 0) return Math.floor(Math.random() * len);
    let n = Math.floor(Math.random() * (len - 1));
    if (n >= exclude) n += 1;
    return n;
  }

  if (forgotten.length === 0) {
    return (
      <p className="font-body text-soft-ink leading-relaxed">
        Nothing's slipped far enough out of view yet, as your pages gather
        years, forgotten ones will surface here.
      </p>
    );
  }

  return (
    <div>
      {i < 0 && (
        <button
          onClick={() => show(pickIndex(i))}
          className="font-sans text-sm text-soft-ink hover:text-ink border border-border hover:border-accent-sepia rounded-full px-4 py-2 transition-colors"
          data-testid="forgotten-go"
        >
          ✦ Bring back a page you'd forgotten
        </button>
      )}

      {pending && (
        <div className="border border-border/70 rounded-2xl bg-surface/50 p-6">
          <p className="font-body text-soft-ink leading-relaxed">
            {elapsed < 12
              ? "Reading a page you'd set down…"
              : "Still reading, finding the words for it…"}
          </p>
        </div>
      )}

      {!pending && voice?.surfaced && voice.memory && (
        <MemoryCard memory={voice.memory} />
      )}

      {/* Engine stayed silent on a thin page, show the page itself, never blank. */}
      {!pending && voice && !voice.surfaced && current && (
        <DateMemoryCard
          heading="You haven't seen this in a while"
          memory={current}
          onChanged={onChanged}
        />
      )}

      {i >= 0 && !pending && forgotten.length > 1 && (
        <button
          onClick={() => show(pickIndex(i))}
          className="mt-3 font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
          data-testid="forgotten-again"
        >
          show another →
        </button>
      )}
    </div>
  );
}
