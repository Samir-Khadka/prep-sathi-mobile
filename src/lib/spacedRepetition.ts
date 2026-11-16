/**
 * Spaced-repetition review schedule.
 *
 * Ported from the web backend (backend/app/routers/vocabulary.py):
 * a correct recall doubles the interval (capped at 60 days); a wrong
 * recall resets it to 1 day. A new word starts at interval 1 day.
 */

export const MAX_INTERVAL_DAYS = 60;
export const INITIAL_INTERVAL_DAYS = 1;

/** Next interval in days after a review. */
export function nextIntervalDays(
  correct: boolean,
  currentIntervalDays: number,
): number {
  if (correct) {
    return Math.min(currentIntervalDays * 2, MAX_INTERVAL_DAYS);
  }
  return 1;
}

/** Next review time (epoch ms) after a review. */
export function nextReviewAt(
  correct: boolean,
  currentIntervalDays: number,
  nowMs: number = Date.now(),
): number {
  const interval = nextIntervalDays(correct, currentIntervalDays);
  return nowMs + interval * 24 * 60 * 60 * 1000;
}

/** Whether a word is due for review at `nowMs`. */
export function isDue(nextReviewMs: number, nowMs: number = Date.now()): boolean {
  return nextReviewMs <= nowMs;
}
