/**
 * Automated Writing feedback (offline port).
 *
 * Faithful TypeScript port of the web backend's
 * `backend/app/feedback.py` (`analyse_writing`). It reads a learner's
 * text for one writing prompt and returns a band *range* per IELTS
 * criterion plus short, actionable notes. Every band shown by the
 * product carries the "practice estimate, not an official score" label.
 *
 * What it can and cannot do — it measures only signals that are
 * directly countable in the text (word count vs the prompt minimum,
 * prompt coverage, paragraphing, linking words, type-token ratio,
 * academic words, repetition, sentence-length variety, complex
 * sentences, and four mechanically detectable error patterns). It
 * cannot judge ideas, argument quality, factual accuracy, or whether
 * an answer is really on topic the way a human examiner can, and it
 * never promises a band or an outcome. The `limits` field in every
 * response says this plainly.
 *
 * Calibration (pinned by src/lib/__tests__/feedback.test.ts, same as
 * the backend's test_feedback.py): all 20 bundled model answers score
 * an overall low end of 7.0 or above, and the weak fixture (about 120
 * words, one paragraph, repetitive vocabulary) scores an overall high
 * end of 5.5 or below.
 *
 * One deliberate shape difference from the backend: the backend's
 * response also carries `prompt_id`; the mobile API type
 * `WritingFeedbackResponse` (src/api/types.ts) does not, so this port
 * returns exactly the mobile shape.
 */

import type {WritingFeedbackResponse} from '../api/types';
import {BAND_LABEL} from './scoring';

/* ------------------------------------------------------------------ */
/* Wordlists — copied verbatim from backend/app/feedback.py            */
/* ------------------------------------------------------------------ */

export const LINKERS: readonly string[] = [
  "on the other hand", "on the one hand", "as a result", "for example", "for instance",
  "in addition", "in conclusion", "in contrast", "in comparison", "in general", "in my opinion",
  "in my view", "in other words", "in particular", "in summary", "in fact", "to sum up",
  "to conclude", "first of all", "compared with", "after that", "afterwards", "on balance",
  "furthermore", "moreover", "however", "therefore", "consequently", "meanwhile", "whereas",
  "nevertheless", "nonetheless", "similarly", "likewise", "instead", "otherwise", "indeed",
  "firstly", "secondly", "thirdly", "finally", "lastly", "overall", "while", "also", "but", "then",
  "next", "first", "second", "third",
];

export const SUBORDINATORS: readonly string[] = [
  "as soon as", "even though", "in order to", "so that", "although", "because", "whereas",
  "unless", "despite", "though", "which", "whose", "whom", "before", "after", "until", "while",
  "when", "since", "once", "who", "if",
];

const STOPWORDS = new Set<string>([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "when", "while", "as", "of", "at",
  "by", "for", "with", "about", "into", "through", "after", "over", "between", "out", "against",
  "during", "without", "before", "under", "around", "among", "within", "upon", "per", "via", "i",
  "me", "my", "we", "our", "you", "your", "he", "him", "his", "she", "her", "it", "its", "they",
  "them", "their", "this", "that", "these", "those", "am", "is", "are", "was", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "shall", "should",
  "can", "could", "may", "might", "must", "there", "here", "what", "which", "who", "whom", "whose",
  "how", "why", "where", "when", "not", "no", "yes", "so", "very", "just", "also", "than", "too",
  "only", "own", "same", "such", "more", "most", "other", "some", "any", "all", "each", "both",
  "few", "much", "many", "little", "own", "in", "on", "to", "from", "of", "summarise", "summarize",
  "summarised", "summarise", "summarising", "information", "selecting", "reporting", "features",
  "comparisons", "relevant", "discuss", "views", "opinion", "reasons", "answer", "include",
  "examples", "knowledge", "experience", "write", "least", "words", "chart", "table", "diagram",
  "graph", "below", "shows", "show", "data", "process", "letter", "dear", "sir", "madam", "yours",
  "faithfully", "sincerely",
]);

const ING_NOUNS = new Set<string>([
  "morning", "evening", "wedding", "building", "meeting", "feeling", "meaning", "learning",
  "training", "reading", "writing", "living", "thing", "something", "anything", "nothing",
  "during", "spring", "king", "ring", "sing", "bring",
]);

