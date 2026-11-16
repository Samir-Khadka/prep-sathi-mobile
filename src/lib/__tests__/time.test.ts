import {
  formatDuration,
  isPastSubmitGrace,
  isTimeUp,
  remainingSeconds,
} from '../time';

describe('time helpers', () => {
  it('formats mm:ss and h:mm:ss', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(1920)).toBe('32:00');
    expect(formatDuration(3600)).toBe('1:00:00');
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(-5)).toBe('0:00');
  });

  it('computes remaining seconds, never negative', () => {
    const now = 1_000_000;
    expect(remainingSeconds(now + 60_000, now)).toBe(60);
    expect(remainingSeconds(now - 5_000, now)).toBe(0);
  });

  it('refuses a timed submit only past limit + 60s grace', () => {
    expect(isPastSubmitGrace(1920 + 60, 1920)).toBe(false);
    expect(isPastSubmitGrace(1920 + 61, 1920)).toBe(true);
    expect(isPastSubmitGrace(3600 + 60, 3600)).toBe(false);
    expect(isPastSubmitGrace(3600 + 61, 3600)).toBe(true);
  });

  it('reports time-up at the limit itself', () => {
    expect(isTimeUp(1919, 1920)).toBe(false);
    expect(isTimeUp(1920, 1920)).toBe(true);
  });
});
