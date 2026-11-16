/**
 * On-device progress summary: the offline fallback for Home and
 * Dashboard. Pure — computed from the queued (unsynced) attempts and
 * the local vocabulary deck, so it works with no connection and no
 * account. Mirrors the server dashboard shape (dashboard.py):
 * attempts total + by module, latest band per module, overall
 * estimate (only when all four modules have a latest band), and
 * vocabulary total / due.
 */

import {overallBand} from '@/lib/scoring';
import type {LocalVocabItem, PendingAttempt} from '@/store/storage';

export interface LocalProgress {
  attemptsTotal: number;
  attemptsByModule: Record<string, number>;
  latestBandByModule: Record<string, number | null>;
  overallEstimate: number | null;
  vocabularyTotal: number;
  vocabularyDue: number;
  /** Most recent first, at most 10. */
  recent: PendingAttempt[];
}

const MODULES = ['listening', 'reading', 'writing', 'speaking'] as const;

export function summariseLocalProgress(
  pending: PendingAttempt[],
  vocab: LocalVocabItem[],
  nowMs: number = Date.now(),
): LocalProgress {
  const attemptsByModule: Record<string, number> = {};
  const latestBandByModule: Record<string, number | null> = {};
  for (const module of MODULES) {
    latestBandByModule[module] = null;
  }
  // Queue order is oldest first; later entries overwrite, so the last
  // attempt of a module with a band is its latest band.
  for (const attempt of pending) {
    attemptsByModule[attempt.module] =
      (attemptsByModule[attempt.module] ?? 0) + 1;
    if (attempt.band_estimate !== null && attempt.band_estimate !== undefined) {
      latestBandByModule[attempt.module] = attempt.band_estimate;
    }
  }
  const bands = MODULES.map(m => latestBandByModule[m]);
  const overallEstimate =
    bands.every(b => b !== null) && bands.length === 4
      ? overallBand(bands as number[])
      : null;
  const vocabularyDue = vocab.filter(v => v.nextReviewMs <= nowMs).length;
  const recent = [...pending].reverse().slice(0, 10);
  return {
    attemptsTotal: pending.length,
    attemptsByModule,
    latestBandByModule,
    overallEstimate,
    vocabularyTotal: vocab.length,
    vocabularyDue,
    recent,
  };
}
