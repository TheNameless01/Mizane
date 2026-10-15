/**
 * Date and timezone helper module for Mizan.
 * 
 * Rules:
 * - All timestamps are stored as ISO-8601 UTC strings.
 * - Calendar day boundaries, "today", and statement filters are calculated
 *   strictly in the "Africa/Algiers" timezone (UTC+1, no DST).
 */

export const ALGIERS_TIMEZONE = 'Africa/Algiers';

/**
 * Returns current timestamp in ISO-8601 UTC.
 */
export function getNowUtcIso(): string {
  return new Date().toISOString();
}

/**
 * Returns the calendar date string (YYYY-MM-DD) for a given date or now,
 * evaluated in the Africa/Algiers timezone.
 */
export function getAlgiersDateString(date: Date = new Date()): string {
  // Use Intl.DateTimeFormat with en-CA which outputs YYYY-MM-DD cleanly
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: ALGIERS_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Converts a UTC ISO timestamp or Date into the local calendar date (YYYY-MM-DD)
 * in Africa/Algiers.
 * Example: a timestamp at 23:30 UTC on Oct 15 is 00:30 on Oct 16 in Algiers.
 */
export function toAlgiersDate(utcIsoOrDate: string | Date): string {
  const d = typeof utcIsoOrDate === 'string' ? new Date(utcIsoOrDate) : utcIsoOrDate;
  if (isNaN(d.getTime())) {
    throw new Error('Date UTC invalide');
  }
  return getAlgiersDateString(d);
}

/**
 * Returns the UTC ISO boundaries for a given calendar day (YYYY-MM-DD) in Africa/Algiers.
 * In Africa/Algiers (UTC+1), the day YYYY-MM-DD begins at (YYYY-MM-DD - 1 hour) UTC
 * (i.e. previous day 23:00:00.000Z) and ends at 22:59:59.999Z.
 */
export function getAlgiersDayBoundariesUtc(algiersDateYmd: string): {
  startUtc: string;
  endUtc: string;
} {
  const parts = algiersDateYmd.split('-');
  if (parts.length !== 3) {
    throw new Error('Format de date invalide, attendu YYYY-MM-DD');
  }
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);

  // Africa/Algiers is UTC+1. Midnight Algiers (00:00:00) is 23:00:00 previous day UTC.
  // Using Date.UTC to construct the exact point in time:
  const startMs = Date.UTC(year, month, day, 0, 0, 0, 0) - (1 * 60 * 60 * 1000);
  const endMs = startMs + (24 * 60 * 60 * 1000) - 1;

  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs).toISOString(),
  };
}

/**
 * Formats a UTC ISO timestamp into a human-friendly display string,
 * evaluated in Africa/Algiers. Supports both 'fr' and 'ar' locales.
 * e.g., "15 oct. 2026" / "15 أكتوبر 2026" or "15/10/2026 14:30"
 */
export function formatDate(
  utcIso: string | null | undefined,
  options?: {
    includeTime?: boolean;
    format?: 'short' | 'long' | 'numeric';
    locale?: 'fr' | 'ar';
  }
): string {
  if (!utcIso) return '—';
  const d = new Date(utcIso);
  if (isNaN(d.getTime())) return '—';

  const format = options?.format || 'short';
  const includeTime = options?.includeTime ?? false;
  const locale = options?.locale === 'ar' ? 'ar-DZ' : 'fr-DZ';

  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: ALGIERS_TIMEZONE,
    numberingSystem: 'latn',
    day: '2-digit',
    month: format === 'numeric' ? '2-digit' : format === 'long' ? 'long' : 'short',
    year: 'numeric',
  };

  if (includeTime) {
    dateOptions.hour = '2-digit';
    dateOptions.minute = '2-digit';
  }

  return new Intl.DateTimeFormat(locale, dateOptions).format(d);
}

/**
 * Backward compatibility alias for formatDate in French.
 */
export function formatDateFr(
  utcIso: string | null | undefined,
  options?: {
    includeTime?: boolean;
    format?: 'short' | 'long' | 'numeric';
  }
): string {
  return formatDate(utcIso, { ...options, locale: 'fr' });
}

/**
 * Calculates due date in ISO UTC given sold_at date (ISO UTC) and payment terms in days.
 */
export function calculateDueDate(soldAtUtc: string, termsDays: number): string {
  const date = new Date(soldAtUtc);
  if (isNaN(date.getTime())) {
    throw new Error('Date de vente invalide');
  }
  const due = new Date(date.getTime() + termsDays * 24 * 60 * 60 * 1000);
  return due.toISOString();
}

/**
 * Computes overdue days count relative to now (in Algiers).
 * If due_date is in the future, returns 0.
 */
export function calculateDaysOverdue(dueDateUtc: string, referenceUtc: string = getNowUtcIso()): number {
  const dueMs = new Date(dueDateUtc).getTime();
  const refMs = new Date(referenceUtc).getTime();
  if (refMs <= dueMs) return 0;
  const diffDays = Math.floor((refMs - dueMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, diffDays);
}
