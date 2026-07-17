import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";

export interface LetterFavorite {
  entryId: string;
  title: string | null;
  excerpt: string;
  entryDate: string;
}

export interface YearLetter {
  year: number;
  pageCount: number;
  reflectionCount: number;
  favorites: LetterFavorite[];
}

// Mirrors GET /letters/:year. Hand-written until codegen is run.
export function useYearLetter(year: number) {
  return useQuery({
    queryKey: ["year-letter", year],
    queryFn: () =>
      customFetch<YearLetter>(`/api/letters/${year}`, { responseType: "json" }),
    staleTime: 60 * 60 * 1000,
  });
}
