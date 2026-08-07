import type { DatabaseServicePoint } from './service-point-types';

export type DatabaseVoucherStatus = 'active' | 'exhausted' | 'cancelled';
export type DatabaseVoucherTransactionType =
  | 'issue'
  | 'redemption'
  | 'cancellation'
  | 'reactivation'
  | 'refund';

export interface DatabaseVoucher {
  readonly id: string;
  readonly eventId: string;
  readonly code: string;
  readonly label: string;
  readonly linkedServicePointId: string | null;
  readonly linkedServicePointLabel: string | null;
  readonly initialBalanceCents: number;
  readonly remainingBalanceCents: number;
  readonly status: DatabaseVoucherStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface DatabaseVoucherTransaction {
  readonly id: string;
  readonly eventId: string;
  readonly voucherId: string;
  readonly voucherCode: string;
  readonly orderId: string | null;
  readonly type: DatabaseVoucherTransactionType;
  readonly amountCents: number;
  readonly balanceBeforeCents: number;
  readonly balanceAfterCents: number;
  readonly note: string | null;
  readonly createdAt: number;
}

export interface DatabaseVoucherState {
  readonly activeEventId: string | null;
  readonly servicePoints: readonly DatabaseServicePoint[];
  readonly vouchers: readonly DatabaseVoucher[];
  readonly transactions: readonly DatabaseVoucherTransaction[];
}

export interface DatabaseVoucherUseInput {
  readonly code: string;
  readonly amountCents: number;
}

export interface DatabaseVoucherRedemption {
  readonly voucherId: string;
  readonly code: string;
  readonly amountCents: number;
}
