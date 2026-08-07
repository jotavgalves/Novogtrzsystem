import { randomUUID } from 'node:crypto';

import { appendAudit } from './audit';
import { getSessionState } from './control';
import { formatCurrencyForMessage } from './currency-format';
import { failDatabaseOperation } from './database-error';
import type { DatabaseContext } from './types';
import {
  generateVoucherCode,
  insertTransaction,
  mapVoucher,
  mapVoucherTransaction,
  normalizeCode,
  requireVoucherByCode,
  requireVoucherById,
  type VoucherRefundRow,
  type VoucherRow,
  type VoucherTransactionRow,
} from './voucher-records';
import type {
  DatabaseVoucher,
  DatabaseVoucherRedemption,
  DatabaseVoucherState,
  DatabaseVoucherStatus,
  DatabaseVoucherUseInput,
} from './voucher-types';
import { listVoucherServicePoints, resolveLinkedServicePoint } from './voucher-service-points';

export {
  insertTransaction,
  mapVoucher,
  normalizeCode,
  requireVoucherById,
} from './voucher-records';
export type { VoucherRow } from './voucher-records';
export type {
  DatabaseVoucher,
  DatabaseVoucherRedemption,
  DatabaseVoucherState,
  DatabaseVoucherStatus,
  DatabaseVoucherTransaction,
  DatabaseVoucherTransactionType,
  DatabaseVoucherUseInput,
} from './voucher-types';

export function requireProduction(database: DatabaseContext): void {
  if (getSessionState(database).profile !== 'production') {
    failDatabaseOperation('FORBIDDEN', 'A administração de vouchers exige o perfil Produção.', {
      requiredProfile: 'production',
    });
  }
}

export function requireActiveEvent(database: DatabaseContext): string {
  const eventId = getSessionState(database).activeEvent?.id;

  if (eventId === undefined) {
    failDatabaseOperation(
      'INVALID_STATE',
      'Selecione um evento aberto antes de administrar vouchers.',
      { requiredState: 'active-open-event' },
    );
  }

  return eventId;
}

export function getVoucherState(database: DatabaseContext): DatabaseVoucherState {
  const eventId = getSessionState(database).activeEvent?.id ?? null;

  if (eventId === null) {
    return { activeEventId: null, servicePoints: [], vouchers: [], transactions: [] };
  }

  const vouchers = database.sqlite
    .prepare(
      `SELECT id, event_id, code, label, linked_service_point_id, linked_service_point_label,
              initial_balance_cents, remaining_balance_cents, status, created_at, updated_at
       FROM vouchers
       WHERE event_id = ?
       ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'exhausted' THEN 1 ELSE 2 END,
                updated_at DESC`,
    )
    .all(eventId) as VoucherRow[];
  const transactions = database.sqlite
    .prepare(
      `SELECT id, event_id, voucher_id, voucher_code, order_id, type, amount_cents,
              balance_before_cents, balance_after_cents, note, created_at
       FROM voucher_transactions
       WHERE event_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT 100`,
    )
    .all(eventId) as VoucherTransactionRow[];

  return {
    activeEventId: eventId,
    servicePoints: listVoucherServicePoints(database, eventId),
    vouchers: vouchers.map(mapVoucher),
    transactions: transactions.map(mapVoucherTransaction),
  };
}

