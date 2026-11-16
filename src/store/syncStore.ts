/**
 * Offline attempt sync (Zustand 5 + MMKV).
 *
 * Practice works fully offline: results are scored on-device from the
 * bundled content. Each scored attempt is queued locally and posted
 * to POST /api/attempts when the device is online and signed in, so
 * the server dashboard stays in sync. A failed sync leaves the queue
 * untouched for the next attempt.
 */

import {create} from 'zustand';
import {recordAttempt} from '../api/client';
import {
  getSyncQueue,
  setSyncQueue,
  type PendingAttempt,
} from './storage';

interface SyncState {
  pending: PendingAttempt[];
  syncing: boolean;
  lastSyncAt: number | null;
  lastError: string | null;
  enqueue: (attempt: Omit<PendingAttempt, 'localId' | 'createdAt'>) => void;
  syncPending: () => Promise<void>;
  refresh: () => void;
}

export const useSyncStore = create<SyncState>()((set, get) => ({
  pending: getSyncQueue(),
  syncing: false,
  lastSyncAt: null,
  lastError: null,

  enqueue: attempt => {
    const entry: PendingAttempt = {
      ...attempt,
      localId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
    };
    const next = [...getSyncQueue(), entry];
    setSyncQueue(next);
    set({pending: next});
  },

  syncPending: async () => {
    if (get().syncing) {
      return;
    }
    const queue = getSyncQueue();
    if (queue.length === 0) {
      return;
    }
    set({syncing: true, lastError: null});
    try {
      const remaining: PendingAttempt[] = [];
      for (const item of queue) {
        try {
          await recordAttempt({
            module: item.module,
            kind: item.kind,
            score_raw: item.score_raw,
            band_estimate: item.band_estimate,
            duration_seconds: item.duration_seconds,
          });
        } catch {
          // Keep this one queued; try the rest.
          remaining.push(item);
        }
      }
      setSyncQueue(remaining);
      set({pending: remaining, lastSyncAt: Date.now()});
    } catch (err) {
      set({
        lastError:
          err instanceof Error ? err.message : 'Sync failed.',
      });
    } finally {
      set({syncing: false});
    }
  },

  refresh: () => {
    set({pending: getSyncQueue()});
  },
}));
