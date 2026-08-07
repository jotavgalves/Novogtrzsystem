import { useCallback, useEffect, useState } from 'react';

import type { BackupRecord, BackupState } from '@gtrz/contracts';

import { useSession } from '../../shared/session/session-context';

interface BackupsViewState {
  readonly state: BackupState | null;
  readonly loading: boolean;
  readonly busy: boolean;
  readonly error: string | null;
  readonly message: string | null;
  readonly reload: () => Promise<void>;
  readonly chooseDestination: () => Promise<void>;
  readonly createManual: () => Promise<void>;
  readonly importBackup: () => Promise<void>;
  readonly verify: (record: BackupRecord) => Promise<void>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a operação de backup.';
}

export function useBackups(): BackupsViewState {
  const [state, setState] = useState<BackupState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { refresh: refreshSession } = useSession();

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setState(await window.gtrz.backups.getState());
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const run = useCallback(async (operation: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      await operation();
    } catch (operationError: unknown) {
      setError(getErrorMessage(operationError));
    } finally {
      setBusy(false);
    }
  }, []);

  const chooseDestination = useCallback(async (): Promise<void> => {
    await run(async () => {
      setState(await window.gtrz.backups.chooseDestination());
      setMessage('Destino dos backups atualizado.');
    });
  }, [run]);

  const createManual = useCallback(async (): Promise<void> => {
    await run(async () => {
      const backup = await window.gtrz.backups.createManual();
      await reload();
      setMessage(`Backup ${backup.fileName} criado e verificado.`);
    });
  }, [reload, run]);

  const importBackup = useCallback(async (): Promise<void> => {
    await run(async () => {
      const result = await window.gtrz.backups.importBackup();

      if (result.status === 'cancelled') {
        setMessage('Importação cancelada. Nenhum dado foi alterado.');
        return;
      }

      await refreshSession();
      await reload();
      setMessage(`Backup ${result.sourceFileName} restaurado com sucesso.`);
    });
  }, [refreshSession, reload, run]);

  const verify = useCallback(
    async (record: BackupRecord): Promise<void> => {
      await run(async () => {
        const verified = await window.gtrz.backups.verify({ filePath: record.filePath });
        setState((current) => {
          if (current === null) {
            return current;
          }

          return {
            ...current,
            backups: current.backups.map((item) =>
              item.filePath === verified.filePath ? verified : item,
            ),
          };
        });
        setMessage(
          verified.integrity === 'valid'
            ? `${verified.fileName} está íntegro.`
            : `${verified.fileName} está corrompido.`,
        );
      });
    },
    [run],
  );

  return {
    state,
    loading,
    busy,
    error,
    message,
    reload,
    chooseDestination,
    createManual,
    importBackup,
    verify,
  };
}
