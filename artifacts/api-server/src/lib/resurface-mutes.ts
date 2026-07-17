import { sql, type SQL } from "drizzle-orm";
import { journalEntriesTable, resurfaceMutesTable } from "@workspace/db";

// SQL predicate: the entry's date is NOT inside any of the user's muted ranges.
// Shared by every date-based surfacer and the engine, so a muted season never
// resurfaces by any path. (Undated entries are never date-resurfaced anyway, so
// a NULL entry_date simply isn't matched by BETWEEN.)
export function notMutedSql(userId: string): SQL {
  return sql`not exists (select 1 from ${resurfaceMutesTable} where ${resurfaceMutesTable.userId} = ${userId} and ${journalEntriesTable.entryDate} between ${resurfaceMutesTable.startDate} and ${resurfaceMutesTable.endDate})`;
}
