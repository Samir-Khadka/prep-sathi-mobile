import {
  LISTENING_TABLE,
  listeningBand,
  normalizeShortAnswer,
  overallBand,
  rawToBand,
  READING_ACADEMIC_TABLE,
  READING_GT_TABLE,
  readingBand,
  scoreQuestions,
  shortAnswerMatches,
} from '../scoring';

describe('rawToBand', () => {
  it('maps the Listening table boundaries', () => {
    expect(listeningBand(40)).toBe(9.0);
    expect(listeningBand(39)).toBe(9.0);
    expect(listeningBand(38)).toBe(8.5);
    expect(listeningBand(30)).toBe(7.0);
    expect(listeningBand(23)).toBe(6.0);
    expect(listeningBand(16)).toBe(5.0);
    expect(listeningBand(3)).toBe(2.0);
    expect(listeningBand(2)).toBe(1.0);
    expect(listeningBand(0)).toBe(1.0);
  });

  it('maps the Academic Reading table', () => {
    expect(readingBand('academic', 33)).toBe(7.5);
    expect(readingBand('academic', 30)).toBe(7.0);
    expect(readingBand('academic', 23)).toBe(6.0);
  });

  it('maps the GT Reading table (needs more correct answers)', () => {
    expect(readingBand('general', 30)).toBe(6.0);
    expect(readingBand('general', 34)).toBe(7.0);
    expect(readingBand('general', 40)).toBe(9.0);
    expect(readingBand('general', 3)).toBe(1.5);
  });

  it('clamps out-of-range raw scores', () => {
    expect(rawToBand(LISTENING_TABLE, 99)).toBe(9.0);
    expect(rawToBand(LISTENING_TABLE, -5)).toBe(1.0);
  });

  it('keeps GT 1.5 reachable (Academic has no 1.5)', () => {
    expect(rawToBand(READING_GT_TABLE, 3)).toBe(1.5);
    expect(rawToBand(READING_ACADEMIC_TABLE, 3)).toBe(2.0);
  });
});

describe('overallBand (IELTS rounding)', () => {
  it('averages four bands and rounds .25 up to a half', () => {
    // (6.0 + 6.5 + 7.0 + 7.0) / 4 = 6.625 -> 6.5
    expect(overallBand([6.0, 6.5, 7.0, 7.0])).toBe(6.5);
  });

  it('rounds .75 up to the next whole band', () => {
    // (7.0 + 7.0 + 7.0 + 8.0) / 4 = 7.25 -> 7.5
    expect(overallBand([7.0, 7.0, 7.0, 8.0])).toBe(7.5);
    // avg 7.75 -> 8.0
    expect(overallBand([8.0, 8.0, 7.5, 7.5])).toBe(8.0);
  });

  it('leaves whole averages alone', () => {
    expect(overallBand([6.0, 6.0, 6.0, 6.0])).toBe(6.0);
  });
});

describe('short answers', () => {
  it('normalises case, whitespace, quotes and dashes', () => {
    expect(normalizeShortAnswer('  The  Riverside  ')).toBe('the riverside');
    expect(normalizeShortAnswer('don’t.')).toBe("don't");
    expect(normalizeShortAnswer('well–known')).toBe('well-known');
  });

  it('matches any accepted answer', () => {
    expect(shortAnswerMatches('Riverside', ['riverside', 'Riverside Centre'])).toBe(true);
    expect(shortAnswerMatches('Riverside Centre', ['riverside'])).toBe(false);
  });
});

describe('scoreQuestions', () => {
  const questions = [
    {
      no: 1,
      type: 'mcq',
      prompt: 'Pick one',
      options: ['A', 'B', 'C'],
      answer: 1,
      explanation: 'B is right.',
      evidence: 'Transcript line.',
    },
    {
      no: 2,
      type: 'tfng',
      prompt: 'True or false?',
      answer: 'TRUE',
      explanation: 'It is true.',
      evidence: 'Passage line.',
    },
    {
      no: 3,
      type: 'short',
      prompt: 'One word',
      answers: ['riverside', 'the riverside'],
      explanation: 'Named in the text.',
      evidence: 'Passage line.',
    },
  ];

  it('scores mcq by index, tfng case-insensitively, short by normalisation', () => {
    const {scoreRaw, results} = scoreQuestions(questions, {
      '1': 1,
      '2': 'true',
      '3': 'Riverside',
    });
    expect(scoreRaw).toBe(3);
    expect(results.every(r => r.correct)).toBe(true);
  });

  it('counts missing and wrong answers as incorrect', () => {
    const {scoreRaw, results} = scoreQuestions(questions, {'1': 0});
    expect(scoreRaw).toBe(0);
    expect(results[0].correctAnswer).toBe('B');
    expect(results[1].yourAnswer).toBeNull();
    expect(results[2].correctAnswer).toBe('riverside');
  });
});
