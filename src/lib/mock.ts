/**
 * Mock sitting rotation — pure functions.
 *
 * Mirrors the web backend (backend/app/routers/mock.py): a learner's
 * n-th mock of a track uses pair n (wrapping), so a second mock uses
 * fresh material. Writing prompts rotate in definition order, first
 * unused, wrapping to the first once every prompt has been used.
 */

export const ACADEMIC_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['L1', 'RA1'],
  ['L2', 'RA2'],
  ['L3', 'RA3'],
  ['L4', 'RA4'],
  ['L5', 'RA5'],
  ['L6', 'RA6'],
  ['L7', 'RA1'],
  ['L8', 'RA2'],
];

export const GENERAL_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['L1', 'RG1'],
  ['L2', 'RG1'],
  ['L3', 'RG1'],
  ['L4', 'RG1'],
  ['L5', 'RG2'],
  ['L6', 'RG1'],
  ['L7', 'RG2'],
  ['L8', 'RG1'],
];

export type MockTrack = 'academic' | 'general';

/** Listening + Reading test ids for the n-th mock of a track. */
export function pickMockPair(
  track: MockTrack,
  mocksAlreadyStarted: number,
): {listeningTestId: string; readingTestId: string} {
  const pairs = track === 'academic' ? ACADEMIC_PAIRS : GENERAL_PAIRS;
  const [listeningTestId, readingTestId] =
    pairs[mocksAlreadyStarted % pairs.length];
  return {listeningTestId, readingTestId};
}

/** First unused prompt id of a track/task, in definition order. */
export function pickWritingPrompt(
  orderedPromptIds: string[],
  usedPromptIds: ReadonlySet<string>,
): string {
  for (const id of orderedPromptIds) {
    if (!usedPromptIds.has(id)) {
      return id;
    }
  }
  return orderedPromptIds[0];
}
