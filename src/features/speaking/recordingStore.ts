/**
 * Speaking-recording helpers (pure, unit-testable).
 *
 * Audio files live on disk under the app documents directory; MMKV
 * holds metadata only (see src/store/storage.ts). Recordings are
 * capped at MAX_SPEAKING_RECORDINGS — the oldest is dropped, and the
 * caller deletes its file too. Nothing is ever uploaded.
 */

import {MAX_SPEAKING_RECORDINGS} from '../../lib/fluency';
import type {StoredSpeakingRecording} from '../../store/storage';

export const SPEAKING_RECORDING_PREFIX = 'speaking_';

/** File name for a new recording. */
export function recordingFileName(setId: string, createdAt: number): string {
  return `${SPEAKING_RECORDING_PREFIX}${setId}_${createdAt}.m4a`;
}

/**
 * Add a recording to the stored list, newest last, enforcing the cap.
 * Returns the list to persist and the recordings that were dropped
 * (the caller must delete their files from disk).
 */
export function addRecordingWithCap(
  existing: StoredSpeakingRecording[],
  next: StoredSpeakingRecording,
  max: number = MAX_SPEAKING_RECORDINGS,
): {
  kept: StoredSpeakingRecording[];
  dropped: StoredSpeakingRecording[];
} {
  const kept = [...existing, next].sort((a, b) => a.createdAt - b.createdAt);
  const dropped = kept.length > max ? kept.slice(0, kept.length - max) : [];
  return {kept: kept.slice(-max), dropped};
}

/** Remove one recording from the list (by id). */
export function removeRecording(
  existing: StoredSpeakingRecording[],
  id: string,
): StoredSpeakingRecording[] {
  return existing.filter(r => r.id !== id);
}

/**
 * Convert a recorder metering value in dB (typically -160 silent to 0
 * loud) to a linear 0–1 level for `analyseFluency`, whose silence
 * threshold is 0.02 (≈ -34 dB). A missing metering value counts as
 * silence.
 */
export function meteringDbToLevel(db: number | null | undefined): number {
  if (db === null || db === undefined || Number.isNaN(db)) {
    return 0;
  }
  return Math.min(1, Math.max(0, Math.pow(10, db / 20)));
}
