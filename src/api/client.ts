/**
 * Typed HTTP client for the PrepSathi API.
 *
 * Base URL and auth token come from MMKV (see src/store/storage.ts),
 * never from code. The default base URL is the Render API the web app
 * uses; the learner can change it in Settings. Every call throws
 * ApiError on a non-2xx response and TypeError on a network failure
 * (offline) — callers treat TypeError as "offline, use local data".
 */

import {getApiBaseUrl, getAuthToken} from '../store/storage';
import type {
  AttemptCreate,
  AttemptOut,
  DashboardOut,
  FeedbackCreate,
  FeedbackOut,
  ListeningTestPublic,
  ListeningTestSummary,
  MockDetailResponse,
  MockStartResponse,
  MockSubmitResponse,
  MockSummary,
  MockSpeakingCompleteResponse,
  MockWritingSubmitResponse,
  ModuleInfo,
  ReadingTestPublic,
  ReadingTestSummary,
  ResourceLink,
  SeedResponse,
  SpeakingCompleteResponse,
  SpeakingSet,
  StartResponse,
  SubmitRequest,
  SubmitResponse,
  TokenResponse,
  UserOut,
  VocabularyCreate,
  VocabularyOut,
  WritingFeedbackResponse,
  WritingPromptFull,
  WritingPromptSummary,
  WritingSubmitResponse,
} from './types';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

function baseUrl(): string {
  return getApiBaseUrl().replace(/\/$/, '');
}

/**
 * API base URL (no trailing slash), for resolving relative asset
 * URLs such as Listening `audio_url` (`/static/audio/...`).
 */
