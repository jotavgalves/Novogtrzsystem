import type { AuditState } from '@gtrz/contracts';

interface AuditSummaryCardsProps {
  readonly recordsShown: number;
  readonly productionRecords: number;
  readonly cashierRecords: number;
  readonly pagination: AuditState['pagination'] | null;
}

export function AuditSummaryCards({
  recordsShown,
  productionRecords,
  cashierRecords,
  pagination,
}: AuditSummaryCardsProps): React.JSX.Element {
  return (
    <div className="summary-grid summary-grid--compact">
      <article className="summary-card summary-card--accent">
        <span>Registros exibidos</span>
        <strong>
          {pagination === null
            ? recordsShown
            : `${String(recordsShown)} de ${String(pagination.total)}`}
        </strong>
        <small>Paginação real no banco</small>
      </article>
      <article className="summary-card">
        <span>Perfil Produção</span>
        <strong>{productionRecords}</strong>
        <small>Operações administrativas exibidas</small>
      </article>
      <article className="summary-card">
        <span>Perfil Caixa</span>
        <strong>{cashierRecords}</strong>
        <small>Operações de atendimento exibidas</small>
      </article>
      <article className="summary-card">
        <span>Integridade</span>
        <strong>Somente leitura</strong>
        <small>Nenhum registro pode ser editado</small>
      </article>
    </div>
  );
}
