import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export type MemorySensitivity = "open" | "gentle" | "protected";

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: () =>
      customFetch<{ memorySensitivity: MemorySensitivity }>("/api/preferences", {
        responseType: "json",
      }),
  });
}

export function useSetMemorySensitivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (memorySensitivity: MemorySensitivity) =>
      customFetch("/api/preferences", {
        method: "PATCH",
        body: JSON.stringify({ memorySensitivity }),
        responseType: "json",
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["preferences"] });
      // Protected hides the in-app On This Day surface, refresh it.
      qc.invalidateQueries({ queryKey: ["on-this-day"] });
    },
  });
}
