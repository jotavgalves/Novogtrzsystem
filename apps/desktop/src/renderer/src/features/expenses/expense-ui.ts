import type { PaymentMethod } from '@gtrz/contracts';

export const EXPENSE_PAYMENT_LABELS = {
  cash: 'Dinheiro',
  pix: 'PIX',
  'credit-card': 'Crédito',
  'debit-card': 'Débito',
} as const satisfies Readonly<Record<PaymentMethod, string>>;
