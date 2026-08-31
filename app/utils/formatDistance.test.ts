import { describe, it, expect } from 'vitest';
import { formatDistance } from './formatDistance';

describe('formatDistance', () => {
  it('converts a whole-km distance under 10km to meters', () => {
    expect(formatDistance(3)).toBe('3.000m');
  });

  it('converts a fractional-km distance under 10km to meters', () => {
    expect(formatDistance(0.3)).toBe('300m');
  });

  it('rounds to the nearest meter', () => {
    expect(formatDistance(0.4441)).toBe('444m');
  });

  it('handles zero', () => {
    expect(formatDistance(0)).toBe('0m');
  });

  it('uses a german thousands separator for distances just under 10km', () => {
    expect(formatDistance(1.3)).toBe('1.300m');
  });

  it('switches to km with one decimal at 10km', () => {
    expect(formatDistance(10)).toBe('10,0km');
  });

  it('formats km with a german decimal comma', () => {
    expect(formatDistance(10.4)).toBe('10,4km');
  });

  it('rounds km to one decimal', () => {
    expect(formatDistance(12.34)).toBe('12,3km');
  });
});
