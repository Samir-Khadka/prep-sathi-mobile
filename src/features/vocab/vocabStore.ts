/**
 * Local vocabulary helpers (pure, unit-testable).
 *
 * The 250-word deck is seeded from bundled content into MMKV local
 * state on first open; local state is the source of truth offline.
 * The server is only ever called best-effort — review never blocks
 * on the network.
 */

import {vocabularyDeck, type VocabularyWord} from '../../content';
import {isDue, nextIntervalDays, nextReviewAt} from '../../lib/spacedRepetition';
import {
  getLocalVocab,
  setLocalVocab,
  type LocalVocabItem,
} from '../../store/storage';

/** Build seed items from the bundled deck (all due immediately). */
export function buildSeedItems(
  deck: VocabularyWord[],
  nowMs: number,
): LocalVocabItem[] {
  return deck.map((word, index) => ({
    word: word.word,
    meaning: word.meaning,
    example: word.example,
    topic: word.topic,
    intervalDays: 1,
    nextReviewMs: nowMs,
    serverId: null,
    createdAt: nowMs + index,
  }));
}

/**
 * Return the local vocabulary, seeding it from the bundled deck on
 * first open. Seeding happens once: a non-empty local list is never
 * overwritten.
 */
export function ensureSeeded(nowMs: number = Date.now()): LocalVocabItem[] {
  const existing = getLocalVocab();
  if (existing.length > 0) {
    return existing;
  }
  const seeded = buildSeedItems(vocabularyDeck, nowMs);
  setLocalVocab(seeded);
  return seeded;
}

/** Case-insensitive match on word, meaning, or topic. */
export function filterVocab(
  items: LocalVocabItem[],
  query: string,
): LocalVocabItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return items;
  }
  return items.filter(
    item =>
      item.word.toLowerCase().includes(needle) ||
      item.meaning.toLowerCase().includes(needle) ||
      item.topic.toLowerCase().includes(needle),
  );
}

/** Words whose next review time has arrived. */
export function dueItems(
  items: LocalVocabItem[],
  nowMs: number = Date.now(),
): LocalVocabItem[] {
  return items.filter(item => isDue(item.nextReviewMs, nowMs));
}

/** Identify an item: word + creation time (user words may repeat). */
export function itemKey(item: LocalVocabItem): string {
  return `${item.createdAt}:${item.word}`;
}

/**
 * Apply one review to the matching item: correct doubles the
 * interval (capped at 60 days), wrong resets it to 1 day. Returns a
 * new list; the original is untouched.
 */
export function applyReview(
  items: LocalVocabItem[],
  target: LocalVocabItem,
  correct: boolean,
  nowMs: number = Date.now(),
): LocalVocabItem[] {
  const key = itemKey(target);
  return items.map(item => {
    if (itemKey(item) !== key) {
      return item;
    }
    const intervalDays = nextIntervalDays(correct, item.intervalDays);
    return {
      ...item,
      intervalDays,
      nextReviewMs: nextReviewAt(correct, item.intervalDays, nowMs),
    };
  });
}

/** Build a new local-only word (due immediately). */
export function buildLocalWord(
  input: {word: string; meaning: string; example: string; topic: string},
  nowMs: number = Date.now(),
): LocalVocabItem {
  return {
    word: input.word.trim(),
    meaning: input.meaning.trim(),
    example: input.example.trim(),
    topic: input.topic.trim() || 'general',
    intervalDays: 1,
    nextReviewMs: nowMs,
    serverId: null,
    createdAt: nowMs,
  };
}
