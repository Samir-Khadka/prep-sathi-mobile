/**
 * Tests for the local vocabulary helpers: seeding from the bundled
 * deck, search, due filtering, and spaced-repetition review updates.
 * MMKV is the in-memory Jest mock (see jest.setup.js).
 */

import {vocabularyDeck} from '../../../content';
import {storage, setLocalVocab} from '../../../store/storage';
import {
  applyReview,
  buildLocalWord,
  buildSeedItems,
  dueItems,
  ensureSeeded,
  filterVocab,
} from '../vocabStore';

const NOW = 1793000000000;

beforeEach(() => {
  storage.clearAll();
});

describe('buildSeedItems / ensureSeeded', () => {
  it('seeds all 250 bundled words, due immediately', () => {
    const seeded = buildSeedItems(vocabularyDeck, NOW);
    expect(seeded.length).toBe(250);
    expect(seeded[0]!.word).toBe(vocabularyDeck[0]!.word);
    expect(seeded.every(item => item.nextReviewMs === NOW)).toBe(true);
    expect(seeded.every(item => item.intervalDays === 1)).toBe(true);
    expect(seeded.every(item => item.serverId === null)).toBe(true);
  });

  it('seeds once and never overwrites local state', () => {
    const first = ensureSeeded(NOW);
    expect(first.length).toBe(250);
    const second = ensureSeeded(NOW + 1000);
    expect(second).toEqual(first);
    // A user-added word survives a later open.
    const withExtra = [
      buildLocalWord(
        {word: 'resilient', meaning: 'able to recover', example: '', topic: ''},
        NOW,
      ),
      ...first,
    ];
    setLocalVocab(withExtra);
    expect(ensureSeeded(NOW + 2000).length).toBe(251);
  });
});

describe('filterVocab', () => {
  it('matches word, meaning, and topic, case-insensitively', () => {
    const items = buildSeedItems(vocabularyDeck, NOW);
    expect(filterVocab(items, 'curriculum').length).toBeGreaterThanOrEqual(1);
    expect(filterVocab(items, 'CURRICULUM').length).toBe(
      filterVocab(items, 'curriculum').length,
    );
    expect(filterVocab(items, 'education').length).toBeGreaterThan(1);
    expect(filterVocab(items, 'zzz-no-such-word').length).toBe(0);
    expect(filterVocab(items, '').length).toBe(250);
  });
});

describe('dueItems', () => {
  it('returns only words whose review time has arrived', () => {
    const items = buildSeedItems(vocabularyDeck, NOW);
    expect(dueItems(items, NOW).length).toBe(250);
    expect(dueItems(items, NOW - 1).length).toBe(0);
  });
});

describe('applyReview', () => {
  it('doubles the interval on correct, capped at 60 days', () => {
    const items = buildSeedItems(vocabularyDeck, NOW);
    const target = items[0]!;
    const afterCorrect = applyReview(items, target, true, NOW);
    expect(afterCorrect[0]!.intervalDays).toBe(2);
    expect(afterCorrect[0]!.nextReviewMs).toBe(NOW + 2 * 86400000);
    // Original list untouched.
    expect(items[0]!.intervalDays).toBe(1);

    const long = [{...target, intervalDays: 45}];
    expect(applyReview(long, long[0]!, true, NOW)[0]!.intervalDays).toBe(60);
  });

  it('resets to 1 day on wrong', () => {
    const items = buildSeedItems(vocabularyDeck, NOW);
    const target = {...items[0]!, intervalDays: 16};
    const afterWrong = applyReview([target], target, false, NOW);
    expect(afterWrong[0]!.intervalDays).toBe(1);
    expect(afterWrong[0]!.nextReviewMs).toBe(NOW + 86400000);
  });

  it('leaves other words untouched', () => {
    const items = buildSeedItems(vocabularyDeck, NOW);
    const after = applyReview(items, items[5]!, true, NOW);
    expect(after[0]!.intervalDays).toBe(1);
    expect(after[5]!.intervalDays).toBe(2);
  });
});

describe('buildLocalWord', () => {
  it('trims fields and defaults an empty topic to general', () => {
    const word = buildLocalWord(
      {word: '  resilient ', meaning: ' able to recover ', example: '', topic: '  '},
      NOW,
    );
    expect(word.word).toBe('resilient');
    expect(word.topic).toBe('general');
    expect(word.nextReviewMs).toBe(NOW);
  });
});