export const ACADEMIC_WORDS = new Set<string>([
  "significant", "significantly", "substantial", "considerably", "considerable", "consequence",
  "consequences", "implication", "implications", "phenomenon", "fundamental", "crucial",
  "essential", "apparent", "evident", "inevitable", "ultimately", "primarily", "predominantly",
  "approximately", "proportion", "trend", "tendency", "demonstrate", "illustrate", "highlight",
  "emphasise", "emphasize", "contribute", "derive", "indicate", "facilitate", "implement",
  "establish", "maintain", "fluctuate", "dramatic", "dramatically", "gradual", "widespread",
  "complex", "challenging", "beneficial", "detrimental", "feasible", "sustainable",
  "sustainability", "efficient", "effective", "accessible", "affordable", "perspective",
  "approach", "factor", "impact", "influence", "outcome", "remarkable", "notable", "modest",
  "modestly", "sharply", "equality", "merit", "participation", "investment", "contribution",
  "reasonable", "financial", "society", "benefit", "benefits", "workforce", "standards", "critics",
  "compromise", "access", "afford", "grateful", "appreciate", "concerned", "request", "arrange",
  "inconvenience", "assistance", "regarding", "delighted", "unfortunately", "suitable",
  "appropriate", "available", "responsible", "reliable", "experienced", "qualified", "occasion",
  "celebration",
]);

const OVERVIEW_PHRASES: readonly string[] = [
  "overall", "in general", "it is clear", "the chart shows", "the table shows",
  "the diagram shows", "the graph shows", "in summary", "the main trend", "main features",
  "in conclusion",
];

const LETTER_PURPOSE_PHRASES: readonly string[] = [
  "i am writing",
];

const POSITION_PHRASES: readonly string[] = [
  "in my opinion", "i believe", "i think", "in my view", "i agree", "i disagree", "my opinion is",
  "i would argue", "personally", "in conclusion", "overall, i",
];

const AUXILIARIES = new Set<string>([
  "am", "is", "are", "was", "were", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
]);

const IRREGULAR_VERBS = new Set<string>([
  "went", "took", "made", "gave", "saw", "came", "knew", "got", "found", "thought", "said", "told",
  "became", "began", "brought", "bought", "caught", "chose", "drew", "drank", "drove", "ate",
  "fell", "felt", "flew", "forgot", "grew", "heard", "held", "kept", "left", "lost", "met", "paid",
  "ran", "read", "rode", "rose", "sold", "sent", "shook", "slept", "spoke", "spent", "stood",
  "stole", "swam", "taught", "tore", "woke", "wore", "won", "wrote", "built", "cut", "hit", "put",
  "set", "shut", "cost", "hit", "let", "shut", "arose", "awoke", "borne", "beaten", "bitten",
  "blown", "broken", "chosen", "driven", "eaten", "fallen", "forgotten", "frozen", "given",
  "hidden", "ridden", "risen", "shaken", "stolen", "taken", "torn", "woken", "worn", "written",
]);

const VERB_STEMS = new Set<string>([
  "show", "compare", "increase", "decrease", "rise", "fall", "grow", "change", "become", "make",
  "take", "give", "help", "allow", "lead", "cause", "improve", "reduce", "provide", "support",
  "believe", "think", "argue", "suggest", "claim", "agree", "disagree", "visit", "spend", "live",
  "work", "study", "learn", "use", "need", "want", "like", "enjoy", "prefer", "play", "watch",
  "read", "write", "speak", "travel", "move", "pay", "cost", "buy", "sell", "build", "create",
  "develop", "produce", "offer", "receive", "happen", "occur", "exist", "remain", "continue",
  "begin", "start", "finish", "try", "seem", "appear", "feel", "mean", "include", "involve",
  "require", "depend", "focus", "discuss", "examine", "consider", "address", "affect", "benefit",
  "damage", "protect", "prevent", "solve", "face", "experience", "choose", "decide", "expect",
  "hope", "plan", "aim", "tend", "result", "reflect", "indicate", "demonstrate", "reveal",
  "attract", "consist", "contain", "feature", "double", "exceed", "account", "amount", "average",
  "total", "drop", "climb", "peak", "vary", "fluctuate", "stable", "steady", "shrink", "expand",
  "decline", "surge", "plunge", "recover", "listen", "notice", "obtain", "open", "pass", "pick",
  "practice", "prevent", "raise", "realise", "realize", "regard", "return", "save", "send",
  "share", "spend", "stay", "stop", "talk", "teach", "thank", "wait", "walk", "wish", "worry",
  "attract", "consist", "contain", "depend", "exist", "participate", "perform", "prepare",
  "present", "protect", "reach", "recognise", "recognize", "remember", "remove", "report",
  "represent", "serve", "share", "succeed", "suffer", "support", "treat", "turn", "understand",
  "value", "visit", "watch", "worry", "compare", "attract", "damage", "encourage", "identify",
  "ignore", "intend", "join", "manage", "perform", "present", "produce", "protect", "realise",
  "receive", "recognise", "remove", "require", "resolve", "respond", "return", "reveal", "review",
  "rise", "risk", "save", "serve", "settle", "share", "show", "sign", "speak", "spend", "stand",
  "start", "state", "stop", "study", "suggest", "support", "survive", "take", "talk", "teach",
  "tell", "tend", "thank", "think", "throw", "touch", "trade", "train", "travel", "treat", "try",
  "turn", "understand", "use", "visit", "wait", "walk", "want", "watch", "wear", "win", "wish",
  "work", "worry", "write",
]);

