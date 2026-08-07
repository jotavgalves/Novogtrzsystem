interface AuditEntityFiltersProps {
  readonly entityType: string;
  readonly entityId: string;
  readonly correlationId: string;
  readonly onEntityTypeChange: (value: string) => void;
  readonly onEntityIdChange: (value: string) => void;
  readonly onCorrelationIdChange: (value: string) => void;
}

export function AuditEntityFilters({
  entityType,
  entityId,
  correlationId,
  onEntityTypeChange,
  onEntityIdChange,
  onCorrelationIdChange,
}: AuditEntityFiltersProps): React.JSX.Element {
  return (
    <>
      <label className="form-field">
        <span>Tipo de entidade</span>
        <input
          onChange={(event) => {
            onEntityTypeChange(event.target.value);
          }}
          placeholder="Ex.: voucher, ticket-sale"
          value={entityType}
        />
      </label>

      <label className="form-field">
        <span>Identificador da entidade</span>
        <input
          onChange={(event) => {
            onEntityIdChange(event.target.value);
          }}
          placeholder="ID exato"
          value={entityId}
        />
      </label>

      <label className="form-field">
        <span>Correlação</span>
        <input
          onChange={(event) => {
            onCorrelationIdChange(event.target.value);
          }}
          placeholder="ID de operação composta"
          value={correlationId}
        />
      </label>
    </>
  );
}
