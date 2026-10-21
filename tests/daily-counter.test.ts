import { describe, expect, it } from 'vitest';
import { admitDaily, localDay, nextMidnight } from '../utils/daily-counter';
const today = new Date(2026, 9, 21, 23, 59, 59);

describe('durable daily allowance', () => {
  it('retains post IDs across reloads and does not count repeats', () => {
    const saved = JSON.parse(JSON.stringify(admitDaily(undefined, ['1', '2'], 3, today)));
    expect(admitDaily(saved, ['2', '3', '4'], 3, today).ids).toEqual(['1', '2', '3']);
    expect(admitDaily(saved, [], 3, today).ids).toEqual(['1', '2']);
  });
  it('resets on the next local calendar day', () => {
    const saved = admitDaily(undefined, ['1', '2'], 2, today);
    const midnight = new Date(2026, 9, 22);
    expect(admitDaily(saved, [], 2, midnight)).toEqual({ day: localDay(midnight), ids: [] });
    expect(admitDaily(saved, ['3'], 2, midnight).ids).toEqual(['3']);
    expect(nextMidnight(today)).toBe(midnight.getTime());
  });
  it('preserves usage when changing the limit', () => {
    const saved = admitDaily(undefined, ['1', '2', '3'], 3, today);
    const reduced = admitDaily(saved, ['4'], 1, today);
    expect(reduced.ids).toEqual(['1', '2', '3']);
    expect(admitDaily(reduced, ['4', '5'], 4, today).ids).toEqual(['1', '2', '3', '4']);
  });
  it('handles midnight over month and year boundaries', () => {
    const end = new Date(2026, 11, 31, 23, 59);
    expect(nextMidnight(end)).toBe(new Date(2027, 0, 1).getTime());
  });
});