export const LIMITS =
  "Automated feedback only. It counts measurable patterns in your text " +
  '(length, linking words, vocabulary variety, sentence variety) and ' +
  'cannot judge your ideas, the quality of your arguments, or factual ' +
  'accuracy the way a human examiner can. The band range is guidance ' +
  'for practice only — it never promises a band or an outcome in a ' +
  'real test.';

export const MIN_BAND = 4.0;
export const MAX_BAND = 8.0;

/** The prompt shape `analyseWriting` needs (a bundled WritingPrompt fits). */
export interface FeedbackPrompt {
  id: string;
  task: 1 | 2;
  track: 'academic' | 'general';
  prompt: string;
  min_words: number;
}

export interface CriterionScore {
  band_low: number;
  band_high: number;
  notes: string[];
}

/* ------------------------------------------------------------------ */
/* Tokenising helpers                                                  */
/* ------------------------------------------------------------------ */

const WORD_RE = /[a-z]+(?:'[a-z]+)?/g;

/** Lowercase alphabetic tokens (apostrophes kept inside words). */
export function tokens(text: string): string[] {
  return text.toLowerCase().match(WORD_RE) ?? [];
}

/** Word count by the feedback module's definition (alphabetic tokens). */
export function countWords(text: string): number {
  return tokens(text).length;
}

/**
 * Split on sentence-final punctuation followed by whitespace — the
 * same split as Python's `re.split(r"(?<=[.!?])\\s+", ...)` (written
 * out by hand: Hermes lookbehind support is not something to rely on).
 */
export function sentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (
      (ch === '.' || ch === '!' || ch === '?') &&
      i + 1 < trimmed.length &&
      /\s/.test(trimmed[i + 1]!)
    ) {
      parts.push(trimmed.slice(start, i + 1));
      let j = i + 1;
      while (j < trimmed.length && /\s/.test(trimmed[j]!)) {
        j++;
      }
      start = j;
      i = j - 1;
    }
  }
  if (start < trimmed.length) {
    parts.push(trimmed.slice(start));
  }
  return parts.map(p => p.trim()).filter(Boolean);
}

/** Blank-line-separated blocks; a text with no blank lines is one. */
export function paragraphs(text: string): string[] {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
}

/**
 * Round to the nearest 0.5, ties to even — Python's `round()` (which
 * the backend's `_round_half` uses) rounds half to even, while
 * `Math.round` rounds half up. The difference matters: the overall
 * low end of the model answers lands on .25/.75 averages, and the
 * empty-text case must come out at exactly 4.0, not 4.5.
 */
export function roundHalf(value: number): number {
  const doubled = value * 2;
  const floor = Math.floor(doubled);
  const frac = doubled - floor;
  if (Math.abs(frac - 0.5) < 1e-9) {
    return (floor % 2 === 0 ? floor : floor + 1) / 2;
  }
  return Math.round(doubled) / 2;
}

function clampBand(value: number): number {
  return Math.max(MIN_BAND, Math.min(MAX_BAND, roundHalf(value)));
}

/** Map a 0–10 criterion score to a band centre in 0.5 steps. */
function scoreToBand(score10: number): number {
  if (score10 >= 9.0) {
    return 8.0;
  }
  if (score10 >= 8.0) {
    return 7.5;
  }
  if (score10 >= 7.0) {
    return 7.0;
  }
  if (score10 >= 6.0) {
    return 6.5;
  }
  if (score10 >= 5.0) {
    return 6.0;
  }
  if (score10 >= 4.0) {
    return 5.5;
  }
  if (score10 >= 3.0) {
    return 5.0;
  }
  if (score10 >= 2.0) {
    return 4.5;
  }
  return 4.0;
}

/** A criterion band range: centre ± 0.5, clamped to 4.0–8.0. */
function bandRange(score10: number): [number, number] {
  const centre = scoreToBand(score10);
  return [clampBand(centre - 0.5), clampBand(centre + 0.5)];
}

/** Non-stopword tokens, in order of appearance. */
function contentWords(text: string): string[] {
  return tokens(text).filter(w => !STOPWORDS.has(w));
}

/** Distinct content words of the prompt, in first-seen order. */
function promptKeyWords(promptText: string): string[] {
  const seen: string[] = [];
  for (const word of contentWords(promptText)) {
    if (!seen.includes(word)) {
      seen.push(word);
    }
  }
  return seen;
}

