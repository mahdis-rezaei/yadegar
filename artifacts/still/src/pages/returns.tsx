import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListMemories,
  useUpdateMemory,
  getListMemoriesQueryKey,
  type ReturnedMemory,
} from "@workspace/api-client-react";
import { AppNav } from "@/components/app-nav";
import { PageHeader } from "@/components/page";
import { MemoryCard } from "@/components/memory-card";

export default function Returns() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useListMemories();
  const updateMemory = useUpdateMemory();

  const memories = (data ?? []).filter((m) => !m.dismissed);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: getListMemoriesQueryKey() });
  }

  async function favorite(m: ReturnedMemory) {
    await updateMemory.mutateAsync({
      id: m.id,
      data: { favorite: !m.favorite },
    });
    invalidate();
  }

  async function dismiss(m: ReturnedMemory) {
    await updateMemory.mutateAsync({ id: m.id, data: { dismissed: true } });
    invalidate();
  }

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <AppNav />

      <main className="flex-1 w-full max-w-[680px] mx-auto px-6 py-12 md:py-16">
        <PageHeader
          title="Returns"
          subtitle="Pages Yadegar has brought back. They stay here for you to revisit."
        />

        <p className="-mt-4 mb-8">
          <Link
            href="/look-back"
            className="font-sans text-sm text-soft-ink hover:text-ink transition-colors"
          >
            Or look back through your own pages, by date and by the ones you
            treasured →
          </Link>
        </p>

        {isLoading ? (
          <p className="font-sans text-sm text-faint-ink">Gathering…</p>
        ) : memories.length === 0 ? (
          <div className="border border-border rounded-2xl bg-surface/60 p-10 text-center">
            <p className="font-body text-xl text-soft-ink mb-2">
              Nothing has returned yet.
            </p>
            <p className="font-body text-soft-ink mb-7">
              Write or bring in pages, and Yadegar will return something when there
              is something honest to return.
            </p>
            <Link
              href="/today"
              className="rounded-full bg-deep-brown text-background px-6 py-2.5 font-sans text-sm hover:bg-ink transition-colors"
            >
              Go to Today
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {memories.map((m) => (
              <MemoryCard
                key={m.id}
                memory={m}
                onFavorite={() => favorite(m)}
                onDismiss={() => dismiss(m)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
