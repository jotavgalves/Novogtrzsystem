import { copyFile, rename, rm } from 'node:fs/promises';

import {
  ensureControlDefaults,
  openDatabase,
  type DatabaseContext,
  verifyDatabaseFile,
  verifyDatabaseIntegrity,
} from '@gtrz/database';

export class DatabaseRuntime {
  readonly #filePath: string;
  #database: DatabaseContext;

  constructor(filePath: string) {
    this.#filePath = filePath;
    this.#database = this.#openVerified();
  }

  get filePath(): string {
    return this.#filePath;
  }

  get(): DatabaseContext {
    return this.#database;
  }

  isReady(): boolean {
    return this.#database.sqlite.open;
  }

  close(): void {
    this.#database.close();
  }

  async replaceWith(snapshotPath: string): Promise<void> {
    if (!verifyDatabaseFile(snapshotPath)) {
      throw new Error('O banco contido no backup não passou na verificação de integridade.');
    }

    const incomingPath = `${this.#filePath}.incoming`;
    const rollbackPath = `${this.#filePath}.rollback`;
    let rollbackCreated = false;
    let incomingActivated = false;

    await rm(incomingPath, { force: true });
    await rm(rollbackPath, { force: true });
    await copyFile(snapshotPath, incomingPath);

    if (!verifyDatabaseFile(incomingPath)) {
      await rm(incomingPath, { force: true });
      throw new Error('A cópia temporária do banco restaurado ficou inválida.');
    }

    this.#database.close();

    try {
      await this.#removeSidecars();
      await rename(this.#filePath, rollbackPath);
      rollbackCreated = true;
      await rename(incomingPath, this.#filePath);
      incomingActivated = true;
      this.#database = this.#openVerified();
      await rm(rollbackPath, { force: true });
    } catch (error: unknown) {
      if (incomingActivated) {
        await rm(this.#filePath, { force: true });
      }

      if (rollbackCreated) {
        await rename(rollbackPath, this.#filePath);
      }

      this.#database = this.#openVerified();
      throw error;
    } finally {
      await rm(incomingPath, { force: true });
      await rm(rollbackPath, { force: true });
    }
  }

  #openVerified(): DatabaseContext {
    const database = openDatabase(this.#filePath);
    ensureControlDefaults(database);

    if (!verifyDatabaseIntegrity(database)) {
      database.close();
      throw new Error('A verificação de integridade do banco local falhou.');
    }

    return database;
  }

  async #removeSidecars(): Promise<void> {
    await Promise.all([
      rm(`${this.#filePath}-wal`, { force: true }),
      rm(`${this.#filePath}-shm`, { force: true }),
    ]);
  }
}
