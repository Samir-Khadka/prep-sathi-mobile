/**
 * Tests for the speaking-recording helpers: the 20-recording cap
 * (oldest dropped) and the dB → linear metering conversion.
 */

import {MAX_SPEAKING_RECORDINGS} from '../../../lib/fluency';
import type {StoredSpeakingRecording} from '../../../store/storage';
import {
  addRecordingWithCap,
  meteringDbToLevel,
  recordingFileName,
  removeRecording,
} from '../recordingStore';

function makeRecording(id: string, createdAt: number): StoredSpeakingRecording {
  return {
    id,
    setId: 'S01',
    topic: 'A skill you would like to learn',
    part: 'Part 2',
    filePath: `/tmp/${id}.m4a`,
    durationSeconds: 90,
    createdAt,
    fluency: null,
  };
}

describe('addRecordingWithCap', () => {
  it('keeps recordings under the cap untouched', () => {
    const existing = [makeRecording('a', 1000), makeRecording('b', 2000)];
    const {kept, dropped} = addRecordingWithCap(
      existing,
      makeRecording('c', 3000),
    );
    expect(kept.map(r => r.id)).toEqual(['a', 'b', 'c']);
    expect(dropped).toEqual([]);
  });

  it('drops the oldest recording once the cap is reached', () => {
    expect(MAX_SPEAKING_RECORDINGS).toBe(20);
    const existing = Array.from({length: 20}, (_, i) =>
      makeRecording(`r${i}`, 1000 + i),
    );
    const {kept, dropped} = addRecordingWithCap(
      existing,
      makeRecording('new', 9999),
    );
    expect(kept.length).toBe(20);
    expect(kept.map(r => r.id)).not.toContain('r0');
    expect(kept[kept.length - 1]!.id).toBe('new');
    expect(dropped.map(r => r.id)).toEqual(['r0']);
  });

  it('sorts by creation time, so an out-of-order insert still drops the oldest', () => {
    const existing = [makeRecording('late', 5000), makeRecording('early', 1000)];
    const {kept, dropped} = addRecordingWithCap(
      existing,
      makeRecording('mid', 3000),
      2,
    );
    expect(kept.map(r => r.id)).toEqual(['mid', 'late']);
    expect(dropped.map(r => r.id)).toEqual(['early']);
  });
});

describe('removeRecording', () => {
  it('removes only the named recording', () => {
    const existing = [makeRecording('a', 1000), makeRecording('b', 2000)];
    expect(removeRecording(existing, 'a').map(r => r.id)).toEqual(['b']);
    expect(removeRecording(existing, 'missing')).toEqual(existing);
  });
});

describe('recordingFileName', () => {
  it('names files by set and creation time', () => {
    expect(recordingFileName('S01', 1700000000000)).toBe(
      'speaking_S01_1700000000000.m4a',
    );
  });
});

describe('meteringDbToLevel', () => {
  it('maps silence and loud speech into 0–1', () => {
    expect(meteringDbToLevel(-160)).toBeCloseTo(0, 6);
    expect(meteringDbToLevel(0)).toBe(1);
    // -34 dB is about the 0.02 silence threshold.
    expect(meteringDbToLevel(-34)).toBeCloseTo(0.02, 2);
    expect(meteringDbToLevel(-20)).toBeCloseTo(0.1, 3);
  });

  it('treats missing metering as silence', () => {
    expect(meteringDbToLevel(undefined)).toBe(0);
    expect(meteringDbToLevel(null)).toBe(0);
    expect(meteringDbToLevel(NaN)).toBe(0);
  });
});
