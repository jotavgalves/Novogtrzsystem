export function assertIntegerCents(value: number): number {
  if (!Number.isInteger(value)) {
    throw new TypeError('Valores monetários devem ser informados em centavos inteiros.');
  }

  return value;
}

export function calculateGrossProfit(salePriceCents: number, costPriceCents: number): number {
  assertIntegerCents(salePriceCents);
  assertIntegerCents(costPriceCents);
  return salePriceCents - costPriceCents;
}

export function calculateMarginPercent(salePriceCents: number, costPriceCents: number): number {
  assertIntegerCents(salePriceCents);
  assertIntegerCents(costPriceCents);

  if (salePriceCents <= 0) {
    return 0;
  }

  const grossProfitCents = calculateGrossProfit(salePriceCents, costPriceCents);
  return Math.round((grossProfitCents / salePriceCents) * 10_000) / 100;
}

export function formatCurrency(cents: number): string {
  assertIntegerCents(cents);
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    style: 'currency',
  }).format(cents / 100);
}

export function formatCurrencyInput(cents: number): string {
  assertIntegerCents(cents);
  return (cents / 100).toFixed(2).replace('.', ',');
}

export function parseCurrencyInput(value: string): number {
  const sanitized = value
    .trim()
    .replaceAll(/\s/gu, '')
    .replaceAll(/[^\d,.-]/gu, '');

  if (sanitized.length === 0) {
    return 0;
  }

  const normalized = sanitized.includes(',')
    ? sanitized.replaceAll('.', '').replace(',', '.')
    : sanitized;
  const amount = Number(normalized);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}
