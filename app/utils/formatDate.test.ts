import { describe, it, expect } from 'vitest';
import { formatDate, formatDateFromDate } from './formatDate';

describe('formatDate', () => {
  it('formats an ISO date string in German locale', () => {
    expect(formatDate('2024-03-15')).toBe('15. März 2024');
  });

  it('formats January correctly', () => {
    expect(formatDate('2024-01-01')).toBe('1. Januar 2024');
  });

  it('formats December correctly', () => {
    expect(formatDate('2023-12-31')).toBe('31. Dezember 2023');
  });

  it('handles single-digit days without leading zero', () => {
    expect(formatDate('2024-06-05')).toBe('5. Juni 2024');
  });
});

describe('formatDateFromDate', () => {
  it('formats a Date object in German locale', () => {
    const date = new Date('2024-08-20');
    expect(formatDateFromDate(date)).toBe('20. August 2024');
  });

  it('produces the same output as formatDate for equivalent input', () => {
    const isoStr = '2024-11-11';
    const date = new Date(isoStr);
    expect(formatDateFromDate(date)).toBe(formatDate(isoStr));
  });
});
