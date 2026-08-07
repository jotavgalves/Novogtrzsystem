import { Braces, Clock3, Fingerprint, ShieldCheck } from 'lucide-react';

import type { InsightAuditRecord } from '@gtrz/contracts';

import { describeAuditAction, describeEntityType } from '../../shared/insights/audit-labels';

interface AuditRecordListProps {
  readonly records: readonly InsightAuditRecord[];
}

const DETAIL_LABELS: Readonly<Record<string, string>> = {
  amountCents: 'Valor',
  totalCents: 'Total',
  subtotalCents: 'Subtotal',
  discountCents: 'Desconto',
  quantity: 'Quantidade',
  code: 'Código',
  label: 'Nome',
  name: 'Nome',
  productName: 'Produto',
  servicePointLabel: 'Mesa ou balcão',
  reason: 'Motivo',
  note: 'Observação',
  status: 'Status',
  previousStatus: 'Status anterior',
  restoredUnits: 'Unidades devolvidas',
  refundedVoucherCents: 'Voucher restituído',
  correlationId: 'Correlação',
};

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(timestamp);
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(cents / 100);
}

function formatDetails(details: Readonly<Record<string, unknown>>): string {
  const entries = Object.entries(details);

  if (entries.length === 0) {
    return 'Sem detalhes adicionais.';
  }

  return JSON.stringify(details, null, 2);
}

function hasStructuredDetails(
  details: Readonly<Record<string, unknown>> | null,
): details is Readonly<Record<string, unknown>> {
  return details !== null && Object.keys(details).length > 0;
}

function formatDetailValue(key: string, value: unknown): string {
  if (key.endsWith('Cents') && typeof value === 'number') {
    return formatMoney(value);
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function getDetailHighlights(
  details: Readonly<Record<string, unknown>>,
): readonly { readonly key: string; readonly label: string; readonly value: string }[] {
  const preferredKeys = Object.keys(DETAIL_LABELS).filter((key) => details[key] !== undefined);
  const fallbackKeys = Object.keys(details).filter((key) => !preferredKeys.includes(key));

  return [...preferredKeys, ...fallbackKeys].slice(0, 3).map((key) => ({
    key,
    label: DETAIL_LABELS[key] ?? key.replaceAll(/([A-Z])/gu, ' $1').trim(),
    value: formatDetailValue(key, details[key]),
  }));
}

export function AuditRecordList({ records }: AuditRecordListProps): React.JSX.Element {
  if (records.length === 0) {
    return (
      <div className="empty-state audit-empty">
        <ShieldCheck size={32} aria-hidden="true" />
        <h2>Nenhum registro encontrado</h2>
        <p>Ajuste os filtros ou realize uma operação no sistema.</p>
      </div>
    );
  }

  return (
    <div className="audit-list" aria-live="polite">
      {records.map((record) => {
        const highlights = getDetailHighlights(record.details);

        return (
          <article className="audit-card" key={record.id}>
            <header className="audit-card__header">
              <div>
                <span className={`status-badge status-badge--${record.profile}`}>
                  {record.profile === 'production' ? 'Produção' : 'Caixa'}
                </span>
                <h2>{describeAuditAction(record.action)}</h2>
                <p>{describeEntityType(record.entityType)}</p>
              </div>
              <time>
                <Clock3 size={15} aria-hidden="true" />
                {formatDate(record.createdAt)}
              </time>
            </header>

            <div className="audit-card__context">
              <div className="audit-card__meta">
                <span>Evento</span>
                <strong>{record.eventName ?? 'Operação global'}</strong>
              </div>
              <div className="audit-card__meta">
                <span>Identificador</span>
                <strong>{record.entityId ?? `Registro ${String(record.id)}`}</strong>
              </div>
              {record.correlationId === null ? null : (
                <div className="audit-card__meta">
                  <span>Correlação</span>
                  <strong>{record.correlationId}</strong>
                </div>
              )}
              {record.actorIdentifier === null ? null : (
                <div className="audit-card__meta">
                  <span>Responsável</span>
                  <strong>{record.actorIdentifier}</strong>
                </div>
              )}
            </div>

            {highlights.length === 0 ? null : (
              <div className="audit-highlight-list">
                {highlights.map((highlight) => (
                  <div key={highlight.key}>
                    <span>{highlight.label}</span>
                    <strong>{highlight.value}</strong>
                  </div>
                ))}
              </div>
            )}

            <details className="audit-details">
              <summary>
                <Braces size={16} aria-hidden="true" />
                Ver detalhes técnicos
              </summary>
              <div className="audit-details__identity">
                <Fingerprint size={14} aria-hidden="true" />
                <span>
                  {record.action} · {record.entityType} · #{record.id}
                </span>
              </div>
              {hasStructuredDetails(record.before) ? (
                <>
                  <strong className="audit-details__label">Antes</strong>
                  <pre>{formatDetails(record.before)}</pre>
                </>
              ) : null}
              {hasStructuredDetails(record.after) ? (
                <>
                  <strong className="audit-details__label">Depois</strong>
                  <pre>{formatDetails(record.after)}</pre>
                </>
              ) : null}
              {hasStructuredDetails(record.impact) ? (
                <>
                  <strong className="audit-details__label">Impacto</strong>
                  <pre>{formatDetails(record.impact)}</pre>
                </>
              ) : null}
              {hasStructuredDetails(record.metadata) ? (
                <>
                  <strong className="audit-details__label">Metadados</strong>
                  <pre>{formatDetails(record.metadata)}</pre>
                </>
              ) : null}
              <strong className="audit-details__label">Dados técnicos completos</strong>
              <pre>{formatDetails(record.details)}</pre>
            </details>
          </article>
        );
      })}
    </div>
  );
}
