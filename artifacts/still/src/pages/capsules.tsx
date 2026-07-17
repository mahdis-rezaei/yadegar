import { useState } from "react";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page";
import {
  useCapsules,
  useCreateCapsule,
  useOpenCapsule,
  type Capsule,
} from "@/lib/use-capsules";

type When = "1y" | "5y" | "10y" | "custom";

function longDate(d: string): string {
  const parsed = new Date(d);
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function computeDeliverAt(when: When, custom: string): string | null {
  if (when === "custom") {
    if (!custom) return null;
    const d = new Date(custom + "T12:00:00");
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const years = when === "1y" ? 1 : when === "5y" ? 5 : 10;
  const d = new Date();
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString();
}

function CapsuleCard({ capsule }: { capsule: Capsule }) {
  const open = useOpenCapsule();

  if (!capsule.delivered) {
    return (
      <div className="border border-border rounded-2xl bg-surface/40 p-6 text-center">
        <p className="font-display text-lg text-soft-ink">✉ Sealed</p>
        <p className="font-sans text-sm text-faint-ink mt-1">
          Opens {longDate(capsule.deliverAt)}
        </p>
      </div>
    );
  }

  if (!capsule.openedAt) {
    return (
      <div className="border border-accent-sepia/40 rounded-2xl bg-surface p-6 text-center">
        <p className="font-display text-lg text-deep-brown">
          A page from your past arrived.
        </p>
        <button
          onClick={() => open.mutate(capsule.id)}
          disabled={open.isPending}
          className="mt-4 rounded-full bg-deep-brown text-background px-6 py-2.5 font-sans text-sm hover:bg-ink transition-colors disabled:opacity-50"
        >
          Open it
        </button>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-2xl bg-surface/70 p-6 md:p-8">
      <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-3">
        Sealed {longDate(capsule.createdAt)} · opened {longDate(capsule.deliverAt)}
      </p>
      <p className="font-body text-ink leading-relaxed whitespace-pre-wrap">
        {capsule.body}
      </p>
    </div>
  );
}

export default function Capsules() {
  const { data, isLoading } = useCapsules();
  const create = useCreateCapsule();

  const [body, setBody] = useState("");
  const [when, setWhen] = useState<When>("1y");
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function seal() {
    setError(null);
    const deliverAt = computeDeliverAt(when, custom);
    if (!body.trim()) {
      setError("Write something first.");
      return;
    }
    if (!deliverAt) {
      setError("Choose a delivery date.");
      return;
    }
    try {
      await create.mutateAsync({ body: body.trim(), deliverAt });
      setBody("");
      setWhen("1y");
      setCustom("");
    } catch {
      setError("Could not seal that. Try again.");
    }
  }

  const capsules = data ?? [];

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <PageHeader
          title="Send to your future self"
          subtitle="Write a page and seal it for a later you. Once sealed, it can't be changed, a letter that waits."
        />

        {/* Compose */}
        <div className="rounded-2xl border border-border bg-surface/70 p-6 mb-12">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Dear future me…"
            rows={5}
            className="w-full bg-transparent text-lg text-ink font-body leading-relaxed placeholder:text-faint-ink/80 focus:outline-none resize-none"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 mt-3 border-t border-border/60">
            <span className="font-sans text-xs text-faint-ink">Deliver</span>
            <select
              value={when}
              onChange={(e) => setWhen(e.target.value as When)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-soft-ink font-sans focus:outline-none focus:border-accent-sepia"
            >
              <option value="1y">In 1 year</option>
              <option value="5y">In 5 years</option>
              <option value="10y">In 10 years</option>
              <option value="custom">On a date…</option>
            </select>
            {when === "custom" && (
              <input
                type="date"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-ink font-body focus:outline-none focus:border-accent-sepia"
              />
            )}
            <button
              onClick={seal}
              disabled={create.isPending}
              className="sm:ml-auto rounded-full bg-deep-brown text-background px-6 py-2.5 font-sans text-sm hover:bg-ink transition-colors disabled:opacity-50"
            >
              {create.isPending ? "Sealing…" : "Seal it"}
            </button>
          </div>
          {error && (
            <p className="font-sans text-sm text-red-700/80 mt-3">{error}</p>
          )}
        </div>

        {/* Existing capsules */}
        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Gathering…</p>
        ) : capsules.length === 0 ? (
          <p className="font-body text-soft-ink text-center">
            No capsules yet. The first page you seal will wait here.
          </p>
        ) : (
          <div className="space-y-4">
            {capsules.map((c) => (
              <CapsuleCard key={c.id} capsule={c} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
