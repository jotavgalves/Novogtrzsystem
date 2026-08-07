import { Clock3, Filter, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { AuditQueryInput, InsightProfile } from '@gtrz/contracts';

import { describeAuditAction, sortAuditActions } from '../../shared/insights/audit-labels';
import { AuditEntityFilters } from './AuditEntityFilters';
import { AuditRecordList } from './AuditRecordList';
import { AuditSummaryCards } from './AuditSummaryCards';
import { useAudit } from './useAudit';

function toTimestamp(value: string): number | undefined {
  if (value.length === 0) {
    return undefined;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

function toDateTimeInput(timestamp: number): string {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}

export function AuditPage(): React.JSX.Element {
  const { state, loading, error, load } = useAudit();
  const [search, setSearch] = useState('');
  const [eventId, setEventId] = useState('all');
  const [profile, setProfile] = useState<InsightProfile | 'all'>('all');
  const [action, setAction] = useState('all');
  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [correlationId, setCorrelationId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const records = useMemo(() => state?.records ?? [], [state?.records]);
  const actions = useMemo(() => sortAuditActions(state?.actions ?? []), [state?.actions]);
  const pagination = state?.pagination ?? null;
  const productionRecords = records.filter((record) => record.profile === 'production').length;
  const cashierRecords = records.length - productionRecords;
  const activeFilterCount = [
    search.trim().length > 0,
    eventId !== 'all',
    profile !== 'all',
    action !== 'all',
    entityType.trim().length > 0,
    entityId.trim().length > 0,
    correlationId.trim().length > 0,
    from.length > 0,
    to.length > 0,
  ].filter(Boolean).length;
  const fromTimestamp = toTimestamp(from);
  const toTimestampValue = toTimestamp(to);
  const dateRangeInvalid =
    fromTimestamp !== undefined &&
    toTimestampValue !== undefined &&
    fromTimestamp > toTimestampValue;

  const buildQuery = (offset = 0): AuditQueryInput => {
    const normalizedSearch = search.trim();
    const normalizedEntityType = entityType.trim();
    const normalizedEntityId = entityId.trim();
    const normalizedCorrelationId = correlationId.trim();

    return {
      limit: 100,
      offset,
      ...(normalizedSearch.length === 0 ? {} : { search: normalizedSearch }),
      ...(eventId === 'all' ? {} : { eventId }),
      ...(profile === 'all' ? {} : { profile }),
      ...(action === 'all' ? {} : { action }),
      ...(normalizedEntityType.length === 0 ? {} : { entityType: normalizedEntityType }),
      ...(normalizedEntityId.length === 0 ? {} : { entityId: normalizedEntityId }),
      ...(normalizedCorrelationId.length === 0 ? {} : { correlationId: normalizedCorrelationId }),
      ...(fromTimestamp === undefined ? {} : { from: fromTimestamp }),
      ...(toTimestampValue === undefined ? {} : { to: toTimestampValue }),
    };
  };

  const applyFilters = async (): Promise<void> => {
    if (dateRangeInvalid) {
      return;
    }

    await load(buildQuery());
  };

  const clearFilters = async (): Promise<void> => {
    setSearch('');
    setEventId('all');
    setProfile('all');
    setAction('all');
    setEntityType('');
    setEntityId('');
    setCorrelationId('');
    setFrom('');
    setTo('');
    await load({ limit: 100, offset: 0 });
  };

  const loadMore = async (): Promise<void> => {
    if (pagination?.nextOffset === null || pagination?.nextOffset === undefined) {
      return;
    }

    await load(buildQuery(pagination.nextOffset), { append: true });
  };

  const applyLastDay = (): void => {
    const now = Date.now();
    setFrom(toDateTimeInput(now - 24 * 60 * 60 * 1000));
    setTo(toDateTimeInput(now));
  };

  return (
    <section className="feature-page">
      <header className="feature-header">
        <div>
          <span className="eyebrow">Trilha imutável de operações</span>
          <h1>Auditoria</h1>
          <p>
            Pesquise criações, alterações, vendas, estornos, estoque, vouchers, ingressos e acessos
            protegidos.
          </p>
        </div>
        <button
          className="button button--secondary"
          disabled={loading || dateRangeInvalid}
          onClick={() => {
            void applyFilters();
          }}
          type="button"
        >
          <RefreshCw size={17} aria-hidden="true" />
          Atualizar
        </button>
      </header>

      <AuditSummaryCards
        cashierRecords={cashierRecords}
        pagination={pagination}
        productionRecords={productionRecords}
        recordsShown={records.length}
      />

      <article className="panel audit-filter-panel">
        <div className="audit-filter-panel__heading">
          <div className="panel__heading">
            <Filter size={20} aria-hidden="true" />
            <div>
              <h2>Filtros</h2>
              <p>Combine critérios para localizar uma operação específica.</p>
            </div>
          </div>
          <span className="audit-filter-count">
            {activeFilterCount === 0
              ? 'Nenhum filtro ativo'
              : `${String(activeFilterCount)} ${activeFilterCount === 1 ? 'filtro ativo' : 'filtros ativos'}`}
          </span>
        </div>

        <div className="audit-quick-filters">
          <button
            className="button button--ghost button--compact"
            disabled={loading}
            onClick={applyLastDay}
            type="button"
          >
            <Clock3 size={15} aria-hidden="true" />
            Últimas 24 horas
          </button>
          {eventId !== 'all' ? (
            <span className="audit-filter-chip">
              Evento: {state?.events.find((event) => event.id === eventId)?.name ?? eventId}
            </span>
          ) : null}
          {profile !== 'all' ? (
            <span className="audit-filter-chip">
              Perfil: {profile === 'production' ? 'Produção' : 'Caixa'}
            </span>
          ) : null}
          {action !== 'all' ? (
            <span className="audit-filter-chip">Ação: {describeAuditAction(action)}</span>
          ) : null}
          {entityType.trim().length > 0 ? (
            <span className="audit-filter-chip">Entidade: {entityType.trim()}</span>
          ) : null}
          {correlationId.trim().length > 0 ? (
            <span className="audit-filter-chip">Correlação: {correlationId.trim()}</span>
          ) : null}
        </div>

        <form
          className="audit-filter-grid"
          onSubmit={(event) => {
            event.preventDefault();
            void applyFilters();
          }}
        >
          <label className="form-field audit-search-field">
            <span>Buscar em ação, entidade, evento, correlação ou detalhes</span>
            <div className="audit-search-input">
              <Search size={17} aria-hidden="true" />
              <input
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                placeholder="Ex.: estorno, ingresso, nome do evento"
                value={search}
              />
            </div>
          </label>

          <AuditEntityFilters
            correlationId={correlationId}
            entityId={entityId}
            entityType={entityType}
            onCorrelationIdChange={setCorrelationId}
            onEntityIdChange={setEntityId}
            onEntityTypeChange={setEntityType}
          />

          <label className="form-field">
            <span>Evento</span>
            <select
              onChange={(event) => {
                setEventId(event.target.value);
              }}
              value={eventId}
            >
              <option value="all">Todos os eventos</option>
              {state?.events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Perfil</span>
            <select
              onChange={(event) => {
                setProfile(event.target.value as InsightProfile | 'all');
              }}
              value={profile}
            >
              <option value="all">Todos os perfis</option>
              <option value="production">Produção</option>
              <option value="cashier">Caixa</option>
            </select>
          </label>

          <label className="form-field">
            <span>Ação</span>
            <select
              onChange={(event) => {
                setAction(event.target.value);
              }}
              value={action}
            >
              <option value="all">Todas as ações</option>
              {actions.map((item) => (
                <option key={item} value={item}>
                  {describeAuditAction(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Data inicial</span>
            <input
              aria-invalid={dateRangeInvalid}
              onChange={(event) => {
                setFrom(event.target.value);
              }}
              type="datetime-local"
              value={from}
            />
          </label>

          <label className="form-field">
            <span>Data final</span>
            <input
              aria-invalid={dateRangeInvalid}
              onChange={(event) => {
                setTo(event.target.value);
              }}
              type="datetime-local"
              value={to}
            />
          </label>

          {dateRangeInvalid ? (
            <p className="form-error audit-date-error">
              A data inicial não pode ser posterior à data final.
            </p>
          ) : null}

          <div className="audit-filter-actions">
            <button className="button" disabled={loading || dateRangeInvalid} type="submit">
              <ShieldCheck size={17} aria-hidden="true" />
              Aplicar filtros
            </button>
            <button
              className="button button--ghost"
              disabled={loading}
              onClick={() => {
                void clearFilters();
              }}
              type="button"
            >
              <X size={17} aria-hidden="true" />
              Limpar
            </button>
          </div>
        </form>
      </article>

      {error === null ? null : <p className="form-error">{error}</p>}
      {loading && state === null ? <div className="route-state">Carregando auditoria…</div> : null}
      {state === null ? null : <AuditRecordList records={records} />}
      {pagination?.hasMore === true ? (
        <div className="audit-pagination">
          <button
            className="button button--secondary"
            disabled={loading}
            onClick={() => {
              void loadMore();
            }}
            type="button"
          >
            Carregar mais registros
          </button>
          <span>
            {String(records.length)} de {String(pagination.total)}
          </span>
        </div>
      ) : null}
    </section>
  );
}
