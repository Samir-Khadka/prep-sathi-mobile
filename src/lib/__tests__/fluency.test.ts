import {
  analyseFluency,
  estimateBandRange,
  MAX_SPEAKING_RECORDINGS,
  SPEAKING_TARGET_SECONDS,
} from '../fluency';

describe('estimateBandRange', () => {
  it('rewards full coverage with the top range', () => {
    expect(estimateBandRange(100, 120, 2, 1)).toEqual({
      bandLow: 6.5,
      bandHigh: 7.5,
    });
  });

  it('steps down with coverage', () => {
    expect(estimateBandRange(78, 120, 2, 1)).toEqual({
      bandLow: 6.0,
      bandHigh: 7.0,
    });
    expect(estimateBandRange(54, 120, 2, 1)).toEqual({
      bandLow: 5.0,
      bandHigh: 6.0,
    });
    expect(estimateBandRange(20, 120, 2, 1)).toEqual({
      bandLow: 4.0,
      bandHigh: 5.0,
    });
  });

  it('caps severe hesitation at 4.5–5.5 even with good coverage', () => {
    expect(estimateBandRange(100, 120, 10, 1)).toEqual({
      bandLow: 4.5,
      bandHigh: 5.5,
    });
    expect(estimateBandRange(100, 120, 2, 6)).toEqual({
      bandLow: 4.5,
      bandHigh: 5.5,
    });
  });

  it('drops moderate hesitation one step', () => {
    expect(estimateBandRange(100, 120, 7, 2)).toEqual({
      bandLow: 6.0,
      bandHigh: 7.0,
    });
  });
});

describe('analyseFluency', () => {
  it('counts speech vs pauses from RMS samples', () => {
    // 100 samples at 0.1s = 10s; 80 loud, 20 silent (2s pause).
    const levels = [
      ...Array(80).fill(0.5),
      ...Array(20).fill(0.0),
    ];
    const result = analyseFluency(levels, 0.1, 10, SPEAKING_TARGET_SECONDS);
    expect(result.speechSeconds).toBe(8);
    expect(result.pauseCount).toBe(1);
    expect(result.longestPauseSeconds).toBe(2);
    expect(result.bandLabel).toBe(
      'practice estimate, not an official score',
    );
    expect(result.notes.length).toBeGreaterThan(0);
  });

  it('never exceeds the 20-recording cap constant', () => {
    expect(MAX_SPEAKING_RECORDINGS).toBe(20);
  });
});