export function createVoucher(
  database: DatabaseContext,
  input: {
    readonly code?: string | undefined;
    readonly label: string;
    readonly linkedServicePointId?: string | null | undefined;
    readonly initialBalanceCents: number;
  },
): DatabaseVoucher {
  requireProduction(database);
  const eventId = requireActiveEvent(database);
  const code = normalizeCode(input.code ?? generateVoucherCode());
  const label = input.label.trim();
  const linkedServicePoint = resolveLinkedServicePoint(
    database,
    eventId,
    input.linkedServicePointId,
  );
  const duplicate = database.sqlite
    .prepare('SELECT id FROM vouchers WHERE event_id = ? AND code = ? COLLATE NOCASE')
    .get(eventId, code);

  if (duplicate !== undefined) {
    failDatabaseOperation('CONFLICT', 'Já existe um voucher com esse código no evento.', {
      eventId,
      code,
    });
  }

  if (!Number.isInteger(input.initialBalanceCents) || input.initialBalanceCents <= 0) {
    failDatabaseOperation('VALIDATION_ERROR', 'O saldo inicial do voucher deve ser positivo.', {
      field: 'initialBalanceCents',
      value: input.initialBalanceCents,
    });
  }

  const voucherId = randomUUID();
  const now = Date.now();
  database.sqlite.transaction(() => {
    database.sqlite
      .prepare(
        `INSERT INTO vouchers
         (id, event_id, code, label, linked_service_point_id, linked_service_point_label,
          initial_balance_cents, remaining_balance_cents, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      )
      .run(
        voucherId,
        eventId,
        code,
        label,
        linkedServicePoint.linkedServicePointId,
        linkedServicePoint.linkedServicePointLabel,
        input.initialBalanceCents,
        input.initialBalanceCents,
        now,
        now,
      );
    insertTransaction(database, {
      eventId,
      voucherId,
      voucherCode: code,
      orderId: null,
      type: 'issue',
      amountCents: input.initialBalanceCents,
      balanceBeforeCents: 0,
      balanceAfterCents: input.initialBalanceCents,
      note: label,
      createdAt: now,
    });
    appendAudit(database, {
      action: 'voucher.created',
      entityType: 'voucher',
      entityId: voucherId,
      eventId,
      details: {
        code,
        initialBalanceCents: input.initialBalanceCents,
        label,
        linkedServicePointId: linkedServicePoint.linkedServicePointId,
        linkedServicePointLabel: linkedServicePoint.linkedServicePointLabel,
      },
    });
  })();

  return mapVoucher(requireVoucherById(database, voucherId));
}

export function changeVoucherStatus(
  database: DatabaseContext,
  input: { readonly voucherId: string; readonly status: 'active' | 'cancelled' },
): DatabaseVoucher {
  requireProduction(database);
  const eventId = requireActiveEvent(database);
  const voucher = requireVoucherById(database, input.voucherId);

  if (voucher.event_id !== eventId) {
    failDatabaseOperation('INVALID_STATE', 'O voucher não pertence ao evento ativo.', {
      voucherId: voucher.id,
      voucherEventId: voucher.event_id,
      activeEventId: eventId,
    });
  }

  if (input.status === 'active' && voucher.remaining_balance_cents === 0) {
    failDatabaseOperation('INVALID_STATE', 'Um voucher sem saldo não pode ser reativado.', {
      voucherId: voucher.id,
      remainingBalanceCents: 0,
    });
  }

  if (voucher.status === input.status) {
    return mapVoucher(voucher);
  }

  const now = Date.now();
  database.sqlite.transaction(() => {
    database.sqlite
      .prepare('UPDATE vouchers SET status = ?, updated_at = ? WHERE id = ?')
      .run(input.status, now, voucher.id);
    insertTransaction(database, {
      eventId,
      voucherId: voucher.id,
      voucherCode: voucher.code,
      orderId: null,
      type: input.status === 'active' ? 'reactivation' : 'cancellation',
      amountCents: 0,
      balanceBeforeCents: voucher.remaining_balance_cents,
      balanceAfterCents: voucher.remaining_balance_cents,
      note: null,
      createdAt: now,
    });
    appendAudit(database, {
      action: `voucher.${input.status}`,
      entityType: 'voucher',
      entityId: voucher.id,
      eventId,
      details: { code: voucher.code, previousStatus: voucher.status },
    });
  })();

  return mapVoucher(requireVoucherById(database, voucher.id));
}

export function redeemVouchers(
  database: DatabaseContext,
  eventId: string,
  orderId: string,
  uses: readonly DatabaseVoucherUseInput[],
  now: number,
): readonly DatabaseVoucherRedemption[] {
  const normalizedCodes = uses.map((use) => normalizeCode(use.code));

  if (new Set(normalizedCodes).size !== normalizedCodes.length) {
    failDatabaseOperation(
      'CONFLICT',
      'O mesmo voucher não pode ser informado duas vezes na comanda.',
      {
        eventId,
        orderId,
        codes: normalizedCodes,
      },
    );
  }

  return uses.map((use) => {
    if (!Number.isInteger(use.amountCents) || use.amountCents <= 0) {
      failDatabaseOperation('VALIDATION_ERROR', 'O valor utilizado do voucher deve ser positivo.', {
        field: 'amountCents',
        value: use.amountCents,
      });
    }

    const voucher = requireVoucherByCode(database, eventId, use.code);

    if (voucher.status !== 'active') {
      failDatabaseOperation('INVALID_STATE', `O voucher ${voucher.code} não está ativo.`, {
        voucherId: voucher.id,
        code: voucher.code,
        status: voucher.status,
      });
    }

    if (voucher.remaining_balance_cents < use.amountCents) {
      failDatabaseOperation(
        'INSUFFICIENT_BALANCE',
        `Saldo insuficiente no voucher ${voucher.code}. Disponível: ${formatCurrencyForMessage(voucher.remaining_balance_cents)}.`,
        {
          voucherId: voucher.id,
          code: voucher.code,
          requestedCents: use.amountCents,
          availableCents: voucher.remaining_balance_cents,
        },
      );
    }

    const nextBalance = voucher.remaining_balance_cents - use.amountCents;
    const nextStatus: DatabaseVoucherStatus = nextBalance === 0 ? 'exhausted' : 'active';
    database.sqlite
      .prepare(
        `UPDATE vouchers
         SET remaining_balance_cents = ?, status = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(nextBalance, nextStatus, now, voucher.id);
    insertTransaction(database, {
      eventId,
      voucherId: voucher.id,
      voucherCode: voucher.code,
      orderId,
      type: 'redemption',
      amountCents: use.amountCents,
      balanceBeforeCents: voucher.remaining_balance_cents,
      balanceAfterCents: nextBalance,
      note: null,
      createdAt: now,
    });

    return { voucherId: voucher.id, code: voucher.code, amountCents: use.amountCents };
  });
}

export function listOrderVoucherRedemptions(
  database: DatabaseContext,
  orderId: string,
): readonly DatabaseVoucherRedemption[] {
  const rows = database.sqlite
    .prepare(
      `SELECT voucher_id, voucher_code, SUM(amount_cents) AS amount_cents
       FROM voucher_transactions
       WHERE order_id = ? AND type = 'redemption'
       GROUP BY voucher_id, voucher_code
       ORDER BY voucher_code`,
    )
    .all(orderId) as VoucherRefundRow[];
  return rows.map((row) => ({
    voucherId: row.voucher_id,
    code: row.voucher_code,
    amountCents: row.amount_cents,
  }));
}

export function refundOrderVouchers(
  database: DatabaseContext,
  eventId: string,
  orderId: string,
  now: number,
): number {
  const alreadyRefunded = database.sqlite
    .prepare(
      `SELECT 1 FROM voucher_transactions
       WHERE order_id = ? AND type = 'refund'
       LIMIT 1`,
    )
    .get(orderId);

  if (alreadyRefunded !== undefined) {
    failDatabaseOperation('CONFLICT', 'Os vouchers desta comanda já foram restituídos.', {
      eventId,
      orderId,
    });
  }

  const redemptions = listOrderVoucherRedemptions(database, orderId);

  for (const redemption of redemptions) {
    const voucher = requireVoucherById(database, redemption.voucherId);

    if (voucher.event_id !== eventId) {
      failDatabaseOperation(
        'INVALID_STATE',
        'Um voucher utilizado não pertence ao evento da comanda.',
        {
          voucherId: voucher.id,
          voucherEventId: voucher.event_id,
          orderEventId: eventId,
          orderId,
        },
      );
    }

    const nextBalance = voucher.remaining_balance_cents + redemption.amountCents;

    if (nextBalance > voucher.initial_balance_cents) {
      failDatabaseOperation(
        'INTEGRITY_ERROR',
        `A restituição ultrapassaria o saldo inicial do voucher ${voucher.code}.`,
        {
          voucherId: voucher.id,
          initialBalanceCents: voucher.initial_balance_cents,
          attemptedBalanceCents: nextBalance,
        },
      );
    }

    const nextStatus: DatabaseVoucherStatus =
      voucher.status === 'cancelled' ? 'cancelled' : 'active';
    database.sqlite
      .prepare(
        `UPDATE vouchers
         SET remaining_balance_cents = ?, status = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(nextBalance, nextStatus, now, voucher.id);
    insertTransaction(database, {
      eventId,
      voucherId: voucher.id,
      voucherCode: voucher.code,
      orderId,
      type: 'refund',
      amountCents: redemption.amountCents,
      balanceBeforeCents: voucher.remaining_balance_cents,
      balanceAfterCents: nextBalance,
      note: 'Estorno da comanda',
      createdAt: now,
    });
  }

  return redemptions.reduce((total, redemption) => total + redemption.amountCents, 0);
}
