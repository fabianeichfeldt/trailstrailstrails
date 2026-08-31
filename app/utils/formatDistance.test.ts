import { describe, it, expect } from 'vitest';
import { formatDistanceMeters } from './formatDistance';

describe('formatDistanceMeters', () => {
  it('converts a whole-km distance to meters', () => {
    expect(formatDistanceMeters(3)).toBe('3000 m');
  });

  it('converts a fractional-km distance to meters', () => {
    expect(formatDistanceMeters(0.3)).toBe('300 m');
  });

  it('rounds to the nearest meter', () => {
    expect(formatDistanceMeters(0.4441)).toBe('444 m');
  });

  it('handles zero', () => {
    expect(formatDistanceMeters(0)).toBe('0 m');
  });
});
