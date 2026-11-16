import {summariseLocalProgress} from '../localProgress';
import type {LocalVocabItem, PendingAttempt} from '@/store/storage';

function attempt(
  module: string,
  band: number | null,
  createdAt = 1000,
): PendingAttempt {
  return {
    localId: `${module}-${createdAt}`,
    module,
    kind: 'practice',
    score_raw: 30,
    band_estimate: band,
    duration_seconds: 600,
    createdAt,
  };
}

function vocab(word: string, nextReviewMs: number): LocalVocabItem {
  return {
    word,
    meaning: 'm',
    example: 'e',
    topic: 't',
    intervalDays: 1,
    nextReviewMs,
    serverId: null,
    createdAt: 0,
  };
}

describe('summariseLocalProgress', () => {
  it('returns empty progress with no attempts or words', () => {
    const out = summariseLocalProgress([], [], 5000);
    expect(out.attemptsTotal).toBe(0);
    expect(out.overallEstimate).toBeNull();
    expect(out.vocabularyTotal).toBe(0);
    expect(out.vocabularyDue).toBe(0);
    expect(out.recent).toEqual([]);
  });

  it('takes the latest band per module and averages all four', () => {
    const out = summariseLocalProgress(
      [
        attempt('listening', 6.0, 1000),
        attempt('listening', 7.0, 2000),
        attempt('reading', 6.5, 1000),
        attempt('writing', 6.0, 1000),
        attempt('speaking', 7.0, 1000),
      ],
      [],
    );
    expect(out.latestBandByModule.listening).toBe(7.0);
    expect(out.attemptsByModule.listening).toBe(2);
    expect(out.attemptsTotal).toBe(5);
    // (7 + 6.5 + 6 + 7) / 4 = 6.625 -> IELTS rounding 6.5
    expect(out.overallEstimate).toBe(6.5);
  });

  it('has no overall until all four modules have a band', () => {
    const out = summariseLocalProgress(
      [attempt('listening', 7.0), attempt('reading', 6.5)],
      [],
    );
    expect(out.overallEstimate).toBeNull();
  });

  it('counts due vocabulary and returns the last 10 attempts first', () => {
    const attempts = Array.from({length: 12}, (_, i) =>
      attempt('listening', 6.0, 1000 + i),
    );
    const out = summariseLocalProgress(
      attempts,
      [vocab('a', 100), vocab('b', 99999)],
      5000,
    );
    expect(out.vocabularyTotal).toBe(2);
    expect(out.vocabularyDue).toBe(1);
    expect(out.recent).toHaveLength(10);
    expect(out.recent[0].createdAt).toBe(1011);
  });
});
