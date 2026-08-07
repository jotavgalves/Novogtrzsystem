import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DatabaseRuntime } from '../../apps/desktop/src/main/database-runtime';
import { createEvent, listEvents, openDatabase } from '../../packages/database/src/index';

let temporaryDirectory: string | null = null;

afterEach(async () => {
  if (temporaryDirectory !== null) {
    await rm(temporaryDirectory, { force: true, recursive: true });
    temporaryDirectory = null;
  }
});

describe('DatabaseRuntime', () => {
  it('troca a base por um snapshot válido e mantém a nova conexão operacional', async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-runtime-'));
    const activePath = path.join(temporaryDirectory, 'active.sqlite');
    const replacementPath = path.join(temporaryDirectory, 'replacement.sqlite');
    const runtime = new DatabaseRuntime(activePath);
    createEvent(runtime.get(), { name: 'Evento original', startsAt: Date.now() });

    const replacement = openDatabase(replacementPath);
    createEvent(replacement, { name: 'Evento restaurado', startsAt: Date.now() });
    replacement.close();

    await runtime.replaceWith(replacementPath);

    expect(listEvents(runtime.get()).map((event) => event.name)).toEqual(['Evento restaurado']);
    expect(runtime.isReady()).toBe(true);
    runtime.close();
  });

  it('rejeita arquivo inválido antes da troca e preserva a base atual', async () => {
    temporaryDirectory = await mkdtemp(path.join(tmpdir(), 'gtrz-runtime-'));
    const activePath = path.join(temporaryDirectory, 'active.sqlite');
    const invalidPath = path.join(temporaryDirectory, 'invalid.sqlite');
    const runtime = new DatabaseRuntime(activePath);
    createEvent(runtime.get(), { name: 'Evento preservado', startsAt: Date.now() });
    await writeFile(invalidPath, 'não é sqlite', 'utf8');

    await expect(runtime.replaceWith(invalidPath)).rejects.toThrow(
      'não passou na verificação de integridade',
    );
    expect(listEvents(runtime.get()).map((event) => event.name)).toContain('Evento preservado');
    runtime.close();
  });
});
