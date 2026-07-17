import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type CollectionKind =
  | "person"
  | "place"
  | "theme"
  | "thought"
  | "pair"
  | "custom";

export interface CollectionSummary {
  id: string;
  name: string;
  kind: CollectionKind;
  createdAt: string;
  itemCount: number;
  containsEntry: boolean;
}

export interface CollectionItem {
  entryId: string;
  title: string | null;
  excerpt: string;
  entryDate: string | null;
}

export interface CollectionDetail {
  id: string;
  name: string;
  kind: CollectionKind;
  items: CollectionItem[];
}

// When entryId is passed, each summary's `containsEntry` reflects membership of
// that page (for the reader's picker).
export function useCollections(entryId?: string) {
  return useQuery({
    queryKey: ["collections", entryId ?? "all"],
    queryFn: () =>
      customFetch<CollectionSummary[]>(
        `/api/collections${entryId ? `?entryId=${entryId}` : ""}`,
        { responseType: "json" },
      ),
  });
}

export function useCollection(id: string) {
  return useQuery({
    queryKey: ["collection", id],
    queryFn: () =>
      customFetch<CollectionDetail>(`/api/collections/${id}`, {
        responseType: "json",
      }),
    enabled: !!id,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["collections"] });
}

export function useCreateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { name: string; kind: CollectionKind }) =>
      customFetch<CollectionSummary>("/api/collections", {
        method: "POST",
        body: JSON.stringify(b),
        responseType: "json",
      }),
    onSuccess: () => invalidate(qc),
  });
}

export function useDeleteCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch(`/api/collections/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidate(qc),
  });
}

export function useAddToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { collectionId: string; entryId: string }) =>
      customFetch(`/api/collections/${b.collectionId}/items`, {
        method: "POST",
        body: JSON.stringify({ entryId: b.entryId }),
        responseType: "json",
      }),
    onSuccess: (_d, b) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ["collection", b.collectionId] });
    },
  });
}

export function useRemoveFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { collectionId: string; entryId: string }) =>
      customFetch(`/api/collections/${b.collectionId}/items/${b.entryId}`, {
        method: "DELETE",
      }),
    onSuccess: (_d, b) => {
      invalidate(qc);
      qc.invalidateQueries({ queryKey: ["collection", b.collectionId] });
    },
  });
}

export const KIND_LABEL: Record<CollectionKind, string> = {
  person: "People",
  place: "Places",
  theme: "Themes",
  thought: "Thoughts over time",
  pair: "Before & after",
  custom: "Other",
};

export const KIND_ORDER: CollectionKind[] = [
  "person",
  "place",
  "theme",
  "thought",
  "pair",
  "custom",
];
