/**
 * Shared Listening / Reading practice logic.
 *
 * Both test screens run the same flow, mirroring the web backend
 * (backend/app/routers/practice.py):
 *  - start a server session on mount when online; any start failure
 *    (offline, guest, server error) falls back to a local countdown
 *    and on-device scoring — practice never crashes offline;
 *  - submit to the server when a session exists; any submit failure
 *    falls back to on-device scoring with scoreQuestions + the band
 *    table, and the attempt is queued for later sync;
 *  - a timed submit past limit + 60s grace is refused, with the
 *    backend's message, and the learner is offered a restart.
 *
 * Audio is pending real recordings: Listening parts show their
 * transcript plus the audio note, and never fake audio.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {ApiError} from '@/api/client';
import type {StartResponse, SubmitRequest, SubmitResponse} from '@/api/types';
import {
  AppTextInput,
  BandChip,
  Body,
  Caption,
  Card,
  Heading,
  OptionButton,
  Subheading,
} from '@/components/ui';
import type {
  AnswerValue,
  ContentQuestion,
  QuestionResult,
} from '@/lib/scoring';
import {scoreQuestions} from '@/lib/scoring';
import {formatDuration, isPastSubmitGrace} from '@/lib/time';
import {useSyncStore} from '@/store/syncStore';
import {spacing} from '@/theme/tokens';

export type PracticeMode = 'timed' | 'practice';

export const TFNG_OPTIONS = ['TRUE', 'FALSE', 'NOT GIVEN'] as const;

export interface PracticeOutcome {
  scoreRaw: number;
  band: number;
  results: QuestionResult[];
  source: 'server' | 'local';
  durationSeconds: number;
  queuedForSync: boolean;
}

/** Drop unanswered questions from the server submit payload. */
export function buildSubmitAnswers(
  answers: Record<string, AnswerValue>,
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (value !== null && value !== undefined && value !== '') {
      out[key] = value;
    }
  }
  return out;
}

export function answeredCount(
  questions: ContentQuestion[],
  answers: Record<string, AnswerValue>,
): number {
  return questions.filter(q => {
    const value = answers[String(q.no)];
    return value !== null && value !== undefined && value !== '';
  }).length;
}

/**
 * Render a stored answer the way the learner gave it: an mcq index
 * becomes its option text; everything else is shown as-is.
 * Returns null when the question was not answered.
 */
export function displayAnswer(
  question: ContentQuestion,
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (question.type === 'mcq' && typeof value === 'number') {
    return question.options?.[value] ?? String(value);
  }
  return String(value);
}

/* --- One question ---------------------------------------------------- */

export function QuestionField({
  question,
  value,
  onChange,
}: {
  question: ContentQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
}) {
  if (question.type === 'mcq' && question.options) {
    return (
      <View style={styles.questionBlock}>
        <Body>
          {question.no}. {question.prompt}
        </Body>
        {question.options.map((option, index) => (
          <OptionButton
            key={`${question.no}-${index}`}
            label={`${String.fromCharCode(65 + index)}. ${option}`}
            selected={value === index}
            onPress={() => onChange(index)}
            accessibilityLabel={`Question ${question.no}, option ${option}`}
          />
        ))}
      </View>
    );
  }
  if (question.type === 'tfng') {
    return (
      <View style={styles.questionBlock}>
        <Body>
          {question.no}. {question.prompt}
        </Body>
        {TFNG_OPTIONS.map(option => (
          <OptionButton
            key={`${question.no}-${option}`}
            label={option}
            selected={value === option}
            onPress={() => onChange(option)}
            accessibilityLabel={`Question ${question.no}, ${option}`}
          />
        ))}
      </View>
    );
  }
  // short / completion (and any unknown type): free text.
  return (
    <View style={styles.questionBlock}>
      <AppTextInput
        label={`${question.no}. ${question.prompt}`}
        value={typeof value === 'string' ? value : ''}
        onChangeText={text => onChange(text)}
        placeholder="Type your answer"
        autoCapitalize="none"
        autoCorrect={false}
        testID={`answer-${question.no}`}
      />
    </View>
  );
}