function hasPhrase(
  textLower: string,
  phrases: readonly string[],
): string | null {
  for (const phrase of phrases) {
    if (textLower.includes(phrase)) {
      return phrase;
    }
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countPhrase(textLower: string, phrase: string): number {
  const matches = textLower.match(
    new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'g'),
  );
  return matches ? matches.length : 0;
}

/** Crude suffix strip so 'compares'/'compared'/'comparing' match. */
function stem(word: string): string {
  if (word.endsWith('ies') && word.length > 4) {
    return word.slice(0, -3) + 'y';
  }
  for (const suffix of ['ing', 'ed', 'es']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, -suffix.length);
    }
  }
  if (word.endsWith('s') && word.length > 3) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * True if a word is (a plural/singular form of) a prompt key word —
 * repeating the topic words is expected, not a vocabulary weakness.
 */
function isPromptRelated(word: string, keyWords: Set<string>): boolean {
  if (keyWords.has(word)) {
    return true;
  }
  if (keyWords.has(word + 's')) {
    return true;
  }
  if (word.endsWith('s') && keyWords.has(word.slice(0, -1))) {
    return true;
  }
  return false;
}

function sentenceHasVerb(sentence: string): boolean {
  for (const word of tokens(sentence)) {
    if (AUXILIARIES.has(word) || IRREGULAR_VERBS.has(word)) {
      return true;
    }
    if (VERB_STEMS.has(stem(word))) {
      return true;
    }
  }
  return false;
}

/** Population standard deviation (Python's `statistics.pstdev`). */
function pstdev(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) * (v - mean), 0) /
    values.length;
  return Math.sqrt(variance);
}

/* ------------------------------------------------------------------ */
/* Criterion analysers — each returns (score out of 10, notes)         */
/* ------------------------------------------------------------------ */

function analyseTaskAchievement(
  prompt: FeedbackPrompt,
  text: string,
  words: string[],
  wordCount: number,
): [number, string[]] {
  const minWords = prompt.min_words;
  const ratio = minWords ? wordCount / minWords : 0;

  // Length: 4 of 10 points.
  let lengthPoints: number;
  if (ratio >= 1.0) {
    lengthPoints = 4.0;
  } else if (ratio >= 0.9) {
    lengthPoints = 3.5;
  } else if (ratio >= 0.8) {
    lengthPoints = 3.0;
  } else if (ratio >= 0.6) {
    lengthPoints = 2.0;
  } else if (ratio >= 0.4) {
    lengthPoints = 1.0;
  } else {
    lengthPoints = 0.0;
  }

  // Prompt coverage: 3 of 10 points.
  const keyWords = promptKeyWords(prompt.prompt);
  const wordSet = new Set(words);
  const covered = keyWords.filter(w => wordSet.has(w));
  const coverage = keyWords.length ? covered.length / keyWords.length : 0;
  let coveragePoints: number;
  if (coverage >= 0.5) {
    coveragePoints = 3.0;
  } else if (coverage >= 0.35) {
    coveragePoints = 2.0;
  } else if (coverage >= 0.2) {
    coveragePoints = 1.0;
  } else {
    coveragePoints = 0.0;
  }

  // Expected structure signal: 3 of 10 points.
  const lower = text.toLowerCase();
  const firstSentences = sentences(text).slice(0, 3).join(' ').toLowerCase();
  const task = prompt.task;
  const track = prompt.track;
  let signal: string | null = null;
  let signalName = 'clear position';
  if (task === 1 && track === 'academic') {
    signal = hasPhrase(firstSentences, OVERVIEW_PHRASES);
    signalName = 'overview sentence';
  } else if (task === 1) {
    const first = firstSentences.replace(/^\s+/, '');
    signal =
      hasPhrase(firstSentences, LETTER_PURPOSE_PHRASES) ||
      (first.startsWith('dear') ||
      first.startsWith('hi ') ||
      first.startsWith('hello ')
        ? 'greeting'
        : null);
    signalName = 'greeting and purpose';
  } else {
    signal = hasPhrase(lower, POSITION_PHRASES);
    signalName = 'clear position';
  }
  const structurePoints = signal ? 3.0 : 0.0;

  let score = lengthPoints + coveragePoints + structurePoints;

  // Under-length caps the score: a short answer cannot score highly on
  // task achievement however well written it is.
  if (ratio < 0.5) {
    score = Math.min(score, 3.0);
  } else if (ratio < 0.8) {
    score = Math.min(score, 4.0);
  } else if (ratio < 1.0) {
    score = Math.min(score, 5.0);
  }

  const notes: string[] = [];
  if (ratio >= 1.0) {
    notes.push(
      `Your text has ${wordCount} words, above the ${minWords}-word ` +
        'minimum — good length for this task.',
    );
  } else {
    const missing = Math.max(0, minWords - wordCount);
    notes.push(
      `Your text has ${wordCount} words, below the ${minWords}-word ` +
        `minimum — add about ${missing} more words to cover the task fully.`,
    );
  }
  if (keyWords.length) {
    const shown = covered.slice(0, 6).join(', ');
    notes.push(
      `You covered ${covered.length} of the ${keyWords.length} key words ` +
        `from the prompt (${shown}) — ` +
        (coverage >= 0.35
          ? 'good coverage of the topic.'
          : "try to address more of the prompt's key points."),
    );
  }
  if (signal) {
    notes.push(
      `Your ${signalName} is present ('${signal}') — it tells the ` +
        'reader what the answer will do.',
    );
  } else if (task === 1 && track === 'academic') {
    notes.push(
      'Add an overview sentence near the start (for example, ' +
        "'Overall, ...') that sums up the main trends before the details.",
    );
  } else if (task === 1) {
    notes.push(
      'Open with a greeting and a sentence saying why you are ' +
        "writing (for example, 'I am writing to ...').",
    );
  } else {
    notes.push(
      'State your position clearly (for example, \'In my opinion, ...\') ' +
        'so the reader knows where you stand.',
    );
  }
  return [score, notes];
}

