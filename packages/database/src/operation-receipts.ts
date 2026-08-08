import { appendAudit } from './audit';
import { getSessionState } from './control';
import { failDatabaseOperation } from './database-error';
import { getOrder } from './operation-core';
import type { DatabasePaymentMethod } from './operation-types';
import type { DatabaseContext } from './types';

export interface DatabaseReceiptSettings {
  readonly autoPrint: boolean;
  readonly printerName: string | null;
  readonly paperWidthMm: 58 | 80;
}

export interface DatabaseReceiptDocument {
  readonly orderId: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly servicePointLabel: string;
  readonly closedAt: number;
  readonly items: readonly {
    readonly name: string;
    readonly quantity: number;
    readonly unitPriceCents: number;
    readonly totalCents: number;
  }[];
  readonly totalCents: number;
  readonly payments: readonly {
    readonly method: DatabasePaymentMethod;
    readonly amountCents: number;
    readonly receivedCents: number | null;
    readonly changeCents: number;
  }[];
  readonly voucherUses: readonly {
    readonly code: string;
    readonly amountCents: number;
  }[];
  readonly totalChangeCents: number;
}

const META_KEYS = {
  autoPrint: 'receipt_auto_print',
  printerName: 'receipt_printer_name',
  paperWidthMm: 'receipt_paper_width_mm',
} as const;

function getMeta(database: DatabaseContext, key: string): string | null {
  const row = database.sqlite.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as
    | { readonly value: string }
    | undefined;
  return row?.value ?? null;
}

function setMeta(database: DatabaseContext, key: string, value: string): void {
  database.sqlite
    .prepare(
      `INSERT INTO app_meta (key, value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .run(key, value, Date.now());
}

function deleteMeta(database: DatabaseContext, key: string): void {
  database.sqlite.prepare('DELETE FROM app_meta WHERE key = ?').run(key);
}

function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    failDatabaseOperation('FORBIDDEN', 'A configuração de impressão exige o perfil Produção.', {
      requiredProfile: 'production',
    });
  }
}

export function getReceiptSettings(database: DatabaseContext): DatabaseReceiptSettings {
  const paper = Number.parseInt(getMeta(database, META_KEYS.paperWidthMm) ?? '58', 10);

  return {
    autoPrint: getMeta(database, META_KEYS.autoPrint) === 'true',
    printerName: getMeta(database, META_KEYS.printerName),
    paperWidthMm: paper === 80 ? 80 : 58,
  };
}

export function updateReceiptSettings(
  database: DatabaseContext,
  input: DatabaseReceiptSettings,
): DatabaseReceiptSettings {
  requireProduction(database);
  const printerName = input.printerName?.trim() || null;
  const paperWidthMm = input.paperWidthMm === 80 ? 80 : 58;
  const now = Date.now();

  database.sqlite.transaction(() => {
    setMeta(database, META_KEYS.autoPrint, String(input.autoPrint));
    setMeta(database, META_KEYS.paperWidthMm, String(paperWidthMm));
    if (printerName === null) {
      deleteMeta(database, META_KEYS.printerName);
    } else {
      setMeta(database, META_KEYS.printerName, printerName);
    }

    appendAudit(database, {
      action: 'receipts.settings-updated',
      entityType: 'receipt-settings',
      entityId: null,
      eventId: getSessionState(database).activeEvent?.id ?? null,
      details: { autoPrint: input.autoPrint, paperWidthMm, printerName, updatedAt: now },
    });
  })();

  return getReceiptSettings(database);
}

export function getReceiptDocument(
  database: DatabaseContext,
  orderId: string,
): DatabaseReceiptDocument {
  const order = getOrder(database, orderId);

  if (order.status !== 'paid' || order.closedAt === null) {
    failDatabaseOperation('INVALID_STATE', 'Somente vendas concluídas podem ser impressas.', {
      orderId,
      status: order.status,
    });
  }

  const event = database.sqlite.prepare('SELECT name FROM events WHERE id = ?').get(order.eventId) as
    | { readonly name: string }
    | undefined;

  if (event === undefined) {
    failDatabaseOperation('NOT_FOUND', 'O evento da venda não foi encontrado.', {
      eventId: order.eventId,
      orderId,
    });
  }

  return {
    orderId: order.id,
    eventId: order.eventId,
    eventName: event.name,
    servicePointLabel: order.servicePointLabel,
    closedAt: order.closedAt,
    items: order.items.map((item) => ({
      name: item.itemName,
      quantity: item.quantity,
      unitPriceCents: item.unitPriceCents,
      totalCents: item.totalCents,
    })),
    totalCents: order.totalCents,
    payments: order.payments.map((payment) => ({
      method: payment.method,
      amountCents: payment.amountCents,
      receivedCents: payment.receivedCents,
      changeCents: payment.changeCents,
    })),
    voucherUses: order.voucherRedemptions.map((redemption) => ({
      code: redemption.code,
      amountCents: redemption.amountCents,
    })),
    totalChangeCents: order.payments.reduce((total, payment) => total + payment.changeCents, 0),
  };
}
