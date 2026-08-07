import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Square } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { EventCloseResult, EventCloseSummary } from '@gtrz/contracts';

interface EventClosePanelProps {
  readonly eventId: string;
  readonly eventName: string;
  readonly onCompleted: (result: EventCloseResult) => Promise<void>;
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function parseMoney(value: string): number | null {
  const normalized = value.trim().replaceAll('.', '').replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null;
}

export function EventClosePanel({
  eventId,
  eventName,
  onCompleted,
}: EventClosePanelProps): React.JSX.Element {
  const [summary, setSummary] = useState<EventCloseSummary | null>(null);
  const [countedCash, setCountedCash] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      setSummary(await window.gtrz.eventClose.preview({ eventId }));
    } catch (loadError: unknown) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Não foi possível preparar o encerramento do evento.',
      );
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const countedCashCents = parseMoney(countedCash);
  const countIsValid = summary?.requiresCashCount !== true || countedCashCents !== null;

  async function completeClose(): Promise<void> {
    if (summary === null || !summary.canClose || !confirmed || !countIsValid) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const result = await window.gtrz.eventClose.complete({
        eventId,
        ...(summary.requiresCashCount && countedCashCents !== null ? { countedCashCents } : {}),
      });
      await onCompleted(result);
    } catch (closeError: unknown) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : 'Não foi possível concluir o encerramento do evento.',
      );
      await reload();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="event-close-panel" aria-live="polite">
      <header className="event-close-panel__header">
        <div>
          <span className="eyebrow">Encerramento operacional</span>
          <h2>{eventName}</h2>
          <p>Concilie o caixa, confira os indicadores e gere o backup final obrigatório.</p>
        </div>
        <button
          className="button button--secondary button--compact"
          disabled={loading || submitting}
          onClick={() => {
            void reload();
          }}
          type="button"
        >
          <RefreshCw size={16} aria-hidden="true" />
          Recalcular
        </button>
      </header>

      {loading ? <div className="route-state">Consolidando a operação…</div> : null}
      {error === null ? null : <p className="form-error">{error}</p>}

      {summary === null ? null : (
        <>
          <div className="event-close-grid">
            <article>
              <span>Vendas brutas</span>
              <strong>{formatMoney(summary.grossSalesCents)}</strong>
            </article>
            <article>
              <span>Despesas</span>
              <strong>{formatMoney(summary.activeExpensesCents)}</strong>
            </article>
            <article>
              <span>Resultado projetado</span>
              <strong>{formatMoney(summary.projectedResultCents)}</strong>
            </article>
            <article>
              <span>Caixa esperado</span>
              <strong>{formatMoney(summary.expectedCashCents)}</strong>
            </article>
            <article>
              <span>Comandas pagas</span>
              <strong>{summary.paidOrdersCount}</strong>
            </article>
            <article>
              <span>Ingressos vendidos</span>
              <strong>{summary.ticketSoldQuantity}</strong>
            </article>
            <article>
              <span>Cortesias</span>
              <strong>{summary.ticketCourtesyQuantity}</strong>
            </article>
            <article>
              <span>Saldo de vouchers</span>
              <strong>{formatMoney(summary.vouchersRemainingCents)}</strong>
            </article>
          </div>

          {summary.blockers.length === 0 ? (
            <div className="event-close-ready">
              <CheckCircle2 size={20} aria-hidden="true" />
              Nenhuma pendência operacional encontrada.
            </div>
          ) : (
            <div className="event-close-blockers">
              <strong>
                <AlertTriangle size={19} aria-hidden="true" />
                Corrija antes de encerrar
              </strong>
              {summary.blockers.map((blocker) => (
                <p key={blocker}>{blocker}</p>
              ))}
            </div>
          )}

          {summary.requiresCashCount ? (
            <label className="form-field event-close-count">
              <span>Valor físico contado no caixa</span>
              <input
                disabled={submitting}
                inputMode="decimal"
                onChange={(inputEvent) => {
                  setCountedCash(inputEvent.target.value);
                }}
                placeholder="0,00"
                value={countedCash}
              />
              <small>A diferença será calculada e registrada na auditoria.</small>
            </label>
          ) : null}

          <label className="event-close-confirmation">
            <input
              checked={confirmed}
              disabled={submitting || !summary.canClose}
              onChange={(inputEvent) => {
                setConfirmed(inputEvent.target.checked);
              }}
              type="checkbox"
            />
            <span>
              Confirmo que a operação foi conferida e que o encerramento removerá este evento da
              operação ativa.
            </span>
          </label>

          <button
            className="button button--primary event-close-submit"
            disabled={submitting || !summary.canClose || !confirmed || !countIsValid}
            onClick={() => {
              void completeClose();
            }}
            type="button"
          >
            {submitting ? (
              <RefreshCw size={17} aria-hidden="true" />
            ) : (
              <ShieldCheck size={17} aria-hidden="true" />
            )}
            {submitting ? 'Encerrando e verificando backup…' : 'Encerrar evento com backup'}
            <Square size={14} aria-hidden="true" />
          </button>
        </>
      )}
    </section>
  );
}
