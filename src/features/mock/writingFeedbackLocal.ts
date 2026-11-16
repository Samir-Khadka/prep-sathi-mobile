/**
 * Offline Writing feedback for mock sittings.
 *
 * Uses the offline port in src/lib/feedback.ts
 * (`analyseWriting(prompt, text)` — the parallel Writing build
 * landed it on 2026-11-16; verified against it in
 * writingFeedbackLocal.test.ts). The call is still defensive: it
 * runs in try/catch and the result is only accepted when it carries
 * a numeric band_low / band_high. If the port ever goes away or its
 * shape changes, callers get null and must say plainly that detailed
 * Writing feedback is unavailable and record word counts only; they
 * never invent a band.
 *
 * Note: this is a static import, not a dynamic one, on purpose. A
 * dynamic import cannot be exercised in this repo's Jest setup (it
 * throws ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG without
 * --experimental-vm-modules), so a lazy import would be unverifiable
 * here and would silently fall back to "unavailable" in every test.
 * The port is a pure function module with no native dependencies,
 * so bundling it statically costs nothing at runtime.
 */

import type {WritingPrompt} from '@/content/index';
import {analyseWriting} from '@/lib/feedback';
import {BAND_LABEL} from '@/lib/scoring';
import {wordCount} from './mockSession';

export interface LocalWritingFeedback {
  band_low: number;
  band_high: number;
  word_count: number;
  min_words: number;
  meets_minimum: boolean;
  criteria: Record<
    string,
    {band_low: number; band_high: number; notes: string[]}
  >;
  limits: string;
  band_label: string;
}

function isFeedbackShape(value: unknown): value is {
  band_low: number;
  band_high: number;
} {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    (typeof v.band_low === 'number' && typeof v.band_high === 'number') ||
    (typeof v.bandLow === 'number' && typeof v.bandHigh === 'number')
  );
}

function normalise(
  value: Record<string, unknown>,
  prompt: WritingPrompt,
  text: string,
): LocalWritingFeedback {
  const bandLow =
    typeof value.band_low === 'number'
      ? value.band_low
      : (value.bandLow as number);
  const bandHigh =
    typeof value.band_high === 'number'
      ? value.band_high
      : (value.bandHigh as number);
  const criteriaRaw = value.criteria;
  const criteria: LocalWritingFeedback['criteria'] = {};
  if (criteriaRaw && typeof criteriaRaw === 'object') {
    for (const [key, raw] of Object.entries(
      criteriaRaw as Record<string, unknown>,
    )) {
      if (raw && typeof raw === 'object') {
        const c = raw as Record<string, unknown>;
        const lo =
          typeof c.band_low === 'number'
            ? c.band_low
            : (c.bandLow as number);
        const hi =
          typeof c.band_high === 'number'
            ? c.band_high
            : (c.bandHigh as number);
        if (typeof lo === 'number' && typeof hi === 'number') {
          criteria[key] = {
            band_low: lo,
            band_high: hi,
            notes: Array.isArray(c.notes)
              ? (c.notes as unknown[]).map(String)
              : [],
          };
        }
      }
    }
  }
  const words = wordCount(text);
  return {
    band_low: bandLow,
    band_high: bandHigh,
    word_count:
      typeof value.word_count === 'number' ? value.word_count : words,
    min_words:
      typeof value.min_words === 'number'
        ? value.min_words
        : prompt.min_words,
    meets_minimum:
      typeof value.meets_minimum === 'boolean'
        ? value.meets_minimum
        : words >= prompt.min_words,
    criteria,
    limits:
      typeof value.limits === 'string'
        ? value.limits
        : 'This is an estimate from the practice material — it cannot judge ideas, argument, or factual accuracy.',
    band_label: BAND_LABEL,
  };
}

/**
 * Offline Writing feedback for one task. Returns null only if the
 * port throws or its result fails the shape check — the caller must
 * say so in the UI.
 */
export async function loadLocalWritingFeedback(
  prompt: WritingPrompt,
  text: string,
): Promise<LocalWritingFeedback | null> {
  try {
    const out = analyseWriting(prompt, text);
    if (!isFeedbackShape(out)) {
      return null;
    }
    return normalise(out as unknown as Record<string, unknown>, prompt, text);
  } catch {
    return null;
  }
}
