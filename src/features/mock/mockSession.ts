/**
 * Mock sitting helpers — pure logic plus on-device persistence for
 * local (offline) mocks.
 *
 * Mirrors the web backend (backend/app/routers/mock.py): test order
 * Listening → Reading → Writing → Speaking, no going back, an expired
 * Listening/Reading section scores 0 / band 1.0 and the sitting
 * continues, Writing contributes the midpoint of its band range,
 * Speaking contributes the midpoint of its fluency range, and the
 * overall band needs all four — an expired Writing section can never
 * produce a band, so the overall stays null in that case.
 *
 * The mock detail endpoint does not carry test/prompt ids, so the
 * plan (which tests and prompts a sitting uses) is remembered on this
 * device, like the web app's mockPlan.ts localStorage store.
 */

import {pickMockPair, pickWritingPrompt} from '@/lib/mock';
import {overallBand} from '@/lib/scoring';
import {
  getMockHistory,
  storage,
  type MockHistoryEntry,
  type Track,
} from '@/store/storage';
import type {QuestionResult} from '@/lib/scoring';
import {
  getListeningTest,
  getReadingTest,
  getWritingPrompt,
  speakingSets,
  writingPrompts,
  writingPromptsFor,
} from '@/content/index';

export const SECTION_ORDER = [
  'listening',
  'reading',
  'writing',
  'speaking',
] as const;

export type MockSectionKey = (typeof SECTION_ORDER)[number];

export const SECTION_LABELS: Record<MockSectionKey, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};

export interface MockPlan {
  track: Track;
  listeningTestId: string;
  readingTestId: string;
  writingTask1PromptId: string;
  writingTask2PromptId: string;
}

/** Word count: blank text is 0 words. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).filter(Boolean).length;
}

/**
 * Plan for a new offline mock: the pair for the n-th mock of the
 * track, and the first unused Writing prompt of each task.
 */
export function buildOfflineMockPlan(
  track: Track,
  history: MockHistoryEntry[],
): MockPlan {
  const sameTrack = history.filter(h => h.track === track);
  const {listeningTestId, readingTestId} = pickMockPair(
    track,
    sameTrack.length,
  );
  const usedTask1 = new Set(
    sameTrack.map(h => h.writingTask1PromptId),
  );
  const usedTask2 = new Set(
    sameTrack.map(h => h.writingTask2PromptId),
  );
  const task1Ids = writingPrompts
    .filter(p => p.track === track && p.task === 1)
    .map(p => p.id);
  const task2Ids = writingPrompts
    .filter(p => p.track === track && p.task === 2)
    .map(p => p.id);
  return {
    track,
    listeningTestId,
    readingTestId,
    writingTask1PromptId: pickWritingPrompt(task1Ids, usedTask1),
    writingTask2PromptId: pickWritingPrompt(task2Ids, usedTask2),
  };
}

/**
 * Re-derive a plan from a mock's position among the same track's
 * mocks (oldest first) — the fallback when the stored plan is missing,
 * e.g. resuming a server mock whose plan was never saved on this
 * device. Same rotation as the web app's deriveMockPlan.
 */
export function deriveMockPlanFromIndex(
  track: Track,
  index: number,
): MockPlan {
  const {listeningTestId, readingTestId} = pickMockPair(track, index);
  const task1Ids = writingPromptsFor(track, 1).map(p => p.id);
  const task2Ids = writingPromptsFor(track, 2).map(p => p.id);
  return {
    track,
    listeningTestId,
    readingTestId,
    writingTask1PromptId: task1Ids[index % task1Ids.length],
    writingTask2PromptId: task2Ids[index % task2Ids.length],
  };
}

/** Speaking set for the n-th mock (rotates through the bundled sets). */
export function speakingSetForMock(index: number) {
  return speakingSets[index % speakingSets.length];
}

/** Overall band from the four section contributions, or null. */
export function computeMockOverall(input: {
  listeningBand: number | null;
  readingBand: number | null;
  /** Midpoint of the Writing band range, null when expired/unscored. */
  writingMidpoint: number | null;
  /** Midpoint of the Speaking fluency range, null when not ranged. */
  speakingMidpoint: number | null;
}): number | null {
  const bands = [
    input.listeningBand,
    input.readingBand,
    input.writingMidpoint,
    input.speakingMidpoint,
  ];
  if (bands.some(b => b === null)) {
    return null;
  }
  return overallBand(bands as number[]);
}

/* --- On-device persistence (MMKV, via the shared storage instance) -- */

export interface LocalScoredSection {
  scoreRaw: number;
  band: number;
  expired: boolean;
  durationSeconds: number;
  results: QuestionResult[];
}

export interface LocalWritingSection {
  task1Words: number;
  task2Words: number;
  bandLow: number | null;
  bandHigh: number | null;
  expired: boolean;
  /** False when no Writing feedback was available (offline, port absent). */
  feedbackAvailable: boolean;
}

export interface LocalSpeakingSection {
  setId: string;
  bandLow: number | null;
  bandHigh: number | null;
  /** Midpoint of the range, null when the learner finished without one. */
  band: number | null;
  durationSeconds: number | null;
}

export interface LocalMockResult {
  mockId: number;
  track: Track;
  startedAt: number;
  listening?: LocalScoredSection;
  reading?: LocalScoredSection;
  writing?: LocalWritingSection;
  speaking?: LocalSpeakingSection;
  overall: number | null;
  status: 'complete' | 'in_progress';
}

function planKey(mockId: number): string {
  return `mock.plan.${mockId}`;
}

function resultKey(mockId: number): string {
  return `mock.result.${mockId}`;
}

export function saveLocalMockPlan(mockId: number, plan: MockPlan): void {
  try {
    storage.set(planKey(mockId), JSON.stringify(plan));
  } catch {
    /* Plan loss is non-fatal: the rotation fallback re-derives it. */
  }
}

export function loadLocalMockPlan(mockId: number): MockPlan | null {
  try {
    const raw = storage.getString(planKey(mockId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as MockPlan;
    if (
      typeof parsed.listeningTestId === 'string' &&
      typeof parsed.readingTestId === 'string' &&
      typeof parsed.writingTask1PromptId === 'string' &&
      typeof parsed.writingTask2PromptId === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveLocalMockResult(result: LocalMockResult): void {
  try {
    storage.set(resultKey(result.mockId), JSON.stringify(result));
  } catch {
    /* Non-fatal: the server copy is the source of truth when online. */
  }
}

export function loadLocalMockResult(mockId: number): LocalMockResult | null {
  try {
    const raw = storage.getString(resultKey(mockId));
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as LocalMockResult;
  } catch {
    return null;
  }
}

/** Convenience: bundled tests/prompts for a plan, for the runner. */
export function planContent(plan: MockPlan) {
  return {
    listening: getListeningTest(plan.listeningTestId),
    reading: getReadingTest(plan.readingTestId),
    writingTask1: getWritingPrompt(plan.writingTask1PromptId),
    writingTask2: getWritingPrompt(plan.writingTask2PromptId),
  };
}

/** Number of past mocks of a track, for rotation (server or local). */
export function countMocksOfTrack(track: Track): number {
  return getMockHistory().filter(h => h.track === track).length;
}
