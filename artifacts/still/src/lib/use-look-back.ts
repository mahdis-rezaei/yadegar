import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  localTodayISO,
  type OnThisDayMemory,
} from "@/lib/use-on-this-day";

// A date-based memory without the exact-day flag (around-this-time, favorites).
export interface DateMemory {
  entryId: string;
  title: string | null;
  excerpt: string;
  entryDate: string;
  favorite: boolean;
  yearsAgo: number;
}

// The Look Back browse payload, every date-based way a page returns, gathered.
// Mirrors GET /memories/look-back. Hand-written until codegen is run.
export interface LookBack {
  onThisDay: OnThisDayMemory[];
  aroundThisTime: DateMemory[];
  favorites: DateMemory[];
  forgotten: DateMemory[];
}

export function useLookBack() {
  const date = localTodayISO();
  return useQuery({
    queryKey: ["look-back", date],
    queryFn: () =>
      customFetch<LookBack>(`/api/memories/look-back?date=${date}`, {
        responseType: "json",
      }),
    staleTime: 60 * 60 * 1000,
  });
}
