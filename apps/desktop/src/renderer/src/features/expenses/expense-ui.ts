import type { ExpenseStatus, PaymentMethod } from '@gtrz/contracts';

export const EXPENSE_PAYMENT_LABELS = {
  cash: 'Dinheiro',
  pix: 'PIX',
  'credit-card': 'Crédito',
  'debit-card': 'Débito',
} as const satisfies Readonly<Record<PaymentMethod, string>>;

export const EXPENSE_STATUS_LABELS = {
  open: 'Aberta',
  partial: 'Parcial',
  paid: 'Paga',
  cancelled: 'Cancelada',
} as const satisfies Readonly<Record<ExpenseStatus, string>>;
