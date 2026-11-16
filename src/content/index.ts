/**
 * Bundled practice content — offline-first.
 *
 * The five content JSONs are copied verbatim from the web repo
 * (~/workspace/prep-sathi/backend/app/content/) at the web version
 * below. Keep them in sync by content version: when the web repo
 * ships new content, copy the JSONs again and bump CONTENT_VERSION.
 * All content is original, written to the official IELTS format;
 * no Cambridge copyrighted material is included anywhere.
 */

import listeningData from './listening_tests.json';
import readingData from './reading_tests.json';
import speakingData from './speaking_sets.json';
import vocabularyData from './vocabulary_deck.json';
import writingData from './writing_prompts.json';
import type {ContentQuestion} from '../lib/scoring';

export const CONTENT_VERSION = {
  /** Web repo commit the JSONs were copied from. */
  webMain: '16dfee58',
  /** Web app version at that commit. */
  webVersion: '0.4.0',
  copiedAt: '2026-11-16',
} as const;

export interface ListeningPart {
  part: number;
  title: string;
  setting: string;
  transcript: string;
  audio_url: string | null;
  audio_note: string;
  questions: ContentQuestion[];
}

export interface ListeningTest {
  id: string;
  title: string;
  parts: ListeningPart[];
}

export interface ReadingPassage {
  section: number;
  title: string;
  text: string;
  questions: ContentQuestion[];
}

export interface ReadingTest {
  id: string;
  track: 'academic' | 'general';
  title: string;
  passages: ReadingPassage[];
}

export interface WritingPrompt {
  id: string;
  track: 'academic' | 'general';
  task: 1 | 2;
  title: string;
  prompt: string;
  min_words: number;
  suggested_minutes: number;
  model_answer: string;
  commentary: string;
}

export interface SpeakingPart2 {
  cue: string;
  points: string[];
  prep_seconds: number;
  talk_seconds: number;
}

export interface SpeakingSet {
  id: string;
  topic: string;
  part1: string[];
  part2: SpeakingPart2;
  part3: string[];
  sample_answer: string;
}

export interface VocabularyWord {
  word: string;
  meaning: string;
  example: string;
  topic: string;
}

export const listeningTests = listeningData.tests as ListeningTest[];
export const readingTests = readingData.tests as ReadingTest[];
export const writingPrompts = writingData.prompts as WritingPrompt[];
export const speakingSets = speakingData.sets as SpeakingSet[];
export const vocabularyDeck = vocabularyData.words as VocabularyWord[];

export function getListeningTest(id: string): ListeningTest | undefined {
  return listeningTests.find(t => t.id === id);
}

export function getReadingTest(id: string): ReadingTest | undefined {
  return readingTests.find(t => t.id === id);
}

export function getWritingPrompt(id: string): WritingPrompt | undefined {
  return writingPrompts.find(p => p.id === id);
}

export function getSpeakingSet(id: string): SpeakingSet | undefined {
  return speakingSets.find(s => s.id === id);
}

export function allListeningQuestions(test: ListeningTest): ContentQuestion[] {
  return test.parts.flatMap(p => p.questions);
}

export function allReadingQuestions(test: ReadingTest): ContentQuestion[] {
  return test.passages.flatMap(p => p.questions);
}

export function readingTestsForTrack(
  track: 'academic' | 'general',
): ReadingTest[] {
  return readingTests.filter(t => t.track === track);
}

export function writingPromptsFor(
  track: 'academic' | 'general',
  task: 1 | 2,
): WritingPrompt[] {
  return writingPrompts.filter(p => p.track === track && p.task === task);
}
