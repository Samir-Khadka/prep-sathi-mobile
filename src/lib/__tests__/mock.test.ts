import {pickMockPair, pickWritingPrompt} from '../mock';

describe('mock rotation', () => {
  it('rotates Academic pairs and wraps', () => {
    expect(pickMockPair('academic', 0)).toEqual({
      listeningTestId: 'L1',
      readingTestId: 'RA1',
    });
    expect(pickMockPair('academic', 3)).toEqual({
      listeningTestId: 'L4',
      readingTestId: 'RA4',
    });
    expect(pickMockPair('academic', 4)).toEqual({
      listeningTestId: 'L1',
      readingTestId: 'RA1',
    });
  });

  it('reuses RG1 for every General mock', () => {
    expect(pickMockPair('general', 1)).toEqual({
      listeningTestId: 'L2',
      readingTestId: 'RG1',
    });
    expect(pickMockPair('general', 2)).toEqual({
      listeningTestId: 'L3',
      readingTestId: 'RG1',
    });
  });

  it('picks the first unused writing prompt, then wraps', () => {
    const ordered = ['WA-T1-01', 'WA-T1-02', 'WA-T1-03'];
    expect(pickWritingPrompt(ordered, new Set())).toBe('WA-T1-01');
    expect(pickWritingPrompt(ordered, new Set(['WA-T1-01']))).toBe('WA-T1-02');
    expect(
      pickWritingPrompt(ordered, new Set(['WA-T1-01', 'WA-T1-02', 'WA-T1-03'])),
    ).toBe('WA-T1-01');
  });
});
