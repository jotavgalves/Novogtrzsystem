import type BetterSqlite3 from 'better-sqlite3';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import type { technicalSchema } from './schema';

export interface DatabaseContext {
  readonly sqlite: BetterSqlite3.Database;
  readonly orm: BetterSQLite3Database<typeof technicalSchema>;
  readonly filePath: string;
  close(): void;
}
