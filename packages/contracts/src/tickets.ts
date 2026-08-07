import { z } from 'zod';

import { paymentMethodSchema } from './operations';

export const ticketSaleSourceSchema = z.enum(['sympla', 'whatsapp', 'door', 'courtesy']);
export const ticketSaleStatusSchema = z.enum(['active', 'cancelled']);
export const ticketCodeStatusSchema = z.enum(['valid', 'cancelled']);

export const ticketLotSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  priceCents: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  soldQuantity: z.number().int().nonnegative(),
  courtesyQuantity: z.number().int().nonnegative(),
  availableQuantity: z.number().int().nonnegative(),
  active: z.boolean(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
});

export const ticketCodeSchema = z.object({
  id: z.uuid(),
  saleId: z.uuid(),
  code: z.string().trim().min(4).max(48),
  status: ticketCodeStatusSchema,
  createdAt: z.number().int().nonnegative(),
});

export const ticketSaleSchema = z.object({
  id: z.uuid(),
  eventId: z.uuid(),
  lotId: z.uuid(),
  lotName: z.string().trim().min(2).max(100),
  attendeeName: z.string().trim().min(2).max(120),
  source: ticketSaleSourceSchema,
  quantity: z.number().int().positive(),
  unitPriceCents: z.number().int().nonnegative(),
  totalCents: z.number().int().nonnegative(),
  paymentMethod: paymentMethodSchema.nullable(),
  status: ticketSaleStatusSchema,
  codes: z.array(ticketCodeSchema),
  createdAt: z.number().int().nonnegative(),
  cancelledAt: z.number().int().nonnegative().nullable(),
  updatedAt: z.number().int().nonnegative(),
});

export const ticketStateSchema = z.object({
  activeEventId: z.uuid().nullable(),
  lots: z.array(ticketLotSchema),
  sales: z.array(ticketSaleSchema),
  activeRevenueCents: z.number().int().nonnegative(),
});

export const createTicketLotInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  priceCents: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
});

export const updateTicketLotInputSchema = z.object({
  lotId: z.uuid(),
  name: z.string().trim().min(2).max(100),
  priceCents: z.number().int().nonnegative(),
  capacity: z.number().int().positive(),
  active: z.boolean(),
});

export const createTicketSaleInputSchema = z
  .object({
    lotId: z.uuid(),
    attendeeName: z.string().trim().min(2).max(120),
    source: ticketSaleSourceSchema,
    quantity: z.number().int().positive(),
    paymentMethod: paymentMethodSchema.optional(),
    manualCodes: z.array(z.string().trim().min(4).max(48)).optional(),
  })
  .superRefine((input, context) => {
    if (input.source !== 'courtesy' && input.paymentMethod === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['paymentMethod'],
        message: 'Informe a forma de pagamento da venda.',
      });
    }

    if (input.source === 'courtesy' && input.paymentMethod !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['paymentMethod'],
        message: 'Cortesias não possuem forma de pagamento.',
      });
    }

    if (input.manualCodes !== undefined && input.manualCodes.length !== input.quantity) {
      context.addIssue({
        code: 'custom',
        path: ['manualCodes'],
        message: 'A quantidade de códigos deve ser igual à quantidade de ingressos.',
      });
    }
  });

export const cancelTicketSaleInputSchema = z.object({
  saleId: z.uuid(),
  reason: z.string().trim().min(3).max(240),
});

export const cancelTicketCodeInputSchema = z.object({
  codeId: z.uuid(),
  reason: z.string().trim().min(3).max(240),
});

export type TicketSaleSource = z.infer<typeof ticketSaleSourceSchema>;
export type TicketSaleStatus = z.infer<typeof ticketSaleStatusSchema>;
export type TicketCodeStatus = z.infer<typeof ticketCodeStatusSchema>;
export type TicketLot = z.infer<typeof ticketLotSchema>;
export type TicketCode = z.infer<typeof ticketCodeSchema>;
export type TicketSale = z.infer<typeof ticketSaleSchema>;
export type TicketState = z.infer<typeof ticketStateSchema>;
export type CreateTicketLotInput = z.infer<typeof createTicketLotInputSchema>;
export type UpdateTicketLotInput = z.infer<typeof updateTicketLotInputSchema>;
export type CreateTicketSaleInput = z.infer<typeof createTicketSaleInputSchema>;
export type CancelTicketSaleInput = z.infer<typeof cancelTicketSaleInputSchema>;
export type CancelTicketCodeInput = z.infer<typeof cancelTicketCodeInputSchema>;

export interface TicketApi {
  getState(): Promise<TicketState>;
  createLot(input: CreateTicketLotInput): Promise<TicketLot>;
  updateLot(input: UpdateTicketLotInput): Promise<TicketLot>;
  createSale(input: CreateTicketSaleInput): Promise<TicketSale>;
  cancelSale(input: CancelTicketSaleInput): Promise<TicketSale>;
  cancelCode(input: CancelTicketCodeInput): Promise<TicketSale>;
}
