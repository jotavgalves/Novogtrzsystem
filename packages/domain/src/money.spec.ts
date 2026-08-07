import { describe, expect, it } from 'vitest';

import {
  assertIntegerCents,
  calculateGrossProfit,
  calculateMarginPercent,
  formatCurrency,
  formatCurrencyInput,
  parseCurrencyInput,
} from './money';

describe('money', () => {
  it('calcula lucro bruto em centavos', () => {
    expect(calculateGrossProfit(1_000, 600)).toBe(400);
  });

  it('permite lucro bruto negativo', () => {
    expect(calculateGrossProfit(500, 650)).toBe(-150);
  });

  it('calcula margem sobre o preço de venda', () => {
    expect(calculateMarginPercent(1_000, 600)).toBe(40);
  });

  it('retorna margem zero quando não existe preço de venda válido', () => {
    expect(calculateMarginPercent(0, 600)).toBe(0);
  });

  it('rejeita valores monetários fracionados fora de centavos inteiros', () => {
    expect(() => assertIntegerCents(10.5)).toThrow(TypeError);
  });

  it('formata centavos como reais para exibicao', () => {
    expect(formatCurrency(123_456)).toBe('R$ 1.234,56');
  });

  it('formata centavos para campos monetarios', () => {
    expect(formatCurrencyInput(5_050)).toBe('50,50');
  });

  it('interpreta entradas monetarias em portugues', () => {
    expect(parseCurrencyInput('10')).toBe(1_000);
    expect(parseCurrencyInput('10,50')).toBe(1_050);
    expect(parseCurrencyInput('1.000,50')).toBe(100_050);
    expect(parseCurrencyInput('R$ 50,00')).toBe(5_000);
  });
});
