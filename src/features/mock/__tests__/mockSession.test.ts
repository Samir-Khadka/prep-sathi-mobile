import {
  buildOfflineMockPlan,
  computeMockOverall,
  deriveMockPlanFromIndex,
  loadLocalMockPlan,
  loadLocalMockResult,
  saveLocalMockPlan,
  saveLocalMockResult,
  wordCount,
  type LocalMockResult,
} from '../mockSession';
import type {MockHistoryEntry} from '@/store/storage';

function historyEntry(
  track: 'academic' | 'general',
  listeningTestId: string,
  readingTestId: string,
  t1: string,
  t2: string,
): MockHistoryEntry {
  return {
    track,
    listeningTestId,
    readingTestId,
    writingTask1PromptId: t1,
    writingTask2PromptId: t2,
    startedAt: 1,
    serverMockId: null,
    status: 'complete',
  };
}

describe('wordCount', () => {
  it('counts words and treats blank text as zero', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('   ')).toBe(0);
    expect(wordCount('one two  three')).toBe(3);
  });
});

describe('computeMockOverall', () => {
  it('averages the four contributions with IELTS rounding', () => {
    expect(
      computeMockOverall({
        listeningBand: 7,
        readingBand: 6.5,
        writingMidpoint: 6,
        speakingMidpoint: 7,
      }),
    ).toBe(6.5);
  });

  it('is null when any section is missing — including expired writing', () => {
    expect(
      computeMockOverall({
        listeningBand: 7,
        readingBand: 6.5,
        writingMidpoint: null,
        speakingMidpoint: 7,
      }),
    ).toBeNull();
    expect(
      computeMockOverall({
        listeningBand: 7,
        readingBand: 6.5,
        writingMidpoint: 6,
        speakingMidpoint: null,
      }),
    ).toBeNull();
  });
});

describe('buildOfflineMockPlan', () => {
  it('rotates pairs and writing prompts by past mocks of the track', () => {
    const history = [
      historyEntry('academic', 'L1', 'RA1', 'WA-T1-01', 'WA-T2-01'),
    ];
    const plan = buildOfflineMockPlan('academic', history);
    expect(plan.listeningTestId).toBe('L2');
    expect(plan.readingTestId).toBe('RA2');
    expect(plan.writingTask1PromptId).not.toBe('WA-T1-01');
    expect(plan.writingTask2PromptId).not.toBe('WA-T2-01');
  });

  it('starts at the first pair with no history', () => {
    const plan = buildOfflineMockPlan('general', []);
    expect(plan).toEqual({
      track: 'general',
      listeningTestId: 'L1',
      readingTestId: 'RG1',
      writingTask1PromptId: expect.any(String),
      writingTask2PromptId: expect.any(String),
    });
  });
});

describe('deriveMockPlanFromIndex', () => {
  it('matches the rotation for a given index', () => {
    expect(deriveMockPlanFromIndex('academic', 2).listeningTestId).toBe('L3');
    expect(deriveMockPlanFromIndex('general', 1).readingTestId).toBe('RG1');
  });
});

describe('local mock persistence', () => {
  it('round-trips a plan and a result through MMKV', () => {
    const plan = buildOfflineMockPlan('academic', []);
    saveLocalMockPlan(-123, plan);
    expect(loadLocalMockPlan(-123)).toEqual(plan);
    expect(loadLocalMockPlan(-999)).toBeNull();

    const result: LocalMockResult = {
      mockId: -123,
      track: 'academic',
      startedAt: 1000,
      listening: {
        scoreRaw: 30,
        band: 7,
        expired: false,
        durationSeconds: 1500,
        results: [],
      },
      overall: null,
      status: 'in_progress',
    };
    saveLocalMockResult(result);
    expect(loadLocalMockResult(-123)).toEqual(result);
    expect(loadLocalMockResult(-999)).toBeNull();
  });
});