function analyseCoherence(
  prompt: FeedbackPrompt,
  text: string,
  words: string[],
  _sentenceList: string[],
): [number, string[]] {
  const paras = paragraphs(text);
  const wordCount = words.length;
  const lower = text.toLowerCase();

  // Paragraphs: 3 of 7 points. Model answers in this product are stored
  // as one long block, so a single long paragraph still earns partial
  // credit — the missing breaks are flagged in the notes instead.
  let paraPoints: number;
  if (paras.length >= 3) {
    paraPoints = 3.0;
  } else if (paras.length === 2) {
    paraPoints = 2.5;
  } else if (wordCount >= 200) {
    paraPoints = 2.5;
  } else if (wordCount >= 150) {
    paraPoints = 1.0;
  } else {
    paraPoints = 0.0;
  }

  // Linking words: 3 of 7 points (distinct devices, not raw count).
  // Task 1 texts are shorter and descriptive, so they are judged
  // against a smaller expected range than Task 2 essays.
  const found = new Map<string, number>();
  for (const linker of LINKERS) {
    const count = countPhrase(lower, linker);
    if (count) {
      found.set(linker, count);
    }
  }
  const distinctLinkers = found.size;
  let linkerPoints: number;
  if (prompt.task === 1) {
    if (distinctLinkers >= 3) {
      linkerPoints = 3.0;
    } else if (distinctLinkers === 2) {
      linkerPoints = 2.0;
    } else if (distinctLinkers === 1) {
      linkerPoints = 1.0;
    } else {
      linkerPoints = 0.0;
    }
  } else {
    if (distinctLinkers >= 5) {
      linkerPoints = 3.0;
    } else if (distinctLinkers >= 3) {
      linkerPoints = 2.0;
    } else if (distinctLinkers >= 1) {
      linkerPoints = 1.0;
    } else {
      linkerPoints = 0.0;
    }
  }

  // Opening picks up the prompt's words: 1 of 7 points.
  const keyWords = new Set(promptKeyWords(prompt.prompt));
  const firstParaWords = paras.length
    ? new Set(contentWords(paras[0]!))
    : new Set<string>();
  const overlap = [...keyWords].filter(w => firstParaWords.has(w));
  const topicPoints = overlap.length >= 2 ? 1.0 : 0.0;

  let points = paraPoints + linkerPoints + topicPoints;

  // Balance penalties (only meaningful with real paragraph breaks).
  const oneSentenceParas = paras.filter(p => sentences(p).length === 1).length;
  if (paras.length >= 2 && oneSentenceParas) {
    points -= 0.5;
  }
  if (paras.length >= 2) {
    const paraWordCounts = paras.map(p => tokens(p).length);
    if (
      paraWordCounts.length &&
      Math.max(...paraWordCounts) > 0.75 * wordCount
    ) {
      points -= 0.5;
    }
  }
  const mostUsed = found.size ? Math.max(...found.values()) : 0;
  if (mostUsed >= 4) {
    points -= 0.5;
  }
  points = Math.max(0.0, points);

  const score = (points / 7.0) * 10.0;

  const notes: string[] = [];
  if (paras.length >= 3) {
    notes.push(
      `Your text is organised into ${paras.length} paragraphs — the ` +
        'reader can follow the structure.',
    );
  } else if (paras.length === 2) {
    notes.push(
      'Your text has 2 paragraphs — a third paragraph would separate ' +
        'your ideas more clearly.',
    );
  } else {
    notes.push(
      'Your text is one long paragraph — split it into 3–4 paragraphs ' +
        '(introduction, main points, conclusion) so the structure is clear.',
    );
  }
  if (linkerPoints >= 3.0) {
    const shown = [...found.keys()].sort().slice(0, 6).join(', ');
    notes.push(
      `You used ${distinctLinkers} different linking words (${shown}) ` +
        '— good range of connections between ideas.',
    );
  } else if (distinctLinkers >= 1) {
    const shown = [...found.keys()].sort().join(', ');
    const word = distinctLinkers === 1 ? 'word' : 'words';
    notes.push(
      `You used ${distinctLinkers} different linking ${word} (${shown}) — ` +
        "add more variety, for example 'however', 'in contrast' or " +
        "'as a result'.",
    );
  } else {
    notes.push(
      'You used almost no linking words — connect your ideas with ' +
        "'however', 'for example', 'as a result' or 'in conclusion'.",
    );
  }
  if (mostUsed >= 4) {
    let repeated = '';
    let repeatedCount = 0;
    for (const [linker, count] of found) {
      if (count > repeatedCount) {
        repeated = linker;
        repeatedCount = count;
      }
    }
    notes.push(
      `You used '${repeated}' ${found.get(repeated)} times — vary it with ` +
        'other linking words instead of repeating the same one.',
    );
  }
  if (oneSentenceParas && paras.length >= 2) {
    notes.push(
      'One of your paragraphs is a single sentence — join it to a ' +
        'neighbouring paragraph or develop the point further.',
    );
  }
  if (overlap.length >= 2) {
    notes.push(
      "Your opening picks up the prompt's key words, so the reader " +
        'knows the answer is on topic.',
    );
  } else {
    notes.push(
      'Open by naming the topic from the prompt — it shows the answer ' +
        'is directly on task.',
    );
  }
  return [score, notes.slice(0, 4)];
}

