import { getCashState } from './cash';
import { getSessionState, listEvents } from './control';
import { getDashboardAggregates } from './dashboard-queries';
import type { DatabaseContext } from './types';

export type DatabaseInsightProfile = 'production' | 'cashier';

export interface DatabaseInsightAuditRecord {
  readonly id: number;
  readonly eventId: string | null;
  readonly eventName: string | null;
  readonly profile: DatabaseInsightProfile;
  readonly actorIdentifier: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly correlationId: string | null;
  readonly details: Readonly<Record<string, unknown>>;
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  readonly impact: Readonly<Record<string, unknown>> | null;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly createdAt: number;
}

export interface DatabaseDashboardState {
  readonly activeEvent: {
    readonly id: string;
    readonly name: string;
    readonly status: 'open' | 'closed' | 'archived';
    readonly startsAt: number;
  } | null;
  readonly grossSalesCents: number;
  readonly grossRevenueCents: number;
  readonly discountsCents: number;
  readonly netRevenueCents: number;
  readonly completedSales: number;
  readonly activeExpensesCents: number;
  readonly projectedResultCents: number;
  readonly expectedCashCents: number;
  readonly cashVarianceCents: number | null;
  readonly cashRegisterStatus: 'not-opened' | 'open' | 'closed';
  readonly salesByMethod: {
    readonly cashCents: number;
    readonly pixCents: number;
    readonly creditCardCents: number;
    readonly debitCardCents: number;
    readonly voucherCents: number;
  };
  readonly vouchersUsedCents: number;
  readonly orders: {
    readonly open: number;
    readonly paid: number;
    readonly cancelled: number;
  };
  readonly tickets: {
    readonly sold: number;
    readonly courtesy: number;
    readonly available: number;
    readonly revenueCents: number;
  };
  readonly vouchers: {
    readonly active: number;
    readonly outstandingBalanceCents: number;
  };
  readonly inventory: {
    readonly units: number;
    readonly activeProducts: number;
    readonly lowStockProducts: number;
    readonly stockCostCents: number;
  };
  readonly recentActivity: readonly DatabaseInsightAuditRecord[];
}

export interface DatabaseAuditQuery {
  readonly eventId?: string | null;
  readonly profile?: DatabaseInsightProfile;
  readonly action?: string;
  readonly entityType?: string;
  readonly entityId?: string;
  readonly correlationId?: string;
  readonly search?: string;
  readonly from?: number;
  readonly to?: number;
  readonly limit?: number;
  readonly offset?: number;
}

export interface DatabaseAuditState {
  readonly records: readonly DatabaseInsightAuditRecord[];
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly total: number;
    readonly hasMore: boolean;
    readonly nextOffset: number | null;
  };
  readonly actions: readonly string[];
  readonly events: readonly { readonly id: string; readonly name: string }[];
}

interface AuditRow {
  readonly id: number;
  readonly event_id: string | null;
  readonly event_name: string | null;
  readonly profile: DatabaseInsightProfile;
  readonly actor_identifier: string | null;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string | null;
  readonly correlation_id: string | null;
  readonly details_json: string;
  readonly before_json: string | null;
  readonly after_json: string | null;
  readonly impact_json: string | null;
  readonly metadata_json: string | null;
  readonly created_at: number;
}

interface AuditPageResult {
  readonly records: readonly DatabaseInsightAuditRecord[];
  readonly pagination: DatabaseAuditState['pagination'];
}

interface OrderCountRow {
  readonly status: 'open' | 'paid' | 'cancelled';
  readonly amount: number;
}

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    throw new Error('A visão consolidada e a auditoria exigem o perfil Produção.');
  }
}

function parseDetails(value: string): Readonly<Record<string, unknown>> {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Readonly<Record<string, unknown>>)
      : {};
  } catch {
    return {};
  }
}

function parseNullableDetails(value: string | null): Readonly<Record<string, unknown>> | null {
  if (value === null) {
    return null;
  }

  const parsed = parseDetails(value);
  return Object.keys(parsed).length === 0 ? null : parsed;
}

