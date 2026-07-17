import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface ResurfaceMute {
  id: string;
  startDate: string;
  endDate: string;
  createdAt: string;
}

// Muting changes what every surfacer returns, so invalidate those too.
function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["resurface-mutes"] });
  qc.invalidateQueries({ queryKey: ["look-back"] });
  qc.invalidateQueries({ queryKey: ["on-this-day"] });
}

export function useResurfaceMutes() {
  return useQuery({
    queryKey: ["resurface-mutes"],
    queryFn: () =>
      customFetch<ResurfaceMute[]>("/api/resurface-mutes", {
        responseType: "json",
      }),
  });
}

export function useAddResurfaceMute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { startDate: string; endDate: string }) =>
      customFetch<ResurfaceMute>("/api/resurface-mutes", {
        method: "POST",
        body: JSON.stringify(body),
        responseType: "json",
      }),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRemoveResurfaceMute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<void>(`/api/resurface-mutes/${id}`, { method: "DELETE" }),
    onSuccess: () => invalidateAll(qc),
  });
}