function analyseLexical(
  prompt: FeedbackPrompt,
  words: string[],
  sentenceList: string[],
): [number, string[]] {
  const wordCount = words.length;
  if (wordCount === 0) {
    return [0.0, ['Your text is empty — write something to get feedback.']];
  }

  const distinct = new Set(words).size;
  const ttr = distinct / wordCount;

  // Type-token ratio: 3 of 10 points.
  let ttrPoints: number;
  if (ttr >= 0.55) {
    ttrPoints = 3.0;
  } else if (ttr >= 0.5) {
    ttrPoints = 2.5;
  } else if (ttr >= 0.45) {
    ttrPoints = 2.0;
  } else if (ttr >= 0.4) {
    ttrPoints = 1.5;
  } else {
    ttrPoints = 0.5;
  }

  // Academic words: 3 of 10 points. Task 1 descriptions and letters
  // legitimately use plainer vocabulary, so the bar is lower than for
  // a Task 2 essay.
  const academicHits = [...new Set(words)]
    .filter(w => ACADEMIC_WORDS.has(w))
    .sort();
  let academicPoints: number;
  if (academicHits.length >= 4) {
    academicPoints = 3.0;
  } else if (academicHits.length >= 2) {
    academicPoints = 2.0;
  } else if (academicHits.length === 1) {
    academicPoints = 1.0;
  } else {
    academicPoints = 0.0;
  }

  // Repetition: 2 of 10 points. Prompt key words are excluded (plural-
  // aware) — repeating the topic words is expected, not a weakness.
  const keyWords = new Set(promptKeyWords(prompt.prompt));
  const contentCounts = new Map<string, number>();
  for (const w of words) {
    if (STOPWORDS.has(w) || isPromptRelated(w, keyWords)) {
      continue;
    }
    contentCounts.set(w, (contentCounts.get(w) ?? 0) + 1);
  }
  let topWord = '';
  let topCount = 0;
  for (const [word, count] of contentCounts) {
    if (count > topCount) {
      topWord = word;
      topCount = count;
    }
  }
  let repeatPoints: number;
  if (topCount <= 7) {
    repeatPoints = 2.0;
  } else if (topCount <= 10) {
    repeatPoints = 1.0;
  } else {
    repeatPoints = 0.0;
  }

  // Collocation variety: 2 of 10 points. Distinct content-word bigrams
  // are almost always new, so what is scored is how often a pair is
  // *repeated*: the share of distinct bigrams (built inside sentences)
  // that occur twice or more, ignoring pairs made only of prompt words
  // (data labels legitimately repeat).
  const bigramCounts = new Map<string, number>();
  for (const sentence of sentenceList) {
    const content = tokens(sentence).filter(w => !STOPWORDS.has(w));
    for (let i = 0; i < content.length - 1; i++) {
      const pair: [string, string] = [content[i]!, content[i + 1]!];
      if (
        isPromptRelated(pair[0], keyWords) &&
        isPromptRelated(pair[1], keyWords)
      ) {
        continue;
      }
      const key = `${pair[0]} ${pair[1]}`;
      bigramCounts.set(key, (bigramCounts.get(key) ?? 0) + 1);
    }
  }
  let totalBigrams = 0;
  for (const c of bigramCounts.values()) {
    totalBigrams += c;
  }
  let repeatedBigrams = 0;
  for (const c of bigramCounts.values()) {
    if (c >= 2) {
      repeatedBigrams += 1;
    }
  }
  let bigramPoints: number;
  let repeatedRatio = 0.0;
  if (totalBigrams === 0) {
    bigramPoints = 1.0;
  } else {
    repeatedRatio = repeatedBigrams / totalBigrams;
    if (repeatedRatio <= 0.03) {
      bigramPoints = 2.0;
    } else if (repeatedRatio <= 0.06) {
      bigramPoints = 1.5;
    } else if (repeatedRatio <= 0.1) {
      bigramPoints = 1.0;
    } else {
      bigramPoints = 0.0;
    }
  }

  const score = ttrPoints + academicPoints + repeatPoints + bigramPoints;

  const notes: string[] = [];
  notes.push(
    `Your vocabulary is ${ttr >= 0.5 ? 'varied' : 'quite repetitive'}: ` +
      `${distinct} different words in ${wordCount} ` +
      `(type-token ratio ${ttr.toFixed(2)}).`,
  );
  if (academicHits.length >= 4) {
    notes.push(
      `You used ${academicHits.length} academic words ` +
        `(${academicHits.slice(0, 6).join(', ')}) — good formal vocabulary.`,
    );
  } else if (academicHits.length) {
    notes.push(
      `You used ${academicHits.length} academic word(s) ` +
        `(${academicHits.join(', ')}) — try more formal words such as ` +
        "'significant', 'consequence' or 'substantial' where they fit.",
    );
  } else {
    notes.push(
      'You used no academic words from our list — try formal words ' +
        "such as 'significant', 'consequence' or 'substantial' where " +
        'they fit naturally.',
    );
  }
  if (topCount > 6 && topWord) {
    notes.push(
      `The word '${topWord}' appears ${topCount} times — vary it ` +
        'with synonyms or rephrase so the vocabulary does not repeat.',
    );
  } else if (repeatedBigrams) {
    notes.push(
      `${repeatedBigrams} of your content-word pairs repeat ` +
        `(${(repeatedRatio * 100).toFixed(0)}% of all pairs) — vary your word ` +
        'combinations instead of reusing the same phrases.',
    );
  } else {
    notes.push(
      `You used ${bigramCounts.size} different content-word pairs ` +
        'and almost none repeat — good variety of word combinations.',
    );
  }
  return [score, notes.slice(0, 4)];
}

