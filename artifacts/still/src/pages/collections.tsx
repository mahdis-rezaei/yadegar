import { useState } from "react";
import { Link } from "wouter";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page";
import {
  useCollections,
  useCreateCollection,
  KIND_LABEL,
  KIND_ORDER,
  type CollectionKind,
  type CollectionSummary,
} from "@/lib/use-collections";

export default function Collections() {
  const { data, isLoading } = useCollections();
  const create = useCreateCollection();

  const [name, setName] = useState("");
  const [kind, setKind] = useState<CollectionKind>("person");

  async function add() {
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), kind });
    setName("");
  }

  const collections = data ?? [];
  const byKind = (k: CollectionKind): CollectionSummary[] =>
    collections.filter((c) => c.kind === k);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <PageHeader
          title="Collections"
          subtitle="The people, places, and questions that run through your pages, gathered by you, shown across the years. Nothing is interpreted; the pages simply sit together."
        />

        {/* New collection */}
        <div className="flex flex-col sm:flex-row gap-3 mb-12">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mom · London · the happiness question…"
            className="flex-1 bg-surface border border-border rounded-lg px-4 py-2.5 text-sm text-ink font-sans placeholder:text-faint-ink focus:outline-none focus:border-accent-sepia"
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CollectionKind)}
            className="bg-surface border border-border rounded-lg px-3 py-2.5 text-sm text-soft-ink font-sans focus:outline-none focus:border-accent-sepia"
          >
            {KIND_ORDER.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={create.isPending || !name.trim()}
            className="rounded-full bg-deep-brown text-background px-6 py-2.5 font-sans text-sm hover:bg-ink transition-colors disabled:opacity-50"
          >
            Create
          </button>
        </div>

        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Gathering…</p>
        ) : collections.length === 0 ? (
          <p className="font-body text-soft-ink">
            No collections yet. Make one above, then open any page and add it.
          </p>
        ) : (
          <div className="space-y-10">
            {KIND_ORDER.map((k) => {
              const group = byKind(k);
              if (group.length === 0) return null;
              return (
                <section key={k}>
                  <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-4">
                    {KIND_LABEL[k]}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {group.map((c) => (
                      <Link
                        key={c.id}
                        href={`/collections/${c.id}`}
                        className="block border border-border rounded-xl bg-surface/60 hover:border-accent-sepia transition-colors px-5 py-4"
                      >
                        <p className="font-display text-lg text-deep-brown">
                          {c.name}
                        </p>
                        <p className="font-sans text-xs text-faint-ink mt-0.5">
                          {c.itemCount} {c.itemCount === 1 ? "page" : "pages"}
                        </p>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
