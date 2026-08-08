import { describe, expect, it } from 'vitest';

import { auditQueryInputSchema, auditStateSchema, dashboardStateSchema } from './insights';

const auditRecord = {
  id: 1,
  eventId: null,
  eventName: null,
  profile: 'production' as const,
  actorIdentifier: null,
  action: 'system.started',
  entityType: 'system',
  entityId: null,
  correlationId: null,
  details: { ready: true },
  before: null,
  after: null,
  impact: null,
  metadata: null,
  schemaVersion: 0,
  createdAt: 1,
};

describe('insights contracts', () => {
  it('valida o painel consolidado', () => {
    expect(
      dashboardStateSchema.parse({
        activeEvent: null,
        grossSalesCents: 0,
        grossRevenueCents: 0,
        discountsCents: 0,
        netRevenueCents: 0,
        completedSales: 0,
        activeExpensesCents: 0,
        inventoryExpenseCents: 0,
        projectedResultCents: 0,
        expectedCashCents: 0,
        cashVarianceCents: null,
        cashRegisterStatus: 'not-opened',
        salesByMethod: {
          cashCents: 0,
          pixCents: 0,
          creditCardCents: 0,
          debitCardCents: 0,
          voucherCents: 0,
        },
        vouchersUsedCents: 0,
        orders: { open: 0, paid: 0, cancelled: 0 },
        tickets: { sold: 0, courtesy: 0, available: 0, revenueCents: 0 },
        vouchers: { active: 0, outstandingBalanceCents: 0 },
        inventory: {
          units: 0,
          activeProducts: 0,
          lowStockProducts: 0,
          stockCostCents: 0,
        },
        recentActivity: [auditRecord],
      }).recentActivity,
    ).toHaveLength(1);
  });

  it('valida consultas e rejeita intervalo invertido', () => {
    expect(
      auditQueryInputSchema.parse({
        search: 'evento',
        entityType: 'voucher',
        correlationId: 'corr-1',
        limit: 20,
        offset: 40,
      }),
    ).toMatchObject({
      search: 'evento',
      entityType: 'voucher',
      correlationId: 'corr-1',
      limit: 20,
      offset: 40,
    });
    expect(() => auditQueryInputSchema.parse({ from: 20, to: 10 })).toThrow(
      'A data inicial não pode ser posterior à data final.',
    );
  });

  it('valida o estado pesquisável da auditoria', () => {
    expect(
      auditStateSchema.parse({
        records: [auditRecord],
        pagination: { limit: 100, offset: 0, total: 1, hasMore: false, nextOffset: null },
        actions: ['system.started'],
        events: [],
      }).records[0]?.details,
    ).toEqual({ ready: true });
  });
});