function analyseGrammar(
  text: string,
  sentenceList: string[],
): [number, string[]] {
  const lower = text.toLowerCase();
  const lengths = sentenceList.map(s => tokens(s).length);
  const sentenceCount = sentenceList.length;

  // Sentence-length variety: 3 of 10 points.
  const stdev = sentenceCount >= 3 ? pstdev(lengths) : 0.0;
  let varietyPoints: number;
  if (stdev >= 6.0) {
    varietyPoints = 3.0;
  } else if (stdev >= 4.0) {
    varietyPoints = 2.5;
  } else if (stdev >= 2.5) {
    varietyPoints = 2.0;
  } else if (stdev >= 1.5) {
    varietyPoints = 1.0;
  } else {
    varietyPoints = 0.5;
  }

  // Complex-sentence signals: 3 of 10 points. Two countable signals:
  // distinct subordinating/relative words, and sentences with a
  // participial -ing clause (e.g. "attracting 420,000 visitors").
  const foundSub = new Map<string, number>();
  for (const sub of SUBORDINATORS) {
    const count = countPhrase(lower, sub);
    if (count) {
      foundSub.set(sub, count);
    }
  }
  const distinctSub = foundSub.size;
  let participial = 0;
  for (const sentence of sentenceList) {
    const sentenceTokens = tokens(sentence);
    if (
      sentenceTokens
        .slice(2)
        .some(w => w.endsWith('ing') && !ING_NOUNS.has(w))
    ) {
      participial += 1;
    }
  }
  let complexPoints: number;
  if (distinctSub >= 4) {
    complexPoints = 3.0;
  } else if (distinctSub === 3) {
    complexPoints = 2.0;
  } else if (distinctSub === 2) {
    complexPoints = 1.5;
  } else if (distinctSub === 1 && participial >= 2) {
    complexPoints = 1.0;
  } else if (distinctSub === 1) {
    complexPoints = 0.5;
  } else if (participial >= 2) {
    complexPoints = 1.0;
  } else {
    complexPoints = 0.0;
  }

  // Detectable error patterns: 4 of 10 points, minus 1 per pattern hit.
  let accuracyPoints = 4.0;
  const runOns = lengths.filter(n => n > 45);
  if (runOns.length) {
    accuracyPoints -= 1.0;
  }
  const noVerb = sentenceList.filter(
    s => tokens(s).length >= 4 && !sentenceHasVerb(s),
  );
  if (noVerb.length) {
    accuracyPoints -= 1.0;
  }
  const veryCount = countPhrase(lower, 'very');
  if (veryCount >= 3) {
    accuracyPoints -= 1.0;
  }
  const iThinkOpeners = sentenceList.filter(s =>
    s.trim().toLowerCase().startsWith('i think'),
  ).length;
  if (iThinkOpeners >= 3) {
    accuracyPoints -= 1.0;
  }
  accuracyPoints = Math.max(0.0, accuracyPoints);

  const score = varietyPoints + complexPoints + accuracyPoints;

  const notes: string[] = [];
  if (sentenceCount === 0) {
    notes.push('Your text has no complete sentences yet.');
  } else if (stdev >= 4.0) {
    notes.push(
      `Sentence lengths vary well (from ${Math.min(...lengths)} to ` +
        `${Math.max(...lengths)} words) — that reads naturally.`,
    );
  } else {
    notes.push(
      'Your sentences are mostly the same length ' +
        `(${Math.min(...lengths)}–${Math.max(...lengths)} words) — mix short and long ` +
        'sentences for a more natural rhythm.',
    );
  }
  if (distinctSub >= 3) {
    const shown = [...foundSub.keys()].sort().slice(0, 5).join(', ');
    notes.push(
      `You used ${distinctSub} different complex-sentence words ` +
        `(${shown}) — good range of sentence structures.`,
    );
  } else if (distinctSub >= 1 || participial >= 2) {
    const shown =
      [...foundSub.keys()].sort().slice(0, 5).join(', ') ||
      'participial -ing clauses';
    notes.push(
      `You used some complex sentences (${shown}) — add more with ` +
        "'although', 'because', 'while' or 'which' to join ideas together.",
    );
  } else {
    notes.push(
      "Try more complex sentences using 'although', 'because', " +
        "'while' or 'which' to join ideas together.",
    );
  }
  if (runOns.length) {
    notes.push(
      `One sentence runs to ${Math.max(...runOns)} words — split sentences ` +
        'over 45 words into two shorter ones.',
    );
  }
  if (noVerb.length) {
    notes.push(
      `${noVerb.length} sentence(s) may be missing a main verb — check ` +
        'each one reads as a complete sentence.',
    );
  }
  if (veryCount >= 3) {
    notes.push(
      `You used 'very' ${veryCount} times — replace it with a ` +
        "stronger word ('very big' → 'enormous', 'very important' → " +
        "'crucial').",
    );
  }
  if (iThinkOpeners >= 3) {
    notes.push(
      `${iThinkOpeners} sentences open with 'I think' — vary your ` +
        "openings ('In my view', 'It seems that', 'One reason is').",
    );
  }
  if (
    !(
      runOns.length ||
      noVerb.length ||
      veryCount >= 3 ||
      iThinkOpeners >= 3
    )
  ) {
    notes.push(
      'No common mechanical issues were found in the patterns this ' +
        'tool can check — it cannot check spelling or article use, so ' +
        'proofread those yourself.',
    );
  }
  return [score, notes.slice(0, 4)];
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Analyse one writing answer and return feedback with a band range.
 * Empty text is handled (word count 0, lowest bands) rather than
 * raising — the screen turns empty input into a validation message.
 * Every band is in 0.5 steps between 4.0 and 8.0.
 */
export function analyseWriting(
  prompt: FeedbackPrompt,
  text: string,
): WritingFeedbackResponse {
  const words = tokens(text);
  const wordCount = words.length;
  const minWords = prompt.min_words;
  const sentenceList = sentences(text);

  const [taScore, taNotes] = analyseTaskAchievement(
    prompt,
    text,
    words,
    wordCount,
  );
  const [ccScore, ccNotes] = analyseCoherence(
    prompt,
    text,
    words,
    sentenceList,
  );
  const [lexScore, lexNotes] = analyseLexical(prompt, words, sentenceList);
  const [gramScore, gramNotes] = analyseGrammar(text, sentenceList);

  const criteria: Record<string, CriterionScore> = {};
  for (const [key, score, notes] of [
    ['task_achievement', taScore, taNotes],
    ['coherence', ccScore, ccNotes],
    ['lexical', lexScore, lexNotes],
    ['grammar', gramScore, gramNotes],
  ] as const) {
    const [low, high] = bandRange(score);
    criteria[key] = {band_low: low, band_high: high, notes};
  }

  const overallLow = roundHalf(
    (criteria.task_achievement!.band_low +
      criteria.coherence!.band_low +
      criteria.lexical!.band_low +
      criteria.grammar!.band_low) /
      4,
  );
  const overallHigh = roundHalf(
    (criteria.task_achievement!.band_high +
      criteria.coherence!.band_high +
      criteria.lexical!.band_high +
      criteria.grammar!.band_high) /
      4,
  );

  return {
    word_count: wordCount,
    min_words: minWords,
    meets_minimum: minWords ? wordCount >= minWords : false,
    band_low: overallLow,
    band_high: overallHigh,
    band_label: BAND_LABEL,
    criteria,
    limits: LIMITS,
  };
}
