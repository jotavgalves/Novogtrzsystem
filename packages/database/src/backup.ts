import BetterSqlite3 from 'better-sqlite3';

import type { DatabaseContext } from './types';

export async function createDatabaseSnapshot(
  database: DatabaseContext,
  destinationPath: string,
): Promise<void> {
  await database.sqlite.backup(destinationPath);

  if (!verifyDatabaseFile(destinationPath)) {
    throw new Error('O snapshot SQLite gerado não passou na verificação de integridade.');
  }
}

export function verifyDatabaseFile(filePath: string): boolean {
  let sqlite: BetterSqlite3.Database | null = null;

  try {
    sqlite = new BetterSqlite3(filePath, {
      fileMustExist: true,
      readonly: true,
    });
    const result = sqlite.pragma('quick_check', { simple: true });
    return result === 'ok';
  } catch {
    return false;
  } finally {
    sqlite?.close();
  }
}
