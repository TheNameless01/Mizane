/**
 * Money and arithmetic module for Mizan.
 * 
 * Rules:
 * - All monetary values are strictly INTEGER centimes (1 DZD = 100 centimes).
 * - Floating point numbers are strictly forbidden for storage and arithmetic.
 * - Quantities are stored as INTEGER thousandths (e.g., 2.500 kg = 2500, 1 pc = 1000).
 * - Line total formula: round_half_up(quantity_thousandths * unit_price_centimes / 1000)
 */

/**
 * Round half-up arithmetic for integer division: numerator / denominator.
 * e.g., roundHalfUp(15, 10) = 2, roundHalfUp(14, 10) = 1.
 */
export function roundHalfUp(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    throw new Error('Denominator must be positive');
  }
  if (numerator >= 0) {
    return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
  } else {
    // For negative values, symmetrically round half away from zero
    return Math.ceil((numerator - Math.floor(denominator / 2)) / denominator);
  }
}

/**
 * Computes the line item total in centimes given quantity in thousandths
 * and unit price in centimes.
 * Example: 2.5 kg (2500 thousandths) @ 450.00 DZD (45000 centimes)
 * -> 2500 * 45000 / 1000 = 112500 centimes = 1,125.00 DZD
 */
export function calculateLineTotal(
  quantityThousandths: number,
  unitPriceCentimes: number
): number {
  if (!Number.isInteger(quantityThousandths) || !Number.isInteger(unitPriceCentimes)) {
    throw new Error('Quantity thousandths and unit price centimes must be integers');
  }
  if (quantityThousandths < 0 || unitPriceCentimes < 0) {
    throw new Error('Quantity and unit price cannot be negative');
  }
  const product = quantityThousandths * unitPriceCentimes;
  return roundHalfUp(product, 1000);
}

/**
 * Computes VAT in centimes from HT centimes and basis points rate (e.g. 1900 for 19%).
 */
export function calculateVat(htCentimes: number, vatRateBp: number | null): number {
  if (!vatRateBp || vatRateBp <= 0) return 0;
  // vatRateBp: 1900 = 19.00%, so denominator is 10,000
  return roundHalfUp(htCentimes * vatRateBp, 10000);
}

/**
 * Normalizes input string:
 * - Converts Arabic-Indic numerals (٠-٩) and Eastern Arabic / Persian numerals (۰-۹) to standard Latin digits (0-9)
 * - Converts Arabic comma (، U+060C) and Arabic decimal separator (٫ U+066B) to standard dot (.)
 * - Removes Arabic thousands separator (٬ U+066C)
 * - Normalizes unicode minus signs (U+2212, etc.) to standard hyphen (-)
 * - Removes invisible bidi control characters (LRM, RLM)
 * - Removes all whitespace variants (spaces, NBSP, thin NBSP)
 * - Converts comma decimal separators to dots.
 */
export function cleanNumberString(val: string): string {
  if (!val) return '';
  return val
    // Convert Arabic-Indic digits ٠-٩ (U+0660 to U+0669) to 0-9
    .replace(/[\u0660-\u0669]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0660 + 48))
    // Convert Eastern Arabic-Indic / Persian digits ۰-۹ (U+06F0 to U+06F9) to 0-9
    .replace(/[\u06F0-\u06F9]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x06F0 + 48))
    // Convert Arabic comma and Arabic decimal separator to standard dot
    .replace(/[\u060C\u066B,]/g, '.')
    // Remove Arabic thousands separator
    .replace(/[\u066C]/g, '')
    // Normalize unicode minus signs to standard ASCII -
    .replace(/[\u2212\u2010\u2011\u2012\u2013\u2014\u2015\uFE63\uFF0D]/g, '-')
    // Remove invisible bidi formatting marks
    .replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    // Remove all whitespace variants
    .replace(/[\s\u00A0\u202F\u2007\u200B\u2009]/g, '');
}

/**
 * Parses user-entered currency string into integer centimes.
 * Accepts:
 *  - "1 234,50" -> 123450
 *  - "1234.50"  -> 123450
 *  - "1234"     -> 123400
 *  - "0,75"     -> 75
 *  - "-500,00"  -> -50000
 * Throws an Error if input is empty, NaN, or has invalid format (more than 2 decimal places).
 */
export function parseMoneyToCentimes(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) throw new Error('Montant invalide');
    // If passed as number, ensure it represents DZD, convert to centimes safely
    return Math.round(input * 100);
  }

  if (typeof input !== 'string') {
    throw new Error('Montant invalide');
  }

  const cleaned = cleanNumberString(input.trim());
  if (!cleaned) {
    throw new Error('Le montant ne peut pas être vide');
  }

  // Regex matching optional minus sign, digits, and optional 1 or 2 decimals
  const match = cleaned.match(/^(-)?(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error('Format de montant invalide (ex: 1250,50 ou 1250)');
  }

  const isNegative = !!match[1];
  const wholePart = parseInt(match[2], 10);
  const decimalPartRaw = match[3] || '';

  if (decimalPartRaw.length > 2) {
    // Wholesalers use 2 decimals (centimes). If more provided, reject or round
    throw new Error('Le montant ne peut comporter que 2 décimales au maximum');
  }

  const decimalPart = parseInt((decimalPartRaw + '00').slice(0, 2), 10);
  const total = wholePart * 100 + decimalPart;

  return isNegative ? -total : total;
}

