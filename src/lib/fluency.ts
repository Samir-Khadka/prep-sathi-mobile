/**
 * Speaking fluency estimation from timing signals only.
 *
 * Ported from the web app (frontend/src/speakingHistory.ts). The band
 * RANGE comes from how long the learner spoke vs paused — never a
 * precise band score, and it cannot judge pronunciation, vocabulary,
 * or ideas. Recordings never leave the device.
 */

import {BAND_LABEL} from '../theme/tokens';

export const MAX_SPEAKING_RECORDINGS = 20;
export const SPEAKING_TARGET_SECONDS = 120;

/** RMS volume below this counts as silence. */
export const SILENCE_THRESHOLD = 0.02;
/** A silence run longer than this counts as a pause. */
export const PAUSE_MIN_SECONDS = 0.7;
/** The analyser is sampled this often while recording (~10x/second). */
export const SAMPLE_INTERVAL_SECONDS = 0.1;

export interface FluencyEstimate {
  durationSeconds: number;
  speechSeconds: number;
  pauseCount: number;
  longestPauseSeconds: number;
  bandLow: number;
  bandHigh: number;
  bandLabel: string;
  notes: string[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

type BandRange = [number, number];

const BAND_STEPS: BandRange[] = [
  [4.0, 5.0],
  [4.5, 5.5],
  [5.0, 6.0],
  [6.0, 7.0],
  [6.5, 7.5],
];

function stepDown(range: BandRange): BandRange {
  const idx = BAND_STEPS.findIndex(
    ([lo, hi]) => lo === range[0] && hi === range[1],
  );
  if (idx <= 0) {
    return BAND_STEPS[0];
  }
  return BAND_STEPS[idx - 1];
}

/**
 * Estimated band RANGE from timing signals only.
 * Coverage = speech time vs the target talk time. Frequent long pauses
 * pull the range down: severe hesitation caps it at 4.5–5.5 even when
 * coverage was good; moderate hesitation drops it one step.
 */
export function estimateBandRange(
  speechSeconds: number,
  targetSeconds: number,
  pauseCount: number,
  longestPauseSeconds: number,
): {bandLow: number; bandHigh: number} {
  const coverage = targetSeconds > 0 ? speechSeconds / targetSeconds : 0;
  let range: BandRange;
  if (coverage >= 0.8) {
    range = [6.5, 7.5];
  } else if (coverage >= 0.65) {
    range = [6.0, 7.0];
  } else if (coverage >= 0.45) {
    range = [5.0, 6.0];
  } else if (coverage >= 0.25) {
    range = [4.5, 5.5];
  } else {
    range = [4.0, 5.0];
  }

  const severeHesitation = pauseCount >= 10 || longestPauseSeconds >= 6;
  const moderateHesitation =
    !severeHesitation && (pauseCount > 6 || longestPauseSeconds > 3);
  if (severeHesitation) {
    range = coverage >= 0.25 ? [4.5, 5.5] : [4.0, 5.0];
  } else if (moderateHesitation) {
    range = stepDown(range);
  }
  return {bandLow: range[0], bandHigh: range[1]};
}

function buildFluencyNotes(
  durationSeconds: number,
  speechSeconds: number,
  targetSeconds: number,
  pauseCount: number,
  longestPauseSeconds: number,
): string[] {
  const notes: string[] = [];
  const coverage = targetSeconds > 0 ? speechSeconds / targetSeconds : 0;
  notes.push(
    `You spoke for ${speechSeconds} of ${targetSeconds} seconds ` +
      `(recording ${durationSeconds}s) with ${pauseCount} ` +
      `pause${pauseCount === 1 ? '' : 's'} over 0.7s` +
      (longestPauseSeconds > 0
        ? `; longest pause ${longestPauseSeconds}s.`
        : '.'),
  );
  if (coverage >= 0.8 && pauseCount <= 3) {
    notes.push(
      'You kept talking through most of the two minutes with very few pauses.',
    );
  }
  if (longestPauseSeconds >= 5) {
    notes.push(
      `Your longest pause was ${longestPauseSeconds}s — long pauses break ` +
        'fluency; try bridging with a short phrase while you think of what to say next.',
    );
  }
  if (coverage < 0.45) {
    notes.push(
      'You stopped well short of the two-minute target — aim to keep talking until the timer ends.',
    );
  }
  notes.push(
    'This range comes from timing signals only — it cannot judge pronunciation, vocabulary, or ideas.',
  );
  return notes;
}

/**
 * Turn a series of RMS volume samples into a fluency estimate.
 * `levels` are sampled every `sampleIntervalSeconds`; a pause is a
 * below-threshold run longer than 0.7s.
 */
export function analyseFluency(
  levels: number[],
  sampleIntervalSeconds: number,
  durationSeconds: number,
  targetSeconds: number,
): FluencyEstimate {
  let speechSamples = 0;
  let pauseCount = 0;
  let longestPauseSeconds = 0;
  let silentRun = 0;

  const closeRun = () => {
    const runSeconds = silentRun * sampleIntervalSeconds;
    if (runSeconds > PAUSE_MIN_SECONDS) {
      pauseCount += 1;
      longestPauseSeconds = Math.max(longestPauseSeconds, runSeconds);
    }
    silentRun = 0;
  };

  for (const level of levels) {
    if (level >= SILENCE_THRESHOLD) {
      speechSamples += 1;
      closeRun();
    } else {
      silentRun += 1;
    }
  }
  closeRun();

  const speechSeconds = Math.min(
    durationSeconds,
    round1(speechSamples * sampleIntervalSeconds),
  );
  longestPauseSeconds = round1(longestPauseSeconds);
  const {bandLow, bandHigh} = estimateBandRange(
    speechSeconds,
    targetSeconds,
    pauseCount,
    longestPauseSeconds,
  );
  return {
    durationSeconds,
    speechSeconds,
    pauseCount,
    longestPauseSeconds,
    bandLow,
    bandHigh,
    bandLabel: BAND_LABEL,
    notes: buildFluencyNotes(
      durationSeconds,
      speechSeconds,
      targetSeconds,
      pauseCount,
      longestPauseSeconds,
    ),
  };
}
