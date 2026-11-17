/**
 * On-device storage via react-native-mmkv.
 *
 * One MMKV instance holds auth, settings, the offline sync queue,
 * local vocabulary state and speaking-recording metadata. MMKV files
 * live in the app-private directory, so other apps cannot read them.
 *
 * NOTE: the JWT no longer lives here. Since Phase 5.3 it is stored
 * in the OS secure store via src/store/tokenStore.ts
 * (react-native-keychain, local-only). The `auth.token` MMKV key
 * below is legacy-only: it exists so migrateLegacyToken() can move
 * a pre-Keychain token once, then it is removed. Nothing else
 * secret is stored on device.
 */

import {createMMKV} from 'react-native-mmkv';

export const DEFAULT_API_BASE_URL = 'https://prepsathi-api.onrender.com';

export const storage = createMMKV({id: 'prepsathi'});

const KEYS = {
  authToken: 'auth.token',
  authUser: 'auth.user',
  apiBaseUrl: 'settings.apiBaseUrl',
  track: 'settings.track',
  targetOverall: 'settings.targetOverall',
  targetWriting: 'settings.targetWriting',
  syncQueue: 'sync.queue',
  vocabLocal: 'vocab.local',
  speakingRecordings: 'speaking.recordings',
  mockHistory: 'mock.history',
} as const;

export type Track = 'academic' | 'general';

function getString(key: string): string | null {
  const value = storage.getString(key);
  return value === undefined ? null : value;
}

function getJson<T>(key: string, fallback: T): T {
  const raw = getString(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setJson(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

/* --- Auth (legacy token only — see src/store/tokenStore.ts) -------- */

/**
 * Legacy MMKV auth token, kept only for the one-time migration in
 * tokenStore.migrateLegacyToken(). Do not use for new code: the
 * token lives in the OS Keychain/Keystore now.
 */
export function getLegacyAuthToken(): string | null {
  return getString(KEYS.authToken);
}

/** @deprecated Use tokenStore.saveAuthToken / deleteAuthToken instead. */
export function setLegacyAuthToken(token: string | null): void {
  if (token === null) {
    storage.remove(KEYS.authToken);
  } else {
    storage.set(KEYS.authToken, token);
  }
}

export interface StoredUser {
  id: number;
  email: string;
  name: string;
  target_band_overall: number | null;
  target_band_writing: number | null;
}

export function getStoredUser(): StoredUser | null {
  return getJson<StoredUser | null>(KEYS.authUser, null);
}

export function setStoredUser(user: StoredUser | null): void {
  if (user === null) {
    storage.remove(KEYS.authUser);
  } else {
    setJson(KEYS.authUser, user);
  }
}

/* --- Settings -------------------------------------------------------- */

export function getApiBaseUrl(): string {
  return getString(KEYS.apiBaseUrl) ?? DEFAULT_API_BASE_URL;
}

export function setApiBaseUrl(url: string): void {
  storage.set(KEYS.apiBaseUrl, url.trim().replace(/\/$/, ''));
}

export function getTrack(): Track {
  return getString(KEYS.track) === 'general' ? 'general' : 'academic';
}

export function setTrack(track: Track): void {
  storage.set(KEYS.track, track);
}

export function getTargetOverall(): number | null {
  const raw = getString(KEYS.targetOverall);
  return raw === null ? null : Number(raw);
}

export function setTargetOverall(value: number | null): void {
  if (value === null) {
    storage.remove(KEYS.targetOverall);
  } else {
    storage.set(KEYS.targetOverall, String(value));
  }
}

export function getTargetWriting(): number | null {
  const raw = getString(KEYS.targetWriting);
  return raw === null ? null : Number(raw);
}

export function setTargetWriting(value: number | null): void {
  if (value === null) {
    storage.remove(KEYS.targetWriting);
  } else {
    storage.set(KEYS.targetWriting, String(value));
  }
}

/* --- Offline sync queue ---------------------------------------------- */

export interface PendingAttempt {
  /** Local id, for queue bookkeeping only. */
  localId: string;
  module: string;
  kind: 'practice' | 'mock';
  score_raw: number | null;
  band_estimate: number | null;
  duration_seconds: number | null;
  createdAt: number;
}

export function getSyncQueue(): PendingAttempt[] {
  return getJson<PendingAttempt[]>(KEYS.syncQueue, []);
}

export function setSyncQueue(queue: PendingAttempt[]): void {
  setJson(KEYS.syncQueue, queue);
}

/* --- Local vocabulary state (offline-first) -------------------------- */

export interface LocalVocabItem {
  word: string;
  meaning: string;
  example: string;
  topic: string;
  intervalDays: number;
  nextReviewMs: number;
  /** Server id once synced/seeded, null while local-only. */
  serverId: number | null;
  createdAt: number;
}

export function getLocalVocab(): LocalVocabItem[] {
  return getJson<LocalVocabItem[]>(KEYS.vocabLocal, []);
}

export function setLocalVocab(items: LocalVocabItem[]): void {
  setJson(KEYS.vocabLocal, items);
}

/* --- Speaking recordings (metadata only; audio files stay on disk) --- */

export interface StoredSpeakingRecording {
  id: string;
  setId: string;
  topic: string;
  part: string;
  filePath: string;
  durationSeconds: number;
  createdAt: number;
  fluency: {
    speechSeconds: number;
    pauseCount: number;
    longestPauseSeconds: number;
    bandLow: number;
    bandHigh: number;
    notes: string[];
  } | null;
}

export function getSpeakingRecordings(): StoredSpeakingRecording[] {
  return getJson<StoredSpeakingRecording[]>(KEYS.speakingRecordings, []);
}

export function setSpeakingRecordings(
  items: StoredSpeakingRecording[],
): void {
  setJson(KEYS.speakingRecordings, items);
}

/* --- Mock history (rotation, offline) -------------------------------- */

export interface MockHistoryEntry {
  track: Track;
  listeningTestId: string;
  readingTestId: string;
  writingTask1PromptId: string;
  writingTask2PromptId: string;
  startedAt: number;
  /** Server mock id once created online, null while local-only. */
  serverMockId: number | null;
  status: string;
}

export function getMockHistory(): MockHistoryEntry[] {
  return getJson<MockHistoryEntry[]>(KEYS.mockHistory, []);
}

export function setMockHistory(entries: MockHistoryEntry[]): void {
  setJson(KEYS.mockHistory, entries);
}

/** Wipe everything (logout + local data). */
export function clearAllStorage(): void {
  storage.clearAll();
}
