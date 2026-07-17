import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

// Archival continuity metrics (the anti-streak) + gentle true-now milestones.
// Mirrors GET /continuity. Hand-written until codegen is run.
export interface Continuity {
  pageCount: number;
  writingSinceYear: number | null;
  spanYears: number | null;
  oldestPageAgeYears: number | null;
  reflectionCount: number;
  oldestImportedAgeYears: number | null;
  wroteFirstReflectionToday: boolean;
}

export function useContinuity() {
  return useQuery({
    queryKey: ["continuity"],
    queryFn: () =>
      customFetch<Continuity>("/api/continuity", { responseType: "json" }),
    staleTime: 60 * 60 * 1000,
  });
}
