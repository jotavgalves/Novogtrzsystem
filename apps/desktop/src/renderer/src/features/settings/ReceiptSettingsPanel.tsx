import { Printer, RefreshCw, Save } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ReceiptPrinter, ReceiptSettings } from '@gtrz/contracts';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível carregar a impressão térmica.';
}

export function ReceiptSettingsPanel(): React.JSX.Element {
  const [settings, setSettings] = useState<ReceiptSettings | null>(null);
  const [printers, setPrinters] = useState<readonly ReceiptPrinter[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const [nextSettings, nextPrinters] = await Promise.all([
        window.gtrz.receipts.getSettings(),
        window.gtrz.receipts.listPrinters(),
      ]);
      setSettings(nextSettings);
      setPrinters(nextPrinters);
    } catch (loadError: unknown) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(): Promise<void> {
    if (settings === null) {
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      setSettings(await window.gtrz.receipts.updateSettings(settings));
      setMessage('Configuração de impressão salva.');
    } catch (saveError: unknown) {
      setError(getErrorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <article className="panel form-panel receipt-settings-panel">
      <div className="panel__heading receipt-settings-panel__heading">
        <Printer size={20} aria-hidden="true" />
        <div>
          <h2>Impressão térmica</h2>
          <p>
            Envie a nota ao bar automaticamente após a venda ou deixe desligado até instalar a
            impressora.
          </p>
        </div>
        <button
          aria-label="Atualizar impressoras"
          className="icon-button"
          disabled={loading || saving}
          onClick={() => {
            void load();
          }}
          title="Atualizar impressoras"
          type="button"
        >
          <RefreshCw size={16} aria-hidden="true" />
        </button>
      </div>

      {settings === null ? (
        <p className="inventory-helper">
          {loading ? 'Carregando impressoras…' : 'Configuração indisponível.'}
        </p>
      ) : (
        <>
          <label className="receipt-toggle">
            <input
              checked={settings.autoPrint}
              disabled={saving}
              onChange={(event) => {
                setSettings({ ...settings, autoPrint: event.target.checked });
              }}
              type="checkbox"
            />
            <span>
              <strong>Imprimir automaticamente ao concluir venda</strong>
              <small>
                Se desligado, a venda continua normalmente e a nota pode ser reimpressa pelo
                histórico da mesa.
              </small>
            </span>
          </label>

          <label className="form-field">
            <span>Impressora</span>
            <select
              disabled={saving}
              onChange={(event) => {
                setSettings({ ...settings, printerName: event.target.value || null });
              }}
              value={settings.printerName ?? ''}
            >
              <option value="">Impressora padrão do Windows</option>
              {printers.map((printer) => (
                <option key={printer.name} value={printer.name}>
                  {printer.displayName}
                  {printer.isDefault ? ' · padrão' : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Largura do papel</span>
            <select
              disabled={saving}
              onChange={(event) => {
                setSettings({
                  ...settings,
                  paperWidthMm: event.target.value === '80' ? 80 : 58,
                });
              }}
              value={String(settings.paperWidthMm)}
            >
              <option value="58">58 mm</option>
              <option value="80">80 mm</option>
            </select>
          </label>

          {printers.length === 0 ? (
            <p className="receipt-settings-note">
              Nenhuma impressora foi encontrada agora. Você pode deixar a impressão automática
              desligada e atualizar esta lista depois de instalar a térmica.
            </p>
          ) : null}

          {error === null ? null : <p className="form-error">{error}</p>}
          {message === null ? null : <p className="form-success">{message}</p>}

          <button
            className="button button--primary"
            disabled={saving}
            onClick={() => {
              void save();
            }}
            type="button"
          >
            <Save size={16} aria-hidden="true" />
            Salvar impressão
          </button>
        </>
      )}
    </article>
  );
}
