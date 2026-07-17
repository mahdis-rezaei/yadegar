import { useShelf, useAddToShelf, useRemoveFromShelf } from "@/lib/use-shelf";

// A quiet "keep this nearby" control for an entry. The Shelf is the small,
// currently-meaningful collection (distinct from Favorites). Shown on the full
// page reader.
export function ShelfToggle({ entryId }: { entryId: string }) {
  const { data } = useShelf();
  const add = useAddToShelf();
  const remove = useRemoveFromShelf();

  const onShelf = !!data?.some((i) => i.entryId === entryId);
  const pending = add.isPending || remove.isPending;

  return (
    <button
      onClick={() => (onShelf ? remove.mutate(entryId) : add.mutate(entryId))}
      disabled={pending}
      className={
        "font-sans text-sm transition-colors disabled:opacity-50 " +
        (onShelf
          ? "text-accent-sepia hover:text-deep-brown"
          : "text-soft-ink hover:text-ink")
      }
      data-testid="button-shelf-toggle"
    >
      {onShelf ? "On your shelf · remove" : "Add to shelf"}
    </button>
  );
}
