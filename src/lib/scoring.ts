/**
 * Raw-score to band conversion for Listening and Reading.
 *
 * Ported from the web backend (backend/app/scoring.py). Tables are the
 * widely published approximations (IDP / British Council / Cambridge
 * guidance). Exact boundaries shift slightly between real test versions,
 * which is why every band the product shows is labelled a practice
 * estimate, never an official score. Band 0 is reserved for
 * "did not attempt", so a raw score of 0-2 maps to band 1.0.
 */

export const BAND_LABEL = 'practice estimate, not an official score';

// Timed-mode limits (seconds). Listening: 30 minutes for the recordings
// plus 2 minutes to check answers (computer-delivered). Reading: 60
// minutes, no transfer time. Writing (mock): 60 minutes.
export const LISTENING_TIME_LIMIT_SECONDS = 1920;
export const READING_TIME_LIMIT_SECONDS = 3600;
export const WRITING_TIME_LIMIT_SECONDS = 3600;
// Grace after the limit before a timed submit is refused.
export const SUBMIT_GRACE_SECONDS = 60;

type TableRow = readonly [number, number];

export const LISTENING_TABLE: readonly TableRow[] = [
  [39, 9.0],
  [37, 8.5],
  [35, 8.0],
  [32, 7.5],
  [30, 7.0],
  [26, 6.5],
  [23, 6.0],
  [18, 5.5],
  [16, 5.0],
  [13, 4.5],
  [10, 4.0],
  [8, 3.5],
  [6, 3.0],
  [4, 2.5],
  [3, 2.0],
  [0, 1.0],
];

export const READING_ACADEMIC_TABLE: readonly TableRow[] = [
  [39, 9.0],
  [37, 8.5],
  [35, 8.0],
  [33, 7.5],
  [30, 7.0],
  [27, 6.5],
  [23, 6.0],
  [19, 5.5],
  [15, 5.0],
  [13, 4.5],
  [10, 4.0],
  [8, 3.5],
  [6, 3.0],
  [4, 2.5],
  [3, 2.0],
  [0, 1.0],
];

export const READING_GT_TABLE: readonly TableRow[] = [
  [40, 9.0],
  [39, 8.5],
  [37, 8.0],
  [36, 7.5],
  [34, 7.0],
  [32, 6.5],
  [30, 6.0],
  [27, 5.5],
  [23, 5.0],
  [19, 4.5],
  [15, 4.0],
  [12, 3.5],
  [9, 3.0],
  [6, 2.5],
  [4, 2.0],
  [3, 1.5],
  [0, 1.0],
];

export const TABLES: Record<string, readonly TableRow[]> = {
  listening: LISTENING_TABLE,
  'reading-academic': READING_ACADEMIC_TABLE,
  'reading-general': READING_GT_TABLE,
};

export function rawToBand(
  table: readonly TableRow[],
  raw: number,
): number {
  const clamped = Math.max(0, Math.min(40, Math.floor(raw)));
  for (const [minimum, band] of table) {
    if (clamped >= minimum) {
      return band;
    }
  }
  return 1.0;
}

export function listeningBand(raw: number): number {
  return rawToBand(LISTENING_TABLE, raw);
}

export function readingBand(track: string, raw: number): number {
  if (track === 'general') {
    return rawToBand(READING_GT_TABLE, raw);
  }
  return rawToBand(READING_ACADEMIC_TABLE, raw);
}

/**
 * Average four section bands with IELTS rounding: .25 rounds UP to the
 * next half band, .75 rounds UP to the next whole band.
 */
export function overallBand(bands: number[]): number {
  const avg = bands.reduce((sum, b) => sum + b, 0) / bands.length;
  return Math.floor(avg * 2 + 0.5) / 2;
}

const WS_RE = /\s+/g;

/** Normalise a short/completion answer for comparison. */
export function normalizeShortAnswer(value: string): string {
  let text = value.trim().toLowerCase();
  text = text.replace(/’/g, "'").replace(/–/g, '-').replace(/—/g, '-');
  text = text.replace(WS_RE, ' ');
  return text.replace(/\.$/, '').trim();
}

export function shortAnswerMatches(
  given: string,
  accepted: string[],
): boolean {
  const normalized = new Set(accepted.map(normalizeShortAnswer));
  return normalized.has(normalizeShortAnswer(given));
}

/* ------------------------------------------------------------------ */
/* Offline question scoring — mirrors backend/app/routers/practice.py */
/* ------------------------------------------------------------------ */

export interface ContentQuestion {
  no: number;
  type: string;
  prompt: string;
  options?: string[];
  /** mcq: index into options; tfng: "TRUE" | "FALSE" | "NOT GIVEN". */
  answer?: number | string;
  /** short / completion: accepted answers. */
  answers?: string[];
  explanation: string;
  evidence: string;
}

export interface QuestionResult {
  no: number;
  correct: boolean;
  yourAnswer: string | number | null;
  correctAnswer: string | number;
  explanation: string;
  evidence: string;
}

export type AnswerValue = string | number | null | undefined;

function scoreQuestion(
  q: ContentQuestion,
  given: AnswerValue,
): {correct: boolean; correctAnswer: string | number} {
  if (q.type === 'mcq') {
    const correctAnswer: string | number =
      q.options?.[q.answer as number] ?? '';
    if (given === null || given === undefined) {
      return {correct: false, correctAnswer};
    }
    const givenIndex = Number(given);
    if (Number.isNaN(givenIndex)) {
      return {correct: false, correctAnswer};
    }
    return {correct: givenIndex === q.answer, correctAnswer};
  }
  if (q.type === 'tfng') {
    const correctAnswer = String(q.answer ?? '');
    if (given === null || given === undefined) {
      return {correct: false, correctAnswer};
    }
    return {
      correct:
        String(given).trim().toUpperCase() === correctAnswer.toUpperCase(),
      correctAnswer,
    };
  }
  // short / completion
  const correctAnswer = q.answers?.[0] ?? '';
  if (given === null || given === undefined || typeof given !== 'string') {
    return {correct: false, correctAnswer};
  }
  return {
    correct: shortAnswerMatches(given, q.answers ?? []),
    correctAnswer,
  };
}

export function scoreQuestions(
  questions: ContentQuestion[],
  answers: Record<string, AnswerValue>,
): {scoreRaw: number; results: QuestionResult[]} {
  let score = 0;
  const results: QuestionResult[] = [];
  for (const q of questions) {
    const given = answers[String(q.no)] ?? null;
    const {correct, correctAnswer} = scoreQuestion(q, given);
    if (correct) {
      score += 1;
    }
    results.push({
      no: q.no,
      correct,
      yourAnswer: given,
      correctAnswer,
      explanation: q.explanation,
      evidence: q.evidence,
    });
  }
  return {scoreRaw: score, results};
}
