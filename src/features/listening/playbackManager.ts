/**
 * Single-player rule for Listening: only one part may play at a
 * time. Each player registers its own stop function when it starts;
 * claiming playback stops whatever other part is playing first.
 * A stop that fails (e.g. the native player is already gone) never
 * blocks the new part from starting.
 */

let activeId: string | null = null;
let activeStop: (() => Promise<void>) | null = null;

export async function claimPlayback(
  id: string,
  stop: () => Promise<void>,
): Promise<void> {
  if (activeId !== null && activeId !== id && activeStop !== null) {
    const previousStop = activeStop;
    activeId = null;
    activeStop = null;
    try {
      await previousStop();
    } catch {
      // The previous player is already gone; play anyway.
    }
  }
  activeId = id;
  activeStop = stop;
}

export function releasePlayback(id: string): void {
  if (activeId === id) {
    activeId = null;
    activeStop = null;
  }
}

/** Test-only reset; the manager has no other mutable state. */
export function resetPlaybackManagerForTests(): void {
  activeId = null;
  activeStop = null;
}