export function apiBaseUrl(): string {
  return baseUrl();
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (options.auth !== false) {
    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }
  const res = await fetch(`${baseUrl()}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const detail =
      (data as {detail?: string} | null)?.detail ??
      `Request failed (${res.status})`;
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export async function health(): Promise<{status: string; version: string}> {
  return request('/api/health', {auth: false});
}

/* --- Auth ------------------------------------------------------------ */

export async function signup(input: {
  email: string;
  password: string;
  name?: string;
  target_band_overall?: number | null;
  target_band_writing?: number | null;
}): Promise<TokenResponse> {
  return request<TokenResponse>('/api/auth/signup', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<TokenResponse> {
  return request<TokenResponse>('/api/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export async function fetchMe(): Promise<UserOut> {
  return request<UserOut>('/api/auth/me');
}

/* --- Catalogue ------------------------------------------------------- */

export async function listModules(): Promise<ModuleInfo[]> {
  return request<ModuleInfo[]>('/api/modules', {auth: false});
}

export async function listResources(): Promise<ResourceLink[]> {
  return request<ResourceLink[]>('/api/resources', {auth: false});
}

export async function fetchDashboard(): Promise<DashboardOut> {
  return request<DashboardOut>('/api/dashboard');
}

export async function listAttempts(): Promise<AttemptOut[]> {
  return request<AttemptOut[]>('/api/attempts');
}

export async function recordAttempt(
  payload: AttemptCreate,
): Promise<AttemptOut> {
  return request<AttemptOut>('/api/attempts', {
    method: 'POST',
    body: payload,
  });
}

/* --- Vocabulary ------------------------------------------------------ */

export async function listVocabulary(): Promise<VocabularyOut[]> {
  return request<VocabularyOut[]>('/api/vocabulary');
}

export async function listVocabularyDue(): Promise<VocabularyOut[]> {
  return request<VocabularyOut[]>('/api/vocabulary/due');
}

export async function seedVocabulary(): Promise<SeedResponse> {
  return request<SeedResponse>('/api/vocabulary/seed', {method: 'POST'});
}

export async function reviewVocabulary(
  itemId: number,
  correct: boolean,
): Promise<VocabularyOut> {
  return request<VocabularyOut>(`/api/vocabulary/${itemId}/review`, {
    method: 'POST',
    body: {correct},
  });
}

export async function addVocabulary(
  payload: VocabularyCreate,
): Promise<VocabularyOut> {
  return request<VocabularyOut>('/api/vocabulary', {
    method: 'POST',
    body: payload,
  });
}

export async function deleteVocabulary(itemId: number): Promise<void> {
  return request<void>(`/api/vocabulary/${itemId}`, {method: 'DELETE'});
}

/* --- Practice -------------------------------------------------------- */

export async function listListening(): Promise<ListeningTestSummary[]> {
  return request<ListeningTestSummary[]>('/api/practice/listening');
}

export async function getListening(
  testId: string,
): Promise<ListeningTestPublic> {
  return request<ListeningTestPublic>(`/api/practice/listening/${testId}`);
}

export async function startListening(
  testId: string,
  mode: 'timed' | 'practice',
): Promise<StartResponse> {
  return request<StartResponse>(`/api/practice/listening/${testId}/start`, {
    method: 'POST',
    body: {mode},
  });
}

export async function submitListening(
  testId: string,
  payload: SubmitRequest,
): Promise<SubmitResponse> {
  return request<SubmitResponse>(`/api/practice/listening/${testId}/submit`, {
    method: 'POST',
    body: payload,
  });
}

export async function listReading(
  track: string,
): Promise<ReadingTestSummary[]> {
  return request<ReadingTestSummary[]>(
    `/api/practice/reading?track=${track}`,
  );
}

export async function getReading(testId: string): Promise<ReadingTestPublic> {
  return request<ReadingTestPublic>(`/api/practice/reading/${testId}`);
}

export async function startReading(
  testId: string,
  mode: 'timed' | 'practice',
): Promise<StartResponse> {
  return request<StartResponse>(`/api/practice/reading/${testId}/start`, {
    method: 'POST',
    body: {mode},
  });
}

export async function submitReading(
  testId: string,
  payload: SubmitRequest,
): Promise<SubmitResponse> {
  return request<SubmitResponse>(`/api/practice/reading/${testId}/submit`, {
    method: 'POST',
    body: payload,
  });
}

export async function listWriting(
  track: string,
): Promise<WritingPromptSummary[]> {
  return request<WritingPromptSummary[]>(
    `/api/practice/writing?track=${track}`,
  );
}

export async function getWriting(promptId: string): Promise<WritingPromptFull> {
  return request<WritingPromptFull>(`/api/practice/writing/${promptId}`);
}

export async function submitWriting(input: {
  prompt_id: string;
  text: string;
  duration_seconds?: number | null;
}): Promise<WritingSubmitResponse> {
  return request<WritingSubmitResponse>('/api/practice/writing/submit', {
    method: 'POST',
    body: input,
  });
}

export async function writingFeedback(input: {
  prompt_id: string;
  text: string;
}): Promise<WritingFeedbackResponse> {
  return request<WritingFeedbackResponse>('/api/practice/writing/feedback', {
    method: 'POST',
    body: input,
  });
}

export async function listSpeaking(): Promise<SpeakingSet[]> {
  return request<SpeakingSet[]>('/api/practice/speaking');
}

export async function completeSpeaking(input: {
  set_id: string;
  duration_seconds?: number | null;
}): Promise<SpeakingCompleteResponse> {
  return request<SpeakingCompleteResponse>('/api/practice/speaking/complete', {
    method: 'POST',
    body: input,
  });
}

/* --- Mock sittings --------------------------------------------------- */

export async function startMock(track: string): Promise<MockStartResponse> {
  return request<MockStartResponse>('/api/mock/start', {
    method: 'POST',
    body: {track},
  });
}

export async function listMocks(): Promise<MockSummary[]> {
  return request<MockSummary[]>('/api/mock');
}

export async function getMock(mockId: number): Promise<MockDetailResponse> {
  return request<MockDetailResponse>(`/api/mock/${mockId}`);
}

export async function submitMockListening(
  mockId: number,
  payload: SubmitRequest,
): Promise<MockSubmitResponse> {
  return request<MockSubmitResponse>(`/api/mock/${mockId}/listening/submit`, {
    method: 'POST',
    body: payload,
  });
}

export async function submitMockReading(
  mockId: number,
  payload: SubmitRequest,
): Promise<MockSubmitResponse> {
  return request<MockSubmitResponse>(`/api/mock/${mockId}/reading/submit`, {
    method: 'POST',
    body: payload,
  });
}

export async function submitMockWriting(
  mockId: number,
  payload: {
    task1_text: string;
    task2_text: string;
    duration_seconds?: number | null;
  },
): Promise<MockWritingSubmitResponse> {
  return request<MockWritingSubmitResponse>(
    `/api/mock/${mockId}/writing/submit`,
    {method: 'POST', body: payload},
  );
}

export async function completeMockSpeaking(
  mockId: number,
  payload: {
    set_id: string;
    duration_seconds?: number | null;
    band_low?: number | null;
    band_high?: number | null;
  },
): Promise<MockSpeakingCompleteResponse> {
  return request<MockSpeakingCompleteResponse>(
    `/api/mock/${mockId}/speaking/complete`,
    {method: 'POST', body: payload},
  );
}

/* --- Feedback loop --------------------------------------------------- */

export async function submitFeedback(
  payload: FeedbackCreate,
): Promise<FeedbackOut> {
  return request<FeedbackOut>('/api/feedback', {
    method: 'POST',
    body: payload,
  });
}

export async function listOwnFeedback(): Promise<FeedbackOut[]> {
  return request<FeedbackOut[]>('/api/feedback');
}
