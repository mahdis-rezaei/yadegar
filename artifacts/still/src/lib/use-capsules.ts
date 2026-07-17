import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface Capsule {
  id: string;
  createdAt: string;
  deliverAt: string;
  delivered: boolean;
  openedAt: string | null;
  body: string | null;
}

export function useCapsules() {
  return useQuery({
    queryKey: ["capsules"],
    queryFn: () =>
      customFetch<Capsule[]>("/api/capsules", { responseType: "json" }),
  });
}

export function useCreateCapsule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: { body: string; deliverAt: string }) =>
      customFetch<Capsule>("/api/capsules", {
        method: "POST",
        body: JSON.stringify(b),
        responseType: "json",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capsules"] }),
  });
}

export function useOpenCapsule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customFetch<Capsule>(`/api/capsules/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ opened: true }),
        responseType: "json",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["capsules"] }),
  });
}
