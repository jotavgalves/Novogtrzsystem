import type { DatabasePaymentMethod } from './operation-types';

export type DatabaseTicketSaleSource = 'sympla' | 'whatsapp' | 'door' | 'courtesy';
export type DatabaseTicketSaleStatus = 'active' | 'cancelled';
export type DatabaseTicketCodeStatus = 'valid' | 'cancelled';

export interface DatabaseTicketLot {
  readonly id: string;
  readonly eventId: string;
  readonly name: string;
  readonly priceCents: number;
  readonly capacity: number;
  readonly soldQuantity: number;
  readonly courtesyQuantity: number;
  readonly availableQuantity: number;
  readonly active: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface DatabaseTicketCode {
  readonly id: string;
  readonly saleId: string;
  readonly code: string;
  readonly status: DatabaseTicketCodeStatus;
  readonly createdAt: number;
}

export interface DatabaseTicketSale {
  readonly id: string;
  readonly eventId: string;
  readonly lotId: string;
  readonly lotName: string;
  readonly attendeeName: string;
  readonly source: DatabaseTicketSaleSource;
  readonly quantity: number;
  readonly unitPriceCents: number;
  readonly totalCents: number;
  readonly paymentMethod: DatabasePaymentMethod | null;
  readonly status: DatabaseTicketSaleStatus;
  readonly codes: readonly DatabaseTicketCode[];
  readonly createdAt: number;
  readonly cancelledAt: number | null;
  readonly updatedAt: number;
}

export interface DatabaseTicketState {
  readonly activeEventId: string | null;
  readonly lots: readonly DatabaseTicketLot[];
  readonly sales: readonly DatabaseTicketSale[];
  readonly activeRevenueCents: number;
}

export interface TicketLotRow {
  readonly id: string;
  readonly event_id: string;
  readonly name: string;
  readonly price_cents: number;
  readonly capacity: number;
  readonly active: number;
  readonly sold_quantity: number;
  readonly courtesy_quantity: number;
  readonly created_at: number;
  readonly updated_at: number;
}

export interface TicketSaleRow {
  readonly id: string;
  readonly event_id: string;
  readonly lot_id: string;
  readonly lot_name: string;
  readonly attendee_name: string;
  readonly source: DatabaseTicketSaleSource;
  readonly quantity: number;
  readonly unit_price_cents: number;
  readonly total_cents: number;
  readonly payment_method: DatabasePaymentMethod | null;
  readonly status: DatabaseTicketSaleStatus;
  readonly created_at: number;
  readonly cancelled_at: number | null;
  readonly updated_at: number;
}

export interface TicketCodeRow {
  readonly id: string;
  readonly sale_id: string;
  readonly code: string;
  readonly status: DatabaseTicketCodeStatus;
  readonly created_at: number;
}