/* --- Results --------------------------------------------------------- */

export function ResultsView({
  outcome,
  total,
  questions,
}: {
  outcome: PracticeOutcome;
  total: number;
  questions: ContentQuestion[];
}) {
  const byNo = new Map(questions.map(q => [q.no, q]));
  return (
    <View style={styles.resultsWrap}>
      <Card testID="results-summary">
        <Heading>
          Score: {outcome.scoreRaw} / {total}
        </Heading>
        <BandChip band={outcome.band} testID="results-band" />
        <Caption>
          {outcome.source === 'server'
            ? 'Scored by the PrepSathi server.'
            : 'Scored on this device. Your attempt is queued and will sync when you are back online.'}
        </Caption>
        <Caption>Completed in {formatDuration(outcome.durationSeconds)}.</Caption>
      </Card>
      {outcome.results.map(result => {
        const question = byNo.get(result.no);
        const yourAnswer = question
          ? displayAnswer(question, result.yourAnswer)
          : result.yourAnswer === null
            ? null
            : String(result.yourAnswer);
        return (
          <Card key={result.no} testID={`result-${result.no}`}>
            <Subheading>
              Question {result.no} —{' '}
              {result.correct ? 'Correct' : 'Not correct'}
            </Subheading>
            <Body>Your answer: {yourAnswer ?? 'Not answered'}</Body>
            <Body>
              Correct answer:{' '}
              {question
                ? displayAnswer(question, result.correctAnswer) ??
                  String(result.correctAnswer)
                : String(result.correctAnswer)}
            </Body>
            <Body>{result.explanation}</Body>
            {result.evidence ? (
              <Caption>Evidence: {result.evidence}</Caption>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

/* --- Test session hook ----------------------------------------------- */

export interface PracticeSessionConfig {
  module: 'listening' | 'reading';
  testId: string;
  mode: PracticeMode;
  timeLimitSeconds: number;
  questions: ContentQuestion[];
  bandFor: (scoreRaw: number) => number;
  startSession: (
    testId: string,
    mode: PracticeMode,
  ) => Promise<StartResponse>;
  submitSession: (
    testId: string,
    payload: SubmitRequest,
  ) => Promise<SubmitResponse>;
}

export interface PracticeSession {
  answers: Record<string, AnswerValue>;
  setAnswer: (no: number, value: AnswerValue) => void;
  /** Seconds left in timed mode; null in practice mode. */
  remaining: number | null;
  timeUp: boolean;
  submitting: boolean;
  submitError: string | null;
  expired: boolean;
  outcome: PracticeOutcome | null;
  submit: () => Promise<void>;
  restart: () => void;
}

export function usePracticeSession(
  config: PracticeSessionConfig,
): PracticeSession {
  const {
    module,
    testId,
    mode,
    timeLimitSeconds,
    questions,
    bandFor,
    startSession,
    submitSession,
  } = config;
  const questionsRef = useRef(questions);
  questionsRef.current = questions;
  const bandForRef = useRef(bandFor);
  bandForRef.current = bandFor;

  const [runId, setRunId] = useState(0);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startedAtMs, setStartedAtMs] = useState(() => Date.now());
  const [remaining, setRemaining] = useState<number | null>(
    mode === 'timed' ? timeLimitSeconds : null,
  );
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [outcome, setOutcome] = useState<PracticeOutcome | null>(null);

  // Start a server session on mount (best-effort: any failure means
  // local mode with a local countdown — never a crash).
  useEffect(() => {
    if (questionsRef.current.length === 0) {
      return;
    }
    let cancelled = false;
    setSessionId(null);
    setStartedAtMs(Date.now());
    (async () => {
      try {
        const session = await startSession(testId, mode);
        if (cancelled) {
          return;
        }
        if (session.started_at) {
          const parsed = Date.parse(session.started_at);
          if (!Number.isNaN(parsed)) {
            setStartedAtMs(parsed);
          }
        }
        setSessionId(session.session_id);
      } catch {
        // Offline, guest, or server error: stay in local mode.
        if (!cancelled) {
          setSessionId(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // Re-run only on a new test, mode, or explicit restart.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, mode, runId]);

  // Local countdown from the session start (server expires_at when
  // online, otherwise the local mount time).
  useEffect(() => {
    if (mode !== 'timed') {
      setRemaining(null);
      return;
    }
    const tick = () => {
      setRemaining(
        Math.max(
          0,
          Math.floor(
            (startedAtMs + timeLimitSeconds * 1000 - Date.now()) / 1000,
          ),
        ),
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [mode, timeLimitSeconds, startedAtMs, runId]);

  const setAnswer = useCallback((no: number, value: AnswerValue) => {
    setAnswers(prev => ({...prev, [String(no)]: value}));
  }, []);

  const submit = useCallback(async () => {
    if (submitting || outcome) {
      return;
    }
    const elapsed = Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000));
    if (mode === 'timed' && isPastSubmitGrace(elapsed, timeLimitSeconds)) {
      setExpired(true);
      setSubmitError('Time expired — your answers were not scored. Start again.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const currentAnswers = {...answers};
    const currentQuestions = questionsRef.current;
    try {
      if (sessionId !== null) {
        try {
          const res = await submitSession(testId, {
            session_id: sessionId,
            answers: buildSubmitAnswers(currentAnswers),
          });
          setOutcome({
            scoreRaw: res.score_raw,
            band: res.band_estimate,
            // The API returns snake_case result fields; map them to
            // the camelCase shape on-device scoring produces.
            results: res.results.map(result => ({
              no: result.no,
              correct: result.correct,
              yourAnswer: result.your_answer,
              correctAnswer: result.correct_answer,
              explanation: result.explanation,
              evidence: result.evidence,
            })),
            source: 'server',
            durationSeconds: res.duration_seconds,
            queuedForSync: false,
          });
          return;
        } catch (err) {
          if (
            err instanceof ApiError &&
            err.status === 400 &&
            /time expired/i.test(err.detail)
          ) {
            setExpired(true);
            setSubmitError(err.detail);
            return;
          }
          // Any other server failure: score on-device instead.
        }
      }
      const {scoreRaw, results} = scoreQuestions(
        currentQuestions,
        currentAnswers,
      );
      const band = bandForRef.current(scoreRaw);
      useSyncStore.getState().enqueue({
        module,
        kind: mode === 'timed' ? 'mock' : 'practice',
        score_raw: scoreRaw,
        band_estimate: band,
        duration_seconds: elapsed,
      });
      // Best-effort sync; a failure leaves the attempt queued.
      useSyncStore
        .getState()
        .syncPending()
        .catch(() => undefined);
      setOutcome({
        scoreRaw,
        band,
        results,
        source: 'local',
        durationSeconds: elapsed,
        queuedForSync: true,
      });
    } finally {
      setSubmitting(false);
    }
  }, [submitting, outcome, startedAtMs, mode, timeLimitSeconds, sessionId, answers, testId, submitSession, module]);

  const restart = useCallback(() => {
    setAnswers({});
    setOutcome(null);
    setExpired(false);
    setSubmitError(null);
    setSessionId(null);
    setStartedAtMs(Date.now());
    setRemaining(mode === 'timed' ? timeLimitSeconds : null);
    setRunId(id => id + 1);
  }, [mode, timeLimitSeconds]);

  return {
    answers,
    setAnswer,
    remaining,
    timeUp: mode === 'timed' && remaining !== null && remaining <= 0,
    submitting,
    submitError,
    expired,
    outcome,
    submit,
    restart,
  };
}

/* --- Styles ---------------------------------------------------------- */

const styles = StyleSheet.create({
  questionBlock: {
    gap: spacing.sm,
  },
  resultsWrap: {
    gap: spacing.md,
  },
});
