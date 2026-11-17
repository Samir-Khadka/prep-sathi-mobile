/**
 * Calibration tests for the offline Writing feedback port
 * (src/lib/feedback.ts), mirroring backend/tests/test_feedback.py.
 *
 * Pinned: every bundled model answer scores an overall low end of
 * 7.0 or above, and the weak fixture (about 120 words, one paragraph,
 * repetitive vocabulary) scores an overall high end of 5.5 or below.
 * The weak fixture is original text written for the backend test —
 * no Cambridge material.
 */

import {writingPrompts, getWritingPrompt} from '../../content';
import {analyseWriting, countWords, LIMITS} from '../feedback';

export const WEAK_TEXT =
  'I think free university is good for students in my country today. ' +
  'I think students need money because university is very expensive for students. ' +
  'I think poor students cannot pay money for university and they need help. ' +
  'I think free university is very good because students can study and learn. ' +
  'Many poor students want jobs but students need money for university study. ' +
  'I think free university is very important for poor students and all students. ' +
  'Students need help because university is very hard and very expensive for students. ' +
  'I think free university is good for students and good for my country today. ' +
  'Poor students need free university because they need money and they need jobs.';

const CRITERIA = ['task_achievement', 'coherence', 'lexical', 'grammar'];

function isHalfStep(value: number): boolean {
  return Math.abs(value * 2 - Math.round(value * 2)) < 1e-9;
}

describe('analyseWriting shape', () => {
  it('matches WritingFeedbackResponse for a model answer', () => {
    const prompt = getWritingPrompt('WA-T2-01')!;
    const result = analyseWriting(prompt, prompt.model_answer);
    expect(Object.keys(result).sort()).toEqual(
      [
        'band_high',
        'band_label',
        'band_low',
        'criteria',
        'limits',
        'meets_minimum',
        'min_words',
        'word_count',
      ].sort(),
    );
    // Word count counts alphabetic tokens (the feedback module's
    // definition), not whitespace-split words: "income-based" is two
    // tokens, "420,000" is none.
    expect(result.word_count).toBe(292);
    expect(result.min_words).toBe(250);
    expect(result.meets_minimum).toBe(true);
    expect(result.band_label).toBe(
      'practice estimate, not an official score',
    );
    expect(result.limits).toBe(LIMITS);
    expect(result.limits).toContain('cannot judge your ideas');
    expect(Object.keys(result.criteria).sort()).toEqual(
      [...CRITERIA].sort(),
    );
    for (const criterion of Object.values(result.criteria)) {
      expect(Object.keys(criterion).sort()).toEqual([
        'band_high',
        'band_low',
        'notes',
      ]);
      expect(criterion.band_low).toBeGreaterThanOrEqual(4.0);
      expect(criterion.band_low).toBeLessThanOrEqual(criterion.band_high);
      expect(criterion.band_high).toBeLessThanOrEqual(8.0);
      expect(isHalfStep(criterion.band_low)).toBe(true);
      expect(isHalfStep(criterion.band_high)).toBe(true);
      expect(criterion.notes.length).toBeGreaterThanOrEqual(2);
      expect(criterion.notes.length).toBeLessThanOrEqual(4);
      for (const note of criterion.notes) {
        expect(typeof note).toBe('string');
        expect(note.length).toBeGreaterThan(0);
      }
    }
    expect(result.band_low).toBeGreaterThanOrEqual(4.0);
    expect(result.band_low).toBeLessThanOrEqual(result.band_high);
    expect(result.band_high).toBeLessThanOrEqual(8.0);
    expect(isHalfStep(result.band_low)).toBe(true);
    expect(isHalfStep(result.band_high)).toBe(true);
  });

  it('counts words the feedback way', () => {
    expect(countWords('The chart shows three museums. Overall, one grew.')).toBe(
      8,
    );
    expect(countWords(' '.repeat(0))).toBe(0);
    expect(countWords('income-based 420,000')).toBe(2);
  });
});

describe('calibration', () => {
  it('every model answer scores an overall low end of 7.0+', () => {
    expect(writingPrompts.length).toBe(30);
    for (const prompt of writingPrompts) {
      const result = analyseWriting(prompt, prompt.model_answer);
      expect(result.meets_minimum).toBe(true);
      expect(result.band_low).toBeGreaterThanOrEqual(7.0);
      expect(result.band_high).toBeLessThanOrEqual(8.0);
    }
  });

  it('the weak fixture scores an overall high end of 5.5 or below', () => {
    const prompt = getWritingPrompt('WA-T2-01')!;
    const result = analyseWriting(prompt, WEAK_TEXT);
    expect(result.word_count).toBe(115);
    expect(result.min_words).toBe(250);
    expect(result.meets_minimum).toBe(false);
    expect(result.band_high).toBeLessThanOrEqual(5.5);
    expect(result.band_low).toBeLessThan(result.band_high);
  });

  it('word count and minimum for Task 1', () => {
    const prompt = getWritingPrompt('WA-T1-01')!;
    const short = analyseWriting(
      prompt,
      'The chart shows three museums. Overall, one grew.',
    );
    expect(short.word_count).toBe(8);
    expect(short.min_words).toBe(150);
    expect(short.meets_minimum).toBe(false);
    expect(short.band_high).toBeLessThanOrEqual(6.0);
    const exact = analyseWriting(prompt, Array(150).fill('word').join(' '));
    expect(exact.word_count).toBe(150);
    expect(exact.meets_minimum).toBe(true);
  });

  it('empty text is handled, not a crash', () => {
    const prompt = getWritingPrompt('WA-T2-01')!;
    const result = analyseWriting(prompt, '   ');
    expect(result.word_count).toBe(0);
    expect(result.meets_minimum).toBe(false);
    expect(result.band_low).toBe(4.0);
  });
});
