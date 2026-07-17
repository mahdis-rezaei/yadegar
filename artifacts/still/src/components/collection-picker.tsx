import { useState } from "react";
import {
  useCollections,
  useCreateCollection,
  useAddToCollection,
  useRemoveFromCollection,
  KIND_LABEL,
  KIND_ORDER,
  type CollectionKind,
} from "@/lib/use-collections";

// The reader's "Add to collection" control: a popover of the user's collections
// (checked when this page is in them) + inline create. People/Places/Themes/
// thoughts/pairs are all just collections of a kind.
export function CollectionPicker({ entryId }: { entryId: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useCollections(entryId);
  const add = useAddToCollection();
  const remove = useRemoveFromCollection();
  const create = useCreateCollection();

  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<CollectionKind>("person");

  const collections = data ?? [];

  function toggle(collectionId: string, contains: boolean) {
    if (contains) remove.mutate({ collectionId, entryId });
    else add.mutate({ collectionId, entryId });
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    const c = await create.mutateAsync({ name: newName.trim(), kind: newKind });
    await add.mutateAsync({ collectionId: c.id, entryId });
    setNewName("");
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
      >
        Collections
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-64 rounded-xl border border-border bg-surface shadow-sm p-3">
            {collections.length > 0 && (
              <div className="max-h-56 overflow-auto mb-2">
                {collections.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id, c.containsEntry)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-background/50 transition-colors"
                  >
                    <span
                      className={
                        "text-sm " +
                        (c.containsEntry ? "text-accent-sepia" : "text-faint-ink")
                      }
                    >
                      {c.containsEntry ? "✓" : "+"}
                    </span>
                    <span className="font-sans text-sm text-ink flex-1 truncate">
                      {c.name}
                    </span>
                    <span className="font-sans text-[10px] uppercase tracking-wide text-faint-ink">
                      {KIND_LABEL[c.kind]}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <div className="border-t border-border/60 pt-2 space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New collection…"
                className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-sm font-sans text-ink focus:outline-none focus:border-accent-sepia"
              />
              <div className="flex gap-2">
                <select
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as CollectionKind)}
                  className="flex-1 bg-background border border-border rounded-lg px-2 py-1.5 text-xs font-sans text-soft-ink focus:outline-none"
                >
                  {KIND_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={createAndAdd}
                  disabled={create.isPending || !newName.trim()}
                  className="rounded-lg bg-deep-brown text-background px-3 py-1.5 font-sans text-xs hover:bg-ink transition-colors disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
