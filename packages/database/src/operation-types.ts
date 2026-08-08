import type { DatabaseOrderVoucherAllocation } from './operation-vouchers';
import type { DatabaseServicePoint } from './service-point-types';
import type { DatabaseVoucherRedemption } from './voucher-types';

export type {
  DatabaseServicePoint,
  DatabaseServicePointStatus,
  DatabaseServicePointType,
} from './service-point-types';
export type DatabaseOrderStatus = 'open' | 'paid' | 'cancelled';
export type DatabaseOrderItemKind = 'product' | 'combo';
export type DatabasePaymentMethod = 'cash' | 'pix' | 'credit-card' | 'debit-card';

export interface DatabaseOrderItem {
  readonly id: string;
  readonly orderId: string;
  readonly itemKind: DatabaseOrderItemKind;
  readonly itemId: string;
  readonly itemName: string;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly totalCents: number;
  readonly createdAt: number;
}

export interface DatabasePayment {
  readonly id: string;
  readonly orderId: string;
  readonly method: DatabasePaymentMethod;
  readonly amountCents: number;
  readonly receivedCents: number | null;
  readonly changeCents: number;
  readonly createdAt: number;
}

export interface DatabaseOrder {
  readonly id: string;
  readonly eventId: string;
  readonly servicePointId: string;
  readonly servicePointLabel: string;
  readonly status: DatabaseOrderStatus;
  readonly subtotalCents: number;
  readonly discountCents: number;
  readonly totalCents: number;
  readonly paidCents: number;
  readonly remainingCents: number;
  readonly items: readonly DatabaseOrderItem[];
  readonly payments: readonly DatabasePayment[];
  readonly voucherAllocation: DatabaseOrderVoucherAllocation | null;
  readonly voucherRedemptions: readonly DatabaseVoucherRedemption[];
  readonly openedAt: number;
  readonly closedAt: number | null;
  readonly updatedAt: number;
}

export interface DatabaseOperationCatalogComponent {
  readonly productId: string;
  readonly quantity: number;
}

export interface DatabaseOperationCatalogItem {
  readonly id: string;
  readonly kind: DatabaseOrderItemKind;
  readonly name: string;
  readonly salePriceCents: number;
  readonly availableQuantity: number;
  readonly active: boolean;
  readonly components: readonly DatabaseOperationCatalogComponent[];
}

export interface DatabaseOperationState {
  readonly activeEventId: string | null;
  readonly servicePoints: readonly DatabaseServicePoint[];
  readonly catalog: readonly DatabaseOperationCatalogItem[];
  readonly recentOrders: readonly DatabaseOrder[];
}

export interface DatabaseCloseOrderPaymentInput {
  readonly method: DatabasePaymentMethod;
  readonly amountCents: number;
  readonly receivedCents?: number;
}