/**
 * Parses quantity input (e.g. "2,5", "2.5", "10") into integer thousandths.
 * e.g. "2,5" -> 2500, "10" -> 10000, "0.125" -> 125.
 */
export function parseQuantityToThousandths(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input < 0) throw new Error('Quantité invalide');
    return Math.round(input * 1000);
  }

  if (typeof input !== 'string') {
    throw new Error('Quantité invalide');
  }

  const cleaned = cleanNumberString(input.trim());
  if (!cleaned) throw new Error('La quantité ne peut pas être vide');

  const match = cleaned.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match) {
    throw new Error('Format de quantité invalide (ex: 2.5 ou 10)');
  }

  const wholePart = parseInt(match[1], 10);
  const decimalPartRaw = match[2] || '';
  if (decimalPartRaw.length > 3) {
    throw new Error('La quantité ne peut comporter que 3 décimales au maximum (millièmes)');
  }

  const decimalPart = parseInt((decimalPartRaw + '000').slice(0, 3), 10);
  const total = wholePart * 1000 + decimalPart;

  if (total <= 0) {
    throw new Error('La quantité doit être supérieure à zéro');
  }

  return total;
}

/**
 * Formats quantity thousandths for display (e.g. 2500 -> "2,5", 10000 -> "10").
 */
export function formatQuantity(thousandths: number, unit?: string): string {
  const whole = Math.floor(thousandths / 1000);
  const frac = thousandths % 1000;
  let str = whole.toString();
  if (frac > 0) {
    const fracStr = (frac / 1000).toFixed(3).slice(2).replace(/0+$/, '');
    str += ',' + fracStr;
  }
  return unit ? `\u200E${str}\u200E ${unit}` : str;
}

/**
 * Converts integer centimes to DZD float for formatting.
 */
export function centimesToDZD(centimes: number): number {
  return centimes / 100;
}

/**
 * Formats centimes into standard Algerian DZD currency representation.
 * Standard format: "1 250,00 DZD" with Latin digits.
 * In Arabic mode, uses Left-to-Right marks (\u200E) to protect negative signs and decimals
 * from bidirectional inversion in RTL views.
 */
export function formatDZD(
  centimes: number,
  options?: {
    showSign?: boolean;
    showSymbol?: boolean;
    alwaysDecimals?: boolean;
    locale?: 'fr' | 'ar';
    symbol?: string;
  }
): string {
  const isNegative = centimes < 0;
  const absCentimes = Math.abs(centimes);
  const dzdValue = absCentimes / 100;

  const showDecimals = options?.alwaysDecimals !== false || absCentimes % 100 !== 0;

  // Use Intl.NumberFormat for fr-DZ locale with numberingSystem latn
  const formatter = new Intl.NumberFormat('fr-DZ', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  });

  let formatted = formatter.format(dzdValue);
  // Normalize narrow non-breaking spaces (\u202F, \u00A0) to standard spaces for crisp presentation
  formatted = formatted.replace(/[\u202F\u00A0]/g, ' ');

  const sign = isNegative ? '-' : options?.showSign && centimes > 0 ? '+' : '';
  const isArabic = options?.locale === 'ar';
  const defaultSymbol = isArabic ? 'دج' : 'DZD';
  const symbol = options?.showSymbol !== false ? (options?.symbol ? ` ${options.symbol}` : ` ${defaultSymbol}`) : '';

  if (isArabic) {
    return `\u200E${sign}${formatted}\u200E${symbol}`;
  }

  return `${sign}${formatted}${symbol}`;
}

/**
 * Returns human-readable label and status for customer balance.
 * Positive = Customer owes money ("Solde dû")
 * Negative = Customer has credit / advance payment ("Crédit client")
 * Zero = Cleared ("Solde réglé")
 */
export function getBalanceStatus(
  balanceCentimes: number,
  locale: 'fr' | 'ar' = 'fr'
): {
  type: 'debt' | 'credit' | 'zero';
  label: string;
  badgeClass: string;
  textClass: string;
} {
  const isArabic = locale === 'ar';

  if (balanceCentimes > 0) {
    return {
      type: 'debt',
      label: isArabic ? 'دين مستحق' : 'Solde dû',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
      textClass: 'text-amber-700 dark:text-amber-400 font-semibold',
    };
  } else if (balanceCentimes < 0) {
    return {
      type: 'credit',
      label: isArabic ? 'رصيد دائن (تسبيق)' : 'Crédit client',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
      textClass: 'text-emerald-700 dark:text-emerald-400 font-semibold',
    };
  } else {
    return {
      type: 'zero',
      label: isArabic ? 'حساب مسوى' : 'Solde réglé',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      textClass: 'text-slate-600 dark:text-slate-400',
    };
  }
}

