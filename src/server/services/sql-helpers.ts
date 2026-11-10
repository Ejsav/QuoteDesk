import { sql, type SQL } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

/** Case-insensitive substring match with LIKE wildcards in user input escaped. */
export function contains(column: SQLiteColumn | SQL, query: string): SQL {
  const escaped = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  return sql`${column} like ${`%${escaped}%`} escape '\\'`;
}

export function clampPage(page: number | undefined): number {
  return Number.isFinite(page) && page && page > 0 ? Math.floor(page) : 1;
}

export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export function pageOf<T>(rows: T[], total: number, page: number, pageSize: number): Page<T> {
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}
