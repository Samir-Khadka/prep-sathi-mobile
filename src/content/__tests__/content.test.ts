import {
  allListeningQuestions,
  allReadingQuestions,
  CONTENT_VERSION,
  getListeningTest,
  getReadingTest,
  listeningTests,
  readingTests,
  speakingSets,
  vocabularyDeck,
  writingPrompts,
} from '../index';

describe('bundled content', () => {
  it('tracks the web repo version it was copied from', () => {
    expect(CONTENT_VERSION.webMain).toBe(
      '2a5f0b9d5fc69320b7c774bdfb79810c5d2a9517',
    );
    expect(CONTENT_VERSION.webVersion).toBe('0.5.0');
  });

  it('has the Phase 5.1 counts', () => {
    expect(listeningTests).toHaveLength(8);
    expect(readingTests).toHaveLength(8);
    expect(writingPrompts).toHaveLength(30);
    expect(speakingSets).toHaveLength(20);
    expect(vocabularyDeck).toHaveLength(350);
  });

  it('has 40 questions in every Listening test', () => {
    for (const test of listeningTests) {
      expect(allListeningQuestions(test)).toHaveLength(40);
      expect(test.parts).toHaveLength(4);
      for (const part of test.parts) {
        expect(part.transcript.length).toBeGreaterThan(100);
        // Audio is pending real recordings; transcripts are shown instead.
        expect(part.audio_url).toBeNull();
      }
    }
  });

  it('has 40 questions in every Reading test', () => {
    for (const test of readingTests) {
      expect(allReadingQuestions(test)).toHaveLength(40);
      expect(test.passages).toHaveLength(3);
      for (const passage of test.passages) {
        expect(passage.text.length).toBeGreaterThan(100);
      }
    }
    expect(readingTests.filter(t => t.track === 'academic')).toHaveLength(6);
    expect(readingTests.filter(t => t.track === 'general')).toHaveLength(2);
  });

  it('has model answers and commentary for every Writing prompt', () => {
    for (const prompt of writingPrompts) {
      expect(prompt.model_answer.split(/\s+/).length).toBeGreaterThanOrEqual(
        prompt.min_words - 20,
      );
      expect(prompt.commentary.length).toBeGreaterThan(20);
    }
    expect(
      writingPrompts.filter(p => p.track === 'academic' && p.task === 1),
    ).toHaveLength(8);
    expect(
      writingPrompts.filter(p => p.track === 'academic' && p.task === 2),
    ).toHaveLength(8);
    expect(
      writingPrompts.filter(p => p.track === 'general' && p.task === 1),
    ).toHaveLength(7);
    expect(
      writingPrompts.filter(p => p.track === 'general' && p.task === 2),
    ).toHaveLength(7);
  });

  it('has complete Speaking sets', () => {
    for (const set of speakingSets) {
      expect(set.part1).toHaveLength(4);
      expect(set.part3).toHaveLength(4);
      expect(set.part2.prep_seconds).toBe(60);
      expect(set.part2.talk_seconds).toBe(120);
      expect(set.sample_answer.length).toBeGreaterThan(100);
    }
  });

  it('has unique vocabulary words with meanings and examples', () => {
    const words = vocabularyDeck.map(w => w.word);
    expect(new Set(words).size).toBe(words.length);
    for (const entry of vocabularyDeck) {
      expect(entry.meaning.length).toBeGreaterThan(0);
      expect(entry.example.length).toBeGreaterThan(0);
    }
  });

  it('looks up tests by id', () => {
    expect(getListeningTest('L1')?.title).toBe('Listening Test 1');
    expect(getReadingTest('RA1')?.track).toBe('academic');
    expect(getListeningTest('L99')).toBeUndefined();
  });
});
