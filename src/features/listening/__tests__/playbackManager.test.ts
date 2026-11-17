/**
 * playbackManager: only one Listening part plays at a time.
 */

import {
  claimPlayback,
  releasePlayback,
  resetPlaybackManagerForTests,
} from '../playbackManager';

describe('playbackManager', () => {
  beforeEach(() => {
    resetPlaybackManagerForTests();
    jest.clearAllMocks();
  });

  it('lets the first player claim playback', async () => {
    const stopA = jest.fn(async () => {});
    await claimPlayback('L1-part1', stopA);
    expect(stopA).not.toHaveBeenCalled();
  });

  it('stops the previous player when another part claims playback', async () => {
    const stopA = jest.fn(async () => {});
    const stopB = jest.fn(async () => {});
    await claimPlayback('L1-part1', stopA);
    await claimPlayback('L1-part2', stopB);
    expect(stopA).toHaveBeenCalledTimes(1);
    expect(stopB).not.toHaveBeenCalled();
  });

  it('does not stop the same player when it re-claims', async () => {
    const stopA = jest.fn(async () => {});
    await claimPlayback('L1-part1', stopA);
    await claimPlayback('L1-part1', stopA);
    expect(stopA).not.toHaveBeenCalled();
  });

  it('does not stop a released player', async () => {
    const stopA = jest.fn(async () => {});
    const stopB = jest.fn(async () => {});
    await claimPlayback('L1-part1', stopA);
    releasePlayback('L1-part1');
    await claimPlayback('L1-part2', stopB);
    expect(stopA).not.toHaveBeenCalled();
  });

  it('still claims playback when stopping the previous player fails', async () => {
    const stopA = jest.fn(async () => {
      throw new Error('already gone');
    });
    const stopB = jest.fn(async () => {});
    await claimPlayback('L1-part1', stopA);
    await expect(claimPlayback('L1-part2', stopB)).resolves.toBeUndefined();
    expect(stopA).toHaveBeenCalledTimes(1);
    // The new player owns the slot now: claiming a third stops B, not A.
    const stopC = jest.fn(async () => {});
    await claimPlayback('L1-part3', stopC);
    expect(stopB).toHaveBeenCalledTimes(1);
    expect(stopA).toHaveBeenCalledTimes(1);
  });
});