function mapAuditRecord(row: AuditRow): DatabaseInsightAuditRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    eventName: row.event_name,
    profile: row.profile,
    actorIdentifier: row.actor_identifier,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    correlationId: row.correlation_id,
    details: parseDetails(row.details_json),
    before: parseNullableDetails(row.before_json),
    after: parseNullableDetails(row.after_json),
    impact: parseNullableDetails(row.impact_json),
    metadata: parseNullableDetails(row.metadata_json),
    createdAt: row.created_at,
  };
}

function buildAuditWhere(input: DatabaseAuditQuery): {
  readonly where: string;
  readonly parameters: readonly unknown[];
} {
  const clauses: string[] = [];
  const parameters: unknown[] = [];

  if (input.eventId !== undefined) {
    if (input.eventId === null) {
      clauses.push('al.event_id IS NULL');
    } else {
      clauses.push('al.event_id = ?');
      parameters.push(input.eventId);
    }
  }

  if (input.profile !== undefined) {
    clauses.push('al.profile = ?');
    parameters.push(input.profile);
  }

  const action = input.action?.trim();
  if (action !== undefined && action.length > 0) {
    clauses.push('al.action = ?');
    parameters.push(action);
  }

  const entityType = input.entityType?.trim();
  if (entityType !== undefined && entityType.length > 0) {
    clauses.push('al.entity_type = ?');
    parameters.push(entityType);
  }

  const entityId = input.entityId?.trim();
  if (entityId !== undefined && entityId.length > 0) {
    clauses.push('al.entity_id = ?');
    parameters.push(entityId);
  }

  const correlationId = input.correlationId?.trim();
  if (correlationId !== undefined && correlationId.length > 0) {
    clauses.push('al.correlation_id = ?');
    parameters.push(correlationId);
  }

  const search = input.search?.trim();
  if (search !== undefined && search.length > 0) {
    clauses.push(`(
      al.action LIKE ? COLLATE NOCASE OR
      al.entity_type LIKE ? COLLATE NOCASE OR
      COALESCE(al.entity_id, '') LIKE ? COLLATE NOCASE OR
      COALESCE(al.correlation_id, '') LIKE ? COLLATE NOCASE OR
      COALESCE(al.actor_identifier, '') LIKE ? COLLATE NOCASE OR
      al.details_json LIKE ? COLLATE NOCASE OR
      COALESCE(al.before_json, '') LIKE ? COLLATE NOCASE OR
      COALESCE(al.after_json, '') LIKE ? COLLATE NOCASE OR
      COALESCE(al.impact_json, '') LIKE ? COLLATE NOCASE OR
      COALESCE(al.metadata_json, '') LIKE ? COLLATE NOCASE OR
      COALESCE(e.name, '') LIKE ? COLLATE NOCASE
    )`);
    const pattern = `%${search}%`;
    parameters.push(
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
      pattern,
    );
  }

  if (input.from !== undefined) {
    clauses.push('al.created_at >= ?');
    parameters.push(input.from);
  }

  if (input.to !== undefined) {
    clauses.push('al.created_at <= ?');
    parameters.push(input.to);
  }

  return {
    where: clauses.length === 0 ? '' : `WHERE ${clauses.join(' AND ')}`,
    parameters,
  };
}

