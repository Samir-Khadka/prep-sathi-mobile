/**
 * Typed shapes for the PrepSathi API.
 *
 * Mirrors the web backend's Pydantic schemas
 * (backend/app/schemas.py). The mobile app talks to the same API;
 * offline practice uses the bundled content and the same scoring
 * rules in src/lib/scoring.ts, then syncs attempts when online.
 */

export interface UserOut {
  id: number;
  email: string;
  name: string;
  target_band_overall: number | null;
  target_band_writing: number | null;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface ModuleInfo {
  slug: string;
  name: string;
  time_minutes: string;
  questions: string;
  description: string;
  status: string;
}

export interface ResourceLink {
  title: string;
  url: string;
  description: string;
  provider: string;
}

export type AttemptKind = 'practice' | 'mock';

export interface AttemptCreate {
  module: string;
  kind?: AttemptKind;
  score_raw?: number | null;
  band_estimate?: number | null;
  duration_seconds?: number | null;
}

export interface AttemptOut {
  id: number;
  module: string;
  kind: string;
  score_raw: number | null;
  band_estimate: number | null;
  band_label: string | null;
  duration_seconds: number | null;
  created_at: string;
}

export interface VocabularyCreate {
  word: string;
  meaning?: string;
  topic?: string;
}

export interface VocabularyOut {
  id: number;
  word: string;
  meaning: string;
  example: string;
  topic: string;
  interval_days: number;
  next_review: string;
  created_at: string;
}

export interface DashboardOut {
  attempts_total: number;
  attempts_by_module: Record<string, number>;
  vocabulary_total: number;
  vocabulary_due: number;
  target_band_overall: number | null;
  target_band_writing: number | null;
  latest_band_by_module: Record<string, number | null>;
  overall_estimate: number | null;
  attempts_recent: AttemptOut[];
}

/* --- Practice ------------------------------------------------------- */

export interface TestPartSummary {
  part: number;
  title: string;
  question_count: number;
  has_audio: boolean;
}

export interface ListeningTestSummary {
  id: string;
  title: string;
  parts: TestPartSummary[];
  total_questions: number;
  time_limit_seconds: number;
}

export interface ListeningQuestionPublic {
  no: number;
  type: string;
  prompt: string;
  options?: string[] | null;
}

export interface ListeningPartPublic {
  part: number;
  title: string;
  setting: string;
  transcript: string;
  audio_url: string | null;
  audio_note: string;
  questions: ListeningQuestionPublic[];
}

export interface ListeningTestPublic {
  id: string;
  title: string;
  parts: ListeningPartPublic[];
}

export interface ReadingTestSummary {
  id: string;
  track: string;
  title: string;
  total_questions: number;
  time_limit_seconds: number;
}

export interface ReadingQuestionPublic {
  no: number;
  type: string;
  prompt: string;
  options?: string[] | null;
}

export interface ReadingPassagePublic {
  section: number;
  title: string;
  text: string;
  questions: ReadingQuestionPublic[];
}

export interface ReadingTestPublic {
  id: string;
  track: string;
  passages: ReadingPassagePublic[];
}

export interface StartResponse {
  session_id: number;
  started_at: string;
  time_limit_seconds: number | null;
  expires_at: string | null;
}

export interface SubmitRequest {
  session_id: number;
  answers: Record<string, string | number>;
}

export interface QuestionResult {
  no: number;
  correct: boolean;
  your_answer: string | number | null;
  correct_answer: string | number;
  explanation: string;
  evidence: string;
}

export interface SubmitResponse {
  score_raw: number;
  band_estimate: number;
  band_label: string;
  duration_seconds: number;
  overtime: boolean;
  results: QuestionResult[];
}

export interface WritingPromptSummary {
  id: string;
  track: string;
  task: number;
  title: string;
  prompt: string;
  min_words: number;
  suggested_minutes: number;
}

export interface WritingPromptFull extends WritingPromptSummary {
  model_answer: string;
  commentary: string;
}

export interface WritingCriterionFeedback {
  band_low: number;
  band_high: number;
  notes: string[];
}

export interface WritingFeedbackResponse {
  word_count: number;
  min_words: number;
  meets_minimum: boolean;
  band_low: number;
  band_high: number;
  criteria: Record<string, WritingCriterionFeedback>;
  limits: string;
  band_label: string;
}

export interface WritingSubmitResponse {
  word_count: number;
  min_words: number;
  meets_minimum: boolean;
  attempt_id: number;
}

export interface SpeakingPart2 {
  cue: string;
  points: string[];
  prep_seconds: number;
  talk_seconds: number;
}

export interface SpeakingSet {
  id: string;
  topic: string;
  part1: string[];
  part2: SpeakingPart2;
  part3: string[];
  sample_answer: string;
}

export interface SpeakingCompleteResponse {
  attempt_id: number;
}

export interface SeedResponse {
  added: number;
  skipped: number;
}

/* --- Mock sittings -------------------------------------------------- */

export interface MockStartResponse {
  mock_id: number;
  track: string;
  current_section: string;
  listening_test_id: string;
  reading_test_id: string;
  writing_task1_prompt_id: string;
  writing_task2_prompt_id: string;
  started_at: string;
  section_expires_at: string | null;
  band_label: string;
}

export interface MockSummary {
  mock_id: number;
  track: string;
  status: string;
  current_section: string;
  overall_band: number | null;
  started_at: string;
}

export interface MockScoredSection {
  status: string;
  score_raw: number | null;
  band_estimate: number | null;
}

export interface MockWritingSection {
  status: string;
  band_low: number | null;
  band_high: number | null;
}

export interface MockSpeakingSection {
  status: string;
  band_estimate: number | null;
}

export interface MockSections {
  listening: MockScoredSection;
  reading: MockScoredSection;
  writing: MockWritingSection;
  speaking: MockSpeakingSection;
}

export interface MockDetailResponse {
  mock_id: number;
  track: string;
  status: string;
  current_section: string;
  started_at: string;
  section_expires_at: string | null;
  sections: MockSections;
  overall_band: number | null;
  band_label: string;
}

export interface MockSubmitResponse extends SubmitResponse {
  next_section: string;
  section_expires_at: string | null;
}

export interface MockWritingTaskResult {
  word_count: number;
  min_words: number;
  meets_minimum: boolean;
  feedback: WritingFeedbackResponse;
}

export interface MockWritingSubmitResponse {
  task1: MockWritingTaskResult;
  task2: MockWritingTaskResult;
  writing_band_low: number;
  writing_band_high: number;
  next_section: string;
}

export interface MockSpeakingCompleteResponse {
  overall_band: number | null;
  band_label: string;
  status: string;
}

/* --- Feedback loop -------------------------------------------------- */

export const FEEDBACK_CATEGORIES = ['bug', 'content', 'feature', 'other'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export interface FeedbackCreate {
  category: FeedbackCategory;
  message: string;
  page?: string | null;
}

export interface FeedbackOut {
  id: number;
  user_id: number;
  category: string;
  message: string;
  page: string | null;
  resolved: boolean;
  created_at: string;
}
