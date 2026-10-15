import { describe, it, expect } from 'vitest';
import {
  toAlgiersDate,
  getAlgiersDayBoundariesUtc,
  calculateDaysOverdue,
  calculateDueDate,
} from '../src/shared/dates';

describe('Mizan Dates & Timezone (Africa/Algiers)', () => {
  it('correctly maps UTC timestamps around midnight to Africa/Algiers (UTC+1)', () => {
    // 2026-10-15 at 22:30:00Z is 23:30:00 in Algiers (still Oct 15)
    const date1 = '2026-10-15T22:30:00.000Z';
    expect(toAlgiersDate(date1)).toBe('2026-10-15');

    // 2026-10-15 at 23:30:00Z is 00:30:00 on Oct 16 in Algiers (already Oct 16)
    const date2 = '2026-10-15T23:30:00.000Z';
    expect(toAlgiersDate(date2)).toBe('2026-10-16');

    // 2026-10-16 at 00:15:00Z is 01:15:00 on Oct 16 in Algiers
    const date3 = '2026-10-16T00:15:00.000Z';
    expect(toAlgiersDate(date3)).toBe('2026-10-16');
  });

  it('computes exact UTC boundaries for an Algiers calendar day', () => {
    const boundaries = getAlgiersDayBoundariesUtc('2026-10-15');
    // Midnight Algiers on 2026-10-15 is 2026-10-14 23:00:00Z
    expect(boundaries.startUtc).toBe('2026-10-14T23:00:00.000Z');
    // End of day Algiers is 2026-10-15 22:59:59.999Z
    expect(boundaries.endUtc).toBe('2026-10-15T22:59:59.999Z');
  });

  it('calculates due date and overdue days count', () => {
    const soldAt = '2026-10-01T10:00:00.000Z';
    const dueDate = calculateDueDate(soldAt, 15);
    expect(dueDate).toBe('2026-10-16T10:00:00.000Z');

    // If today is 2026-10-26 (10 days after due date):
    const referenceUtc = '2026-10-26T10:00:00.000Z';
    expect(calculateDaysOverdue(dueDate, referenceUtc)).toBe(10);

    // If today is before due date:
    const beforeRef = '2026-10-10T10:00:00.000Z';
    expect(calculateDaysOverdue(dueDate, beforeRef)).toBe(0);
  });
});
