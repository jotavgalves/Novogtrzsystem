import { z } from 'zod';

export const insightProfileSchema = z.enum(['production', 'cashier']);

export const insightAuditRecordSchema = z.object({
  id: z.number().int().positive(),
  eventId: z.uuid().nullable(),
  eventName: z.string().nullable(),
  profile: insightProfileSchema,
  actorIdentifier: z.string().nullable(),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().nullable(),
  correlationId: z.string().nullable(),
  details: z.record(z.string(), z.unknown()),
  before: z.record(z.string(), z.unknown()).nullable(),
  after: z.record(z.string(), z.unknown()).nullable(),
  impact: z.record(z.string(), z.unknown()).nullable(),
  metadata: z.record(z.string(), z.unknown()).nullable(),
  schemaVersion: z.number().int().nonnegative(),
  createdAt: z.number().int().nonnegative(),
});

export const dashboardStateSchema = z.object({
  activeEvent: z
    .object({
      id: z.uuid(),
      name: z.string().min(1),
      status: z.enum(['open', 'closed', 'archived']),
      startsAt: z.number().int().nonnegative(),
    })
    .nullable(),
  grossSalesCents: z.number().int().nonnegative(),
  grossRevenueCents: z.number().int().nonnegative(),
  discountsCents: z.number().int().nonnegative(),
  netRevenueCents: z.number().int().nonnegative(),
  completedSales: z.number().int().nonnegative(),
  activeExpensesCents: z.number().int().nonnegative(),
  inventoryExpenseCents: z.number().int().nonnegative(),
  projectedResultCents: z.number().int(),
  expectedCashCents: z.number().int(),
  cashVarianceCents: z.number().int().nullable(),
  cashRegisterStatus: z.enum(['not-opened', 'open', 'closed']),
  salesByMethod: z.object({
    cashCents: z.number().int().nonnegative(),
    pixCents: z.number().int().nonnegative(),
    creditCardCents: z.number().int().nonnegative(),
    debitCardCents: z.number().int().nonnegative(),
    voucherCents: z.number().int().nonnegative(),
  }),
  vouchersUsedCents: z.number().int().nonnegative(),
  orders: z.object({
    open: z.number().int().nonnegative(),
    paid: z.number().int().nonnegative(),
    cancelled: z.number().int().nonnegative(),
  }),
  tickets: z.object({
    sold: z.number().int().nonnegative(),
    courtesy: z.number().int().nonnegative(),
    available: z.number().int().nonnegative(),
    revenueCents: z.number().int().nonnegative(),
  }),
  vouchers: z.object({
    active: z.number().int().nonnegative(),
    outstandingBalanceCents: z.number().int().nonnegative(),
  }),
  inventory: z.object({
    units: z.number().int().nonnegative(),
    activeProducts: z.number().int().nonnegative(),
    lowStockProducts: z.number().int().nonnegative(),
    stockCostCents: z.number().int().nonnegative(),
  }),
  recentActivity: z.array(insightAuditRecordSchema),
});

export const auditQueryInputSchema = z
  .object({
    eventId: z.uuid().nullable().optional(),
    profile: insightProfileSchema.optional(),
    action: z.string().trim().max(120).optional(),
    entityType: z.string().trim().max(80).optional(),
    entityId: z.string().trim().max(160).optional(),
    correlationId: z.string().trim().max(160).optional(),
    search: z.string().trim().max(160).optional(),
    from: z.number().int().nonnegative().optional(),
    to: z.number().int().nonnegative().optional(),
    limit: z.number().int().min(1).max(500).default(100),
    offset: z.number().int().nonnegative().default(0),
  })
  .refine((input) => input.from === undefined || input.to === undefined || input.from <= input.to, {
    message: 'A data inicial não pode ser posterior à data final.',
    path: ['from'],
  });

export const auditStateSchema = z.object({
  records: z.array(insightAuditRecordSchema),
  pagination: z.object({
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    hasMore: z.boolean(),
    nextOffset: z.number().int().nonnegative().nullable(),
  }),
  actions: z.array(z.string().min(1)),
  events: z.array(
    z.object({
      id: z.uuid(),
      name: z.string().min(1),
    }),
  ),
});

export type InsightProfile = z.infer<typeof insightProfileSchema>;
export type InsightAuditRecord = z.infer<typeof insightAuditRecordSchema>;
export type DashboardState = z.infer<typeof dashboardStateSchema>;
export type AuditQueryInput = z.infer<typeof auditQueryInputSchema>;
export type AuditState = z.infer<typeof auditStateSchema>;

export interface DashboardApi {
  getState(): Promise<DashboardState>;
}

export interface AuditApi {
  list(input?: AuditQueryInput): Promise<AuditState>;
}
