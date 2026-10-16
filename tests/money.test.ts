import { describe, it, expect } from 'vitest';
import {
  calculateLineTotal,
  parseMoneyToCentimes,
  parseQuantityToThousandths,
  formatDZD,
  roundHalfUp,
  getBalanceStatus,
} from '../src/shared/money';

describe('Mizan Money & Arithmetic', () => {
  it('parses formatted Algerian currency strings accurately into centimes', () => {
    // Normal space
    expect(parseMoneyToCentimes('1 234,50')).toBe(123450);
    expect(parseMoneyToCentimes('1234.50')).toBe(123450);
    expect(parseMoneyToCentimes('1 234.50')).toBe(123450);
    // Non-breaking space (\u00A0) and narrow non-breaking space (\u202F)
    expect(parseMoneyToCentimes('1\u00A0234,50')).toBe(123450);
    expect(parseMoneyToCentimes('1\u202F234,50')).toBe(123450);
    // Integer values
    expect(parseMoneyToCentimes('500')).toBe(50000);
    expect(parseMoneyToCentimes('0,75')).toBe(75);
    // Negative values
    expect(parseMoneyToCentimes('-2 500,00')).toBe(-250000);
    // Arabic-Indic numerals (٠-٩) and Arabic decimal separator (٫) / comma (،)
    expect(parseMoneyToCentimes('١ ٢٣٤،٥٠')).toBe(123450);
    expect(parseMoneyToCentimes('1250٫50')).toBe(125050);
    expect(parseMoneyToCentimes('٥٠٠')).toBe(50000);
    expect(parseMoneyToCentimes('-٥٠٠')).toBe(-50000);
  });

  it('rejects garbage or malformed money inputs', () => {
    expect(() => parseMoneyToCentimes('')).toThrow();
    expect(() => parseMoneyToCentimes('abc')).toThrow();
    expect(() => parseMoneyToCentimes('12.345')).toThrow(); // more than 2 decimals
    expect(() => parseMoneyToCentimes('12,34,50')).toThrow();
  });

  it('parses fractional quantities into integer thousandths', () => {
    expect(parseQuantityToThousandths('1')).toBe(1000);
    expect(parseQuantityToThousandths('2,5')).toBe(2500);
    expect(parseQuantityToThousandths('2.5')).toBe(2500);
    expect(parseQuantityToThousandths('0,125')).toBe(125);
    expect(parseQuantityToThousandths(10)).toBe(10000);
  });

  it('rejects zero or negative quantities', () => {
    expect(() => parseQuantityToThousandths('0')).toThrow();
    expect(() => parseQuantityToThousandths('-2.5')).toThrow();
  });

  it('calculates line totals with half-up rounding and avoids floating point traps', () => {
    // 2.5 kg (2500 thousandths) @ 450.00 DZD (45000 centimes)
    // 2500 * 45000 / 1000 = 112500 centimes = 1,125.00 DZD
    expect(calculateLineTotal(2500, 45000)).toBe(112500);

    // Floating-point trap case: 0.1 + 0.2 in floats, here in integers:
    // 3 items @ 33.33 DZD (3333 centimes)
    // 3000 * 3333 / 1000 = 9999 centimes
    expect(calculateLineTotal(3000, 3333)).toBe(9999);

    // Rounding half-up: 1.5 units @ 1.05 DZD
    // 1500 * 105 / 1000 = 157.5 -> rounded half-up to 158
    expect(calculateLineTotal(1500, 105)).toBe(158);

    // 1 unit @ 0 centimes = 0 centimes
    expect(calculateLineTotal(1000, 0)).toBe(0);
  });

  it('formats DZD currency with Latin digits without crashing on non-breaking spaces', () => {
    const formatted1 = formatDZD(123450);
    // Should contain 1 234,50 or 1234,50 and DZD
    expect(formatted1).toMatch(/1[\s\u00A0\u202F]?234,50/);
    expect(formatted1).toContain('DZD');

    const formatted2 = formatDZD(-50000);
    expect(formatted2).toMatch(/-500,00/);
  });

  it('identifies balance status (debt, credit, zero)', () => {
    expect(getBalanceStatus(5000).type).toBe('debt');
    expect(getBalanceStatus(5000).label).toBe('Solde dû');

    expect(getBalanceStatus(-5000).type).toBe('credit');
    expect(getBalanceStatus(-5000).label).toBe('Crédit client');

    expect(getBalanceStatus(0).type).toBe('zero');
    expect(getBalanceStatus(0).label).toBe('Solde réglé');
  });
});
