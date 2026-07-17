import { useQuery } from "@tanstack/react-query";
import { customFetch, type ReturnedMemory } from "@workspace/api-client-react";

// One date-based memory: a past page from the same calendar day in a prior year.
// Shape mirrors GET /memories/on-this-day. Hand-written (rather than codegen'd)
// because this returns a view-model rather than a stored entity; once
// `pnpm --filter @workspace/api-spec run codegen` is run, the generated
// `useGetOnThisDay` hook can replace this.
export interface OnThisDayMemory {
  entryId: string;
  title: string | null;
  excerpt: string;
  entryDate: string;
  favorite: boolean;
  yearsAgo: number;
  onThisExactDay: boolean;
}

// "A year ago today" / "7 years ago, around this day", honest about whether
// it's the exact calendar day or merely near it. Shared by the Today section
// and the Look Back browse.
export function onThisDayLabel(m: {
  yearsAgo: number;
  onThisExactDay: boolean;
}): string {
  const span = m.yearsAgo === 1 ? "A year ago" : `${m.yearsAgo} years ago`;
  return m.onThisExactDay ? `${span} today` : `${span}, around this day`;
}

export function localTodayISO(): string {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

export function useOnThisDay() {
  const date = localTodayISO();
  return useQuery({
    queryKey: ["on-this-day", date],
    queryFn: () =>
      customFetch<OnThisDayMemory[]>(
        `/api/memories/on-this-day?date=${date}`,
        { responseType: "json" },
      ),
    // The calendar day only changes daily; don't refetch on every focus.
    staleTime: 60 * 60 * 1000,
  });
}

// The VOICED on-this-day surface, the engine scoped to this date's entries, so
// the lead reads in Yadegar's voice instead of a raw excerpt. Slower than the raw
// list (a model read on first compute, then cached), so it's fetched separately
// and loaded progressively: the raw list renders instantly, this enriches it.
export interface OnThisDayFramed {
  exact: boolean;
  years: OnThisDayMemory[];
  framed: ReturnedMemory | null;
}

export function useOnThisDayFramed(enabled: boolean) {
  const date = localTodayISO();
  return useQuery({
    queryKey: ["on-this-day-framed", date],
    queryFn: () =>
      customFetch<OnThisDayFramed>(
        `/api/memories/on-this-day/framed?date=${date}`,
        { responseType: "json" },
      ),
    enabled,
    staleTime: 60 * 60 * 1000,
    // The voice pass is a slow model read; one shot, no retry-storm.
    retry: false,
  });
}
