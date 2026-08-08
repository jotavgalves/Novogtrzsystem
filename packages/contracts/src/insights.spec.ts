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
    const parsed = dashboardStateSchema.parse({
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
        potentialRevenueCents: 0,
        potentialGrossProfitCents: 0,
      },
      inventoryBreakEven: [],
      recentActivity: [auditRecord],
    });

    expect(parsed.recentActivity).toHaveLength(1);
    expect(parsed.inventoryExpenseCents).toBe(0);
    expect(parsed.inventory.potentialRevenueCents).toBe(0);
  });

  it('valida o ponto de equilíbrio por item', () => {
    const item = dashboardStateSchema.shape.inventoryBreakEven.element.parse({
      productId: '4967eaed-49d5-44e4-8907-9518765739a4',
      productName: 'Coca-Cola',
      categoryId: 'a5236c40-f3a0-407c-b4ce-c935fe947da7',
      categoryName: 'Bebidas',
      purchasedUnits: 30,
      purchaseCostCents: 6000,
      salePriceCents: 500,
      soldUnits: 3,
      currentStockUnits: 27,
      breakEvenUnits: 12,
      remainingUnitsToBreakEven: 9,
    });

    expect(item).toMatchObject({ breakEvenUnits: 12, remainingUnitsToBreakEven: 9 });
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
