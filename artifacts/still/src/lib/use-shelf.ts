import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface ShelfItem {
  entryId: string;
  title: string | null;
  excerpt: string;
  entryDate: string | null;
  favorite: boolean;
}

export function useShelf() {
  return useQuery({
    queryKey: ["shelf"],
    queryFn: () =>
      customFetch<ShelfItem[]>("/api/shelf", { responseType: "json" }),
  });
}

export function useAddToShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      customFetch("/api/shelf", {
        method: "POST",
        body: JSON.stringify({ entryId }),
        responseType: "json",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shelf"] }),
  });
}

export function useRemoveFromShelf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (entryId: string) =>
      customFetch(`/api/shelf/${entryId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shelf"] }),
  });
}
