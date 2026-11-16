import {
  isDue,
  MAX_INTERVAL_DAYS,
  nextIntervalDays,
  nextReviewAt,
} from '../spacedRepetition';

describe('spaced repetition', () => {
  it('doubles the interval on a correct recall, capped at 60 days', () => {
    expect(nextIntervalDays(true, 1)).toBe(2);
    expect(nextIntervalDays(true, 2)).toBe(4);
    expect(nextIntervalDays(true, 30)).toBe(60);
    expect(nextIntervalDays(true, 60)).toBe(MAX_INTERVAL_DAYS);
  });

  it('resets to 1 day on a wrong recall', () => {
    expect(nextIntervalDays(false, 32)).toBe(1);
    expect(nextIntervalDays(false, 1)).toBe(1);
  });

  it('schedules the next review interval days ahead', () => {
    const now = Date.parse('2026-11-16T00:00:00Z');
    expect(nextReviewAt(true, 1, now)).toBe(now + 2 * 24 * 60 * 60 * 1000);
    expect(nextReviewAt(false, 8, now)).toBe(now + 1 * 24 * 60 * 60 * 1000);
  });

  it('reports due words correctly', () => {
    const now = Date.now();
    expect(isDue(now - 1000, now)).toBe(true);
    expect(isDue(now + 1000, now)).toBe(false);
  });
});
