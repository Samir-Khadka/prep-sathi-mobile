/**
 * Time helpers for timed practice and mock sections.
 *
 * Mirrors the backend's timed-submit rule (backend/app/routers/
 * practice.py `_check_timed`): a timed submit is refused once the
 * elapsed time passes limit + 60s grace.
 */

import {SUBMIT_GRACE_SECONDS} from './scoring';

/** "32:05" for 1925s, "1:00:00" for 3600s. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${minutes}:${ss}`;
}

/** Seconds remaining until `expiresAtMs`; never negative. */
export function remainingSeconds(
  expiresAtMs: number,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, Math.floor((expiresAtMs - nowMs) / 1000));
}

/** True once a timed submit must be refused (elapsed > limit + grace). */
export function isPastSubmitGrace(
  elapsedSeconds: number,
  timeLimitSeconds: number,
): boolean {
  return elapsedSeconds > timeLimitSeconds + SUBMIT_GRACE_SECONDS;
}

/** True once the section clock itself has run out. */
export function isTimeUp(
  elapsedSeconds: number,
  timeLimitSeconds: number,
): boolean {
  return elapsedSeconds >= timeLimitSeconds;
}
