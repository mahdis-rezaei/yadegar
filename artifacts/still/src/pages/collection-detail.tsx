import { useMemo, useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useListEntries } from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";
import {
  useCollection,
  useDeleteCollection,
  useRemoveFromCollection,
  useAddToCollection,
  KIND_LABEL,
  type CollectionItem,
} from "@/lib/use-collections";

function longDate(d: string | null): string {
  if (!d) return "Undated";
  const parsed = new Date(d + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return d;
  return parsed.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A short context snippet around the first mention of `name`, so a suggestion
// reads as "here's why this page matched" rather than a generic preview.
function snippetAround(body: string | null, name: string, len = 160): string {
  const b = (body ?? "").replace(/\s+/g, " ").trim();
  if (!b) return "";
  const i = b.toLowerCase().indexOf(name.toLowerCase());
  if (i < 0) return b.slice(0, len) + (b.length > len ? "…" : "");
  const start = Math.max(0, i - 48);
  const end = Math.min(b.length, i + name.length + 96);
  return (
    (start > 0 ? "… " : "") +
    b.slice(start, end).trim() +
    (end < b.length ? " …" : "")
  );
}

function ItemCard({
  item,
  onRemove,
}: {
  item: CollectionItem;
  onRemove: () => void;
}) {
  return (
    <div className="border border-border rounded-2xl bg-surface/70 p-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <span className="font-sans text-xs text-faint-ink">
          {longDate(item.entryDate)}
        </span>
        <button
          onClick={onRemove}
          className="font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors"
        >
          remove
        </button>
      </div>
      {item.title && item.title.trim() && (
        <p className="font-display text-lg text-deep-brown mb-1">{item.title}</p>
      )}
      <p className="font-body text-ink leading-relaxed whitespace-pre-wrap">
        {item.excerpt}
      </p>
      <Link
        href={`/library/${item.entryId}`}
        className="inline-block mt-4 font-sans text-sm text-accent-sepia hover:text-deep-brown border-b border-accent-sepia/40 pb-0.5 transition-colors"
      >
        Read the full page →
      </Link>
    </div>
  );
}

export default function CollectionDetail() {
  const [, params] = useRoute("/collections/:id");
  const [, setLocation] = useLocation();
  const id = params?.id ?? "";
  const { data, isLoading } = useCollection(id);
  const del = useDeleteCollection();
  const removeItem = useRemoveFromCollection();
  const addItem = useAddToCollection();
  const { data: entries } = useListEntries();
  const [showSuggest, setShowSuggest] = useState(false);

  async function deleteCollection() {
    await del.mutateAsync(id);
    setLocation("/collections");
  }

  const isPair = data?.kind === "pair" && data.items.length === 2;
  const isEmpty = !!data && data.items.length === 0;

  // Auto-suggest fill: scan the archive (client-side, decrypted) for pages that
  // mention the collection's name and aren't in it yet, so "Mom" populates in a
  // click instead of page-by-page. Word-boundary match (so "Mom" != "moment").
  const existingIds = useMemo(
    () => new Set((data?.items ?? []).map((i) => i.entryId)),
    [data],
  );
  const suggestions = useMemo(() => {
    const name = data?.name?.trim();
    if (!name || !entries) return [];
    let re: RegExp;
    try {
      re = new RegExp(`\\b${escapeRegex(name)}\\b`, "i");
    } catch {
      return [];
    }
    return entries
      .filter((e) => !existingIds.has(e.id))
      .filter((e) => re.test(e.body ?? "") || re.test(e.title ?? ""))
      .sort((a, b) => ((a.entryDate ?? "") < (b.entryDate ?? "") ? 1 : -1));
  }, [data, entries, existingIds]);

  // Empty collections open the finder straight away (it answers "now what?").
  const finderOpen = showSuggest || isEmpty;

  async function addAll(ids: string[]) {
    for (const entryId of ids) {
      await addItem.mutateAsync({ collectionId: id, entryId });
    }
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />
      <main className="flex-1 w-full max-w-[760px] mx-auto px-6 py-12 md:py-16">
        <Link
          href="/collections"
          className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
        >
          ← Collections
        </Link>

        {isLoading || !data ? (
          <p className="font-sans text-sm text-faint-ink mt-10">Opening…</p>
        ) : (
          <>
            <div className="flex items-end justify-between gap-4 mt-6 mb-8">
              <div>
                <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink mb-1">
                  {KIND_LABEL[data.kind]}
                </p>
                <h1 className="font-display text-4xl text-deep-brown">
                  {data.name}
                </h1>
              </div>
              <button
                onClick={deleteCollection}
                className="font-sans text-xs text-faint-ink hover:text-soft-ink transition-colors shrink-0"
              >
                delete collection
              </button>
            </div>

            {/* The pages already in this collection. */}
            {data.items.length > 0 &&
              (isPair ? (
                <div className="grid md:grid-cols-2 gap-5">
                  {(["Before", "After"] as const).map((label, i) => (
                    <div key={label}>
                      <p className="font-sans text-xs uppercase tracking-[0.2em] text-accent-sepia mb-3">
                        {label}
                      </p>
                      <ItemCard
                        item={data.items[i]}
                        onRemove={() =>
                          removeItem.mutate({
                            collectionId: id,
                            entryId: data.items[i].entryId,
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {data.items.map((item) => (
                    <ItemCard
                      key={item.entryId}
                      item={item}
                      onRemove={() =>
                        removeItem.mutate({
                          collectionId: id,
                          entryId: item.entryId,
                        })
                      }
                    />
                  ))}
                </div>
              ))}

            {/* Auto-suggest fill, not for the hand-paired "before & after" kind. */}
            {data.kind !== "pair" && (
              <section
                className={
                  data.items.length > 0
                    ? "mt-12 pt-8 border-t border-border/40"
                    : "mt-2"
                }
              >
                {isEmpty && (
                  <p className="font-body text-soft-ink mb-6 leading-relaxed">
                    Nothing here yet. Gather the pages that belong, start with
                    the ones that mention “{data.name}”.
                  </p>
                )}

                {!finderOpen ? (
                  <button
                    onClick={() => setShowSuggest(true)}
                    className="font-sans text-sm text-soft-ink hover:text-ink border border-border hover:border-accent-sepia rounded-full px-4 py-2 transition-colors"
                    data-testid="collection-find"
                  >
                    ✦ Find more pages that mention “{data.name}”
                    {suggestions.length ? ` (${suggestions.length})` : ""}
                  </button>
                ) : suggestions.length === 0 ? (
                  <p className="font-body text-soft-ink leading-relaxed">
                    No pages mention “{data.name}” by name
                    {entries ? "" : " (still gathering your pages…)"}. You can add
                    any page from its “Collections” control while reading it.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <p className="font-sans text-xs uppercase tracking-[0.18em] text-faint-ink">
                        Pages that mention “{data.name}” ({suggestions.length})
                      </p>
                      <button
                        onClick={() => addAll(suggestions.map((e) => e.id))}
                        className="font-sans text-xs text-accent-sepia hover:text-deep-brown transition-colors shrink-0"
                        data-testid="collection-addall"
                      >
                        Add all →
                      </button>
                    </div>
                    <div className="space-y-3">
                      {suggestions.slice(0, 60).map((e) => (
                        <div
                          key={e.id}
                          className="flex items-start justify-between gap-4 border border-border/70 rounded-xl bg-surface/50 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <span className="font-sans text-xs text-faint-ink">
                              {longDate(e.entryDate ?? null)}
                            </span>
                            <p className="font-body text-ink text-sm leading-relaxed mt-1">
                              {snippetAround(e.body ?? null, data.name)}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              addItem.mutate({ collectionId: id, entryId: e.id })
                            }
                            className="font-sans text-xs text-soft-ink hover:text-ink border border-border hover:border-accent-sepia rounded-full px-3 py-1.5 transition-colors shrink-0"
                          >
                            + Add
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