function listAuditRecords(database: DatabaseContext, input: DatabaseAuditQuery): AuditPageResult {
  const { where, parameters } = buildAuditWhere(input);
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
  const offset = Math.max(input.offset ?? 0, 0);
  const totalRow = database.sqlite
    .prepare(
      `SELECT COUNT(*) AS value
       FROM audit_log al
       LEFT JOIN events e ON e.id = al.event_id
       ${where}`,
    )
    .get(...parameters) as { readonly value: number };
  const rows = database.sqlite
    .prepare(
      `SELECT
         al.id,
         al.event_id,
         e.name AS event_name,
         al.profile,
         al.actor_identifier,
         al.action,
         al.entity_type,
         al.entity_id,
         al.correlation_id,
         al.details_json,
         al.before_json,
         al.after_json,
         al.impact_json,
         al.metadata_json,
         al.created_at
       FROM audit_log al
       LEFT JOIN events e ON e.id = al.event_id
       ${where}
       ORDER BY al.created_at DESC, al.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...parameters, limit, offset) as AuditRow[];
  const nextOffset = offset + rows.length;

  return {
    records: rows.map(mapAuditRecord),
    pagination: {
      limit,
      offset,
      total: totalRow.value,
      hasMore: nextOffset < totalRow.value,
      nextOffset: nextOffset < totalRow.value ? nextOffset : null,
    },
  };
}

function getOrderCounts(
  database: DatabaseContext,
  eventId: string,
): DatabaseDashboardState['orders'] {
  const rows = database.sqlite
    .prepare(
      `SELECT status, COUNT(*) AS amount
       FROM orders
       WHERE event_id = ?
       GROUP BY status`,
    )
    .all(eventId) as OrderCountRow[];
  const result = { open: 0, paid: 0, cancelled: 0 };

  for (const row of rows) {
    result[row.status] = row.amount;
  }

  return result;
}

export function getDashboardState(database: DatabaseContext): DatabaseDashboardState {
  requireProduction(database);
  const session = getSessionState(database);
  const activeEvent = session.activeEvent;
  const cashState = getCashState(database);

  if (activeEvent === null) {
    return {
      activeEvent: null,
      grossSalesCents: 0,
      grossRevenueCents: 0,
      discountsCents: 0,
      netRevenueCents: 0,
      completedSales: 0,
      activeExpensesCents: 0,
      projectedResultCents: 0,
      expectedCashCents: 0,
      cashVarianceCents: null,
      cashRegisterStatus: 'not-opened',
      salesByMethod: cashState.salesByMethod,
      vouchersUsedCents: 0,
      orders: { open: 0, paid: 0, cancelled: 0 },
      tickets: { sold: 0, courtesy: 0, available: 0, revenueCents: 0 },
      vouchers: { active: 0, outstandingBalanceCents: 0 },
      inventory: { units: 0, activeProducts: 0, lowStockProducts: 0, stockCostCents: 0 },
      recentActivity: [],
    };
  }

  const aggregates = getDashboardAggregates(database, activeEvent.id);

  return {
    activeEvent: {
      id: activeEvent.id,
      name: activeEvent.name,
      status: activeEvent.status,
      startsAt: activeEvent.startsAt,
    },
    grossSalesCents: aggregates.netRevenueCents,
    grossRevenueCents: aggregates.grossRevenueCents,
    discountsCents: aggregates.discountsCents,
    netRevenueCents: aggregates.netRevenueCents,
    completedSales: aggregates.completedSales,
    activeExpensesCents: cashState.activeExpensesCents,
    projectedResultCents: aggregates.netRevenueCents - cashState.activeExpensesCents,
    expectedCashCents: cashState.expectedCashCents,
    cashVarianceCents: cashState.register?.varianceCents ?? null,
    cashRegisterStatus: cashState.register?.status ?? 'not-opened',
    salesByMethod: cashState.salesByMethod,
    vouchersUsedCents: cashState.salesByMethod.voucherCents,
    orders: getOrderCounts(database, activeEvent.id),
    tickets: aggregates.tickets,
    vouchers: aggregates.vouchers,
    inventory: aggregates.inventory,
    recentActivity: listAuditRecords(database, { eventId: activeEvent.id, limit: 8 }).records,
  };
}

export function getAuditState(
  database: DatabaseContext,
  input: DatabaseAuditQuery = {},
): DatabaseAuditState {
  requireProduction(database);
  const actionRows = database.sqlite
    .prepare('SELECT DISTINCT action FROM audit_log ORDER BY action COLLATE NOCASE')
    .all() as { readonly action: string }[];
  const page = listAuditRecords(database, input);

  return {
    records: page.records,
    pagination: page.pagination,
    actions: actionRows.map((row) => row.action),
    events: listEvents(database).map((event) => ({ id: event.id, name: event.name })),
  };
}
