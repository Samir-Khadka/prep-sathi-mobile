/**
 * One mock sitting in test order: Listening → Reading → Writing →
 * Speaking, no breaks, no going back to a closed section.
 *
 * Listening/Reading questions are rendered inline from the bundled
 * content (the other feature teams' screens are not imported).
 * Server-side section clocks when online (section_expires_at); local
 * countdowns offline (Listening 1920s, Reading 3600s, Writing 3600s).
 * An expired section is marked expired (Listening/Reading score 0 /
 * band 1.0; Writing no band) and the sitting continues. Writing
 * feedback comes from the server online, or from the lazy
 * src/lib/feedback.ts port offline (see writingFeedbackLocal.ts —
 * when it is absent the UI says so and no band is invented).
 * Speaking reuses the fluency range from timing inputs
 * (estimateBandRange, src/lib/fluency.ts); finishing without a range
 * leaves the overall null, mirroring the backend.
 */

import React, {useEffect, useRef, useState} from 'react';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {
  AppButton,
  AppTextInput,
  Body,
  Caption,
  Card,
  Countdown,
  EmptyState,
  ErrorText,
  Heading,
  Loading,
  OptionButton,
  Screen,
  Title,
} from '@/components/ui';
import {
  completeMockSpeaking,
  getMock,
  listMocks,
  startListening,
  startReading,
  submitMockListening,
  submitMockReading,
  submitMockWriting,
  ApiError,
} from '@/api/client';
import {
  allListeningQuestions,
  allReadingQuestions,
  getListeningTest,
  getReadingTest,
  getWritingPrompt,
} from '@/content/index';
import {
  LISTENING_TIME_LIMIT_SECONDS,
  READING_TIME_LIMIT_SECONDS,
  WRITING_TIME_LIMIT_SECONDS,
  listeningBand,
  readingBand,
  scoreQuestions,
  type AnswerValue,
  type ContentQuestion,
  type QuestionResult,
} from '@/lib/scoring';
import {estimateBandRange, SPEAKING_TARGET_SECONDS} from '@/lib/fluency';
import type {RootNavigation, RootStackParamList} from '@/navigation/types';
import {useSyncStore} from '@/store/syncStore';
import {
  getMockHistory,
  setMockHistory,
} from '@/store/storage';
import {
  buildOfflineMockPlan,
  computeMockOverall,
  deriveMockPlanFromIndex,
  loadLocalMockPlan,
  loadLocalMockResult,
  saveLocalMockPlan,
  saveLocalMockResult,
  speakingSetForMock,
  wordCount,
  SECTION_LABELS,
  SECTION_ORDER,
  type LocalMockResult,
  type MockPlan,
  type MockSectionKey,
} from './mockSession';
import {loadLocalWritingFeedback} from './writingFeedbackLocal';

function QuestionInput({
  q,
  value,
  onChange,
}: {
  q: ContentQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
}) {
  if (q.type === 'mcq' && q.options) {
    return (
      <>
        <Body>{q.prompt}</Body>
        {q.options.map((option, index) => (
          <OptionButton
            key={option}
            label={option}
            selected={value === index}
            onPress={() => onChange(index)}
            accessibilityLabel={`Question ${q.no}, option: ${option}`}
          />
        ))}
      </>
    );
  }
  if (q.type === 'tfng') {
    return (
      <>
        <Body>{q.prompt}</Body>
        {['TRUE', 'FALSE', 'NOT GIVEN'].map(option => (
          <OptionButton
            key={option}
            label={option}
            selected={value === option}
            onPress={() => onChange(option)}
            accessibilityLabel={`Question ${q.no}, answer ${option}`}
          />
        ))}
      </>
    );
  }
  return (
    <>
      <Body>{q.prompt}</Body>
      <AppTextInput
        label={`Answer to question ${q.no}`}
        value={typeof value === 'string' ? value : ''}
        onChangeText={text => onChange(text)}
        autoCapitalize="none"
        testID={`mock-q-${q.no}`}
      />
    </>
  );
}

export function MockRunnerScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'MockRunner'>>();
  const {mockId, track} = route.params;
  const enqueue = useSyncStore(s => s.enqueue);

  const [online, setOnline] = useState(mockId > 0);
  const [plan, setPlan] = useState<MockPlan | null>(() =>
    loadLocalMockPlan(mockId),
  );
  const [sectionIdx, setSectionIdx] = useState(0);
  const [serverExpiresAt, setServerExpiresAt] = useState<string | null>(null);
  const [localDeadlineMs, setLocalDeadlineMs] = useState<number | null>(null);
  const [sectionStartMs, setSectionStartMs] = useState<number>(Date.now());
  const [remaining, setRemaining] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionAttempted, setSessionAttempted] = useState('');
  const [task1Text, setTask1Text] = useState('');
  const [task2Text, setTask2Text] = useState('');
  const [speechSeconds, setSpeechSeconds] = useState('');
  const [pauseCount, setPauseCount] = useState('');
  const [longestPause, setLongestPause] = useState('');
  const [result, setResult] = useState<LocalMockResult>(() => {
    const stored = loadLocalMockResult(mockId);
    return (
      stored ?? {
        mockId,
        track,
        startedAt: Date.now(),
        overall: null,
        status: 'in_progress',
      }
    );
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedbackNote, setFeedbackNote] = useState('');
  const [loading, setLoading] = useState(true);
  const expiredForRef = useRef('');
  const speakingSet = useRef(
    speakingSetForMock(getMockHistory().filter(h => h.track === track).length),
  );

  const section = SECTION_ORDER[sectionIdx] as MockSectionKey;

  /* --- Load the plan + current section ------------------------------ */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let nextPlan = loadLocalMockPlan(mockId);
      let startSection = 0;
      let expires: string | null = null;
      if (mockId > 0) {
        try {
          const detail = await getMock(mockId);
          const order: Record<string, number> = {
            listening: 0,
            reading: 1,
            writing: 2,
            speaking: 3,
            done: 3,
          };
          startSection = order[detail.current_section] ?? 0;
          expires = detail.section_expires_at;
          if (!nextPlan) {
            const mocks = await listMocks();
            const sameTrack = [...mocks]
              .filter(m => m.track === track)
              .sort(
                (a, b) =>
                  Date.parse(a.started_at) - Date.parse(b.started_at) ||
                  a.mock_id - b.mock_id,
              );
            const index = sameTrack.findIndex(m => m.mock_id === mockId);
            if (index >= 0) {
              nextPlan = deriveMockPlanFromIndex(track, index);
              saveLocalMockPlan(mockId, nextPlan);
            }
          }
          if (!cancelled) {
            setResult(prev => ({
              ...prev,
              listening:
                detail.sections.listening.band_estimate !== null
                  ? {
                      scoreRaw: detail.sections.listening.score_raw ?? 0,
                      band: detail.sections.listening.band_estimate,
                      expired: detail.sections.listening.status === 'expired',
                      durationSeconds: 0,
                      results: [],
                    }
                  : prev.listening,
              reading:
                detail.sections.reading.band_estimate !== null
                  ? {
                      scoreRaw: detail.sections.reading.score_raw ?? 0,
                      band: detail.sections.reading.band_estimate,
                      expired: detail.sections.reading.status === 'expired',
                      durationSeconds: 0,
                      results: [],
                    }
                  : prev.reading,
              writing:
                detail.sections.writing.band_low !== null &&
                detail.sections.writing.band_high !== null
                  ? {
                      task1Words: 0,
                      task2Words: 0,
                      bandLow: detail.sections.writing.band_low,
                      bandHigh: detail.sections.writing.band_high,
                      expired: false,
                      feedbackAvailable: true,
                    }
                  : detail.sections.writing.status === 'expired'
                    ? {
                        task1Words: 0,
                        task2Words: 0,
                        bandLow: null,
                        bandHigh: null,
                        expired: true,
                        feedbackAvailable: false,
                      }
                    : prev.writing,
              speaking:
                detail.sections.speaking.band_estimate !== null
                  ? {
                      setId: '',
                      bandLow: null,
                      bandHigh: null,
                      band: detail.sections.speaking.band_estimate,
                      durationSeconds: null,
                    }
                  : prev.speaking,
            }));
          }
        } catch (err) {
          if (err instanceof TypeError && !cancelled) {
            setOnline(false);
          }
        }
      }
      if (!nextPlan) {
        nextPlan = buildOfflineMockPlan(track, getMockHistory());
        saveLocalMockPlan(mockId, nextPlan);
      }
      if (!cancelled) {
        setPlan(nextPlan);
        setSectionIdx(startSection);
        setServerExpiresAt(expires);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --- Section clock: server expiry wins, else a local deadline ----- */
  const sectionLimit =
    section === 'listening'
      ? LISTENING_TIME_LIMIT_SECONDS
      : section === 'reading'
        ? READING_TIME_LIMIT_SECONDS
        : section === 'writing'
          ? WRITING_TIME_LIMIT_SECONDS
          : null;
  const serverExpiresMs =
    online && serverExpiresAt ? Date.parse(serverExpiresAt) : NaN;
  const deadlineMs = Number.isFinite(serverExpiresMs)
    ? serverExpiresMs
    : localDeadlineMs;

  useEffect(() => {
    setSectionStartMs(Date.now());
    setSessionId(null);
    setSessionAttempted('');
    setAnswers({});
    expiredForRef.current = '';
    if (sectionLimit !== null) {
      setLocalDeadlineMs(Date.now() + sectionLimit * 1000);
      setRemaining(sectionLimit);
    } else {
      setLocalDeadlineMs(null);
      setRemaining(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIdx, plan === null]);

  useEffect(() => {
    if (deadlineMs === null || section === 'speaking') {
      return;
    }
    const tick = () => {
      const rem = Math.max(0, Math.floor((deadlineMs - Date.now()) / 1000));
      setRemaining(rem);
      if (rem <= 0 && expiredForRef.current !== `${sectionIdx}`) {
        expiredForRef.current = `${sectionIdx}`;
        void handleExpire(section);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineMs, sectionIdx]);

  /* --- Practice session for online scored submits ------------------- */
  useEffect(() => {
    if (!online || !plan || sessionAttempted !== '' || sessionId !== null) {
      return;
    }
    if (section !== 'listening' && section !== 'reading') {
      return;
    }
    const testId =
      section === 'listening' ? plan.listeningTestId : plan.readingTestId;
    const key = `${section}:${testId}`;
    setSessionAttempted(key);
    const start =
      section === 'listening' ? startListening : startReading;
    start(testId, 'timed')
      .then(res => setSessionId(res.session_id))
      .catch(err => {
        if (err instanceof TypeError) {
          setOnline(false);
        }
        // No session: submits fall back to local scoring.
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIdx, plan, online]);

  function persist(next: LocalMockResult) {
    setResult(next);
    saveLocalMockResult(next);
  }

  function advance(next: LocalMockResult) {
    persist(next);
    setServerExpiresAt(null);
    setSectionIdx(i => Math.min(i + 1, SECTION_ORDER.length - 1));
  }

  async function handleExpire(expiredSection: MockSectionKey) {
    setError(
      `${SECTION_LABELS[expiredSection]} ran out of time — the section is marked expired and the mock moves on.`,
    );
    if (expiredSection === 'listening' || expiredSection === 'reading') {
      const next: LocalMockResult = {
        ...result,
        [expiredSection]: {
          scoreRaw: 0,
          band: 1.0,
          expired: true,
          durationSeconds:
            expiredSection === 'listening'
              ? LISTENING_TIME_LIMIT_SECONDS
              : READING_TIME_LIMIT_SECONDS,
          results: [],
        },
      };
      advance(next);
    } else if (expiredSection === 'writing') {
      const next: LocalMockResult = {
        ...result,
        writing: {
          task1Words: wordCount(task1Text),
          task2Words: wordCount(task2Text),
          bandLow: null,
          bandHigh: null,
          expired: true,
          feedbackAvailable: false,
        },
      };
      advance(next);
    }
  }

  function cleanAnswers(): Record<string, string | number> {
    const out: Record<string, string | number> = {};
    for (const [key, value] of Object.entries(answers)) {
      if (value !== null && value !== undefined) {
        out[key] = value;
      }
    }
    return out;
  }

  async function submitScored(kind: 'listening' | 'reading') {
    if (!plan) {
      return;
    }
    setError('');
    setBusy(true);
    const duration = Math.max(
      0,
      Math.floor((Date.now() - sectionStartMs) / 1000),
    );
    const listeningTest = getListeningTest(plan.listeningTestId);
    const readingTest = getReadingTest(plan.readingTestId);
    const test = kind === 'listening' ? listeningTest : readingTest;
    if (!test) {
      setError('That test could not be loaded from the bundled content.');
      setBusy(false);
      return;
    }
    const questions =
      kind === 'listening' && listeningTest
        ? allListeningQuestions(listeningTest)
        : readingTest
          ? allReadingQuestions(readingTest)
          : [];
    const local = scoreQuestions(questions, answers);
    const localBand =
      kind === 'listening'
        ? listeningBand(local.scoreRaw)
        : readingBand(track, local.scoreRaw);

    if (online && sessionId !== null) {
      try {
        const submit =
          kind === 'listening' ? submitMockListening : submitMockReading;
        const res = await submit(mockId, {
          session_id: sessionId,
          answers: cleanAnswers(),
        });
        const mapped: QuestionResult[] = (res.results ?? []).map(r => ({
          no: r.no,
          correct: r.correct,
          yourAnswer: r.your_answer ?? null,
          correctAnswer: r.correct_answer,
          explanation: r.explanation,
          evidence: r.evidence,
        }));
        const next: LocalMockResult = {
          ...result,
          [kind]: {
            scoreRaw: res.score_raw,
            band: res.band_estimate,
            expired: res.overtime,
            durationSeconds: res.duration_seconds,
            results: mapped,
          },
        };
        setServerExpiresAt(res.section_expires_at);
        advance(next);
        return;
      } catch (err) {
        if (err instanceof TypeError) {
          setOnline(false);
          setError(
            'Connection lost — continuing this mock offline. Your answers are scored on this phone.',
          );
        } else if (err instanceof ApiError) {
          setError(err.detail);
          setBusy(false);
          return;
        } else {
          setError('Could not submit that section.');
          setBusy(false);
          return;
        }
      }
    }
    // Local path (offline, or no practice session): score on-device.
    enqueue({
      module: kind,
      kind: 'mock',
      score_raw: local.scoreRaw,
      band_estimate: localBand,
      duration_seconds: duration,
    });
    advance({
      ...result,
      [kind]: {
        scoreRaw: local.scoreRaw,
        band: localBand,
        expired: false,
        durationSeconds: duration,
        results: local.results,
      },
    });
    setBusy(false);
  }

  async function submitWriting() {
    if (!plan) {
      return;
    }
    const prompt1 = getWritingPrompt(plan.writingTask1PromptId);
    const prompt2 = getWritingPrompt(plan.writingTask2PromptId);
    if (!prompt1 || !prompt2) {
      setError('The Writing prompts could not be loaded.');
      return;
    }
    setError('');
    setFeedbackNote('');
    setBusy(true);
    const duration = Math.max(
      0,
      Math.floor((Date.now() - sectionStartMs) / 1000),
    );
    const t1Words = wordCount(task1Text);
    const t2Words = wordCount(task2Text);

    if (online) {
      try {
        const res = await submitMockWriting(mockId, {
          task1_text: task1Text,
          task2_text: task2Text,
          duration_seconds: duration,
        });
        const next: LocalMockResult = {
          ...result,
          writing: {
            task1Words: t1Words,
            task2Words: t2Words,
            bandLow: res.writing_band_low,
            bandHigh: res.writing_band_high,
            expired: false,
            feedbackAvailable: true,
          },
        };
        advance(next);
        return;
      } catch (err) {
        if (err instanceof TypeError) {
          setOnline(false);
          setError(
            'Connection lost — continuing this mock offline. Writing feedback may be unavailable offline.',
          );
        } else if (err instanceof ApiError) {
          if (/expired/i.test(err.detail)) {
            advance({
              ...result,
              writing: {
                task1Words: t1Words,
                task2Words: t2Words,
                bandLow: null,
                bandHigh: null,
                expired: true,
                feedbackAvailable: false,
              },
            });
            return;
          }
          setError(err.detail);
          setBusy(false);
          return;
        } else {
          setError('Could not submit Writing.');
          setBusy(false);
          return;
        }
      }
    }
    // Local path: lazy Writing feedback port, with an honest fallback.
    const [f1, f2] = await Promise.all([
      loadLocalWritingFeedback(prompt1, task1Text),
      loadLocalWritingFeedback(prompt2, task2Text),
    ]);
    if (f1 && f2) {
      const bandLow = (f1.band_low + f2.band_low) / 2;
      const bandHigh = (f1.band_high + f2.band_high) / 2;
      enqueue({
        module: 'writing',
        kind: 'mock',
        score_raw: null,
        band_estimate: (bandLow + bandHigh) / 2,
        duration_seconds: duration,
      });
      advance({
        ...result,
        writing: {
          task1Words: t1Words,
          task2Words: t2Words,
          bandLow,
          bandHigh,
          expired: false,
          feedbackAvailable: true,
        },
      });
    } else {
      setFeedbackNote(
        'Detailed Writing feedback is not available offline on this build yet — your word counts are recorded, but Writing has no band range, so this mock has no overall band.',
      );
      advance({
        ...result,
        writing: {
          task1Words: t1Words,
          task2Words: t2Words,
          bandLow: null,
          bandHigh: null,
          expired: false,
          feedbackAvailable: false,
        },
      });
    }
    setBusy(false);
  }

  function finishMock(final: LocalMockResult) {
    const overall = computeMockOverall({
      listeningBand: final.listening?.band ?? null,
      readingBand: final.reading?.band ?? null,
      writingMidpoint:
        final.writing?.bandLow !== null &&
        final.writing?.bandLow !== undefined &&
        final.writing?.bandHigh !== null &&
        final.writing?.bandHigh !== undefined
          ? (final.writing.bandLow + final.writing.bandHigh) / 2
          : null,
      speakingMidpoint: final.speaking?.band ?? null,
    });
    const finalResult: LocalMockResult = {
      ...final,
      overall,
      status: 'complete',
    };
    persist(finalResult);
    if (mockId < 0) {
      const history = getMockHistory();
      const idx = [...history]
        .reverse()
        .findIndex(
          h =>
            h.status === 'in_progress' &&
            h.listeningTestId === plan?.listeningTestId &&
            h.readingTestId === plan?.readingTestId,
        );
      if (idx >= 0) {
        const realIdx = history.length - 1 - idx;
        const next = [...history];
        next[realIdx] = {...next[realIdx], status: 'complete'};
        setMockHistory(next);
      }
    }
    navigation.replace('MockResults', {mockId});
  }

  async function completeSpeaking(withBand: boolean) {
    setError('');
    setBusy(true);
    const set = speakingSet.current;
    const speech = Number(speechSeconds);
    const pauses = Number(pauseCount);
    const longest = Number(longestPause);
    const range =
      withBand &&
      Number.isFinite(speech) &&
      speech > 0 &&
      Number.isFinite(pauses) &&
      Number.isFinite(longest)
        ? estimateBandRange(
            speech,
            SPEAKING_TARGET_SECONDS,
            Math.max(0, Math.floor(pauses)),
            Math.max(0, longest),
          )
        : null;
    if (withBand && !range) {
      setError(
        'Enter how long you spoke (seconds), how many pauses over 0.7s, and your longest pause — or finish without a Speaking band.',
      );
      setBusy(false);
      return;
    }
    const bandMid =
      range !== null ? (range.bandLow + range.bandHigh) / 2 : null;
    const next: LocalMockResult = {
      ...result,
      speaking: {
        setId: set.id,
        bandLow: range?.bandLow ?? null,
        bandHigh: range?.bandHigh ?? null,
        band: bandMid,
        durationSeconds: Number.isFinite(speech) ? speech : null,
      },
    };
    if (online) {
      try {
        await completeMockSpeaking(mockId, {
          set_id: set.id,
          duration_seconds: Number.isFinite(speech) ? speech : null,
          band_low: range?.bandLow ?? null,
          band_high: range?.bandHigh ?? null,
        });
        finishMock(next);
        return;
      } catch (err) {
        if (err instanceof TypeError) {
          setOnline(false);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : 'Could not complete Speaking.',
          );
          setBusy(false);
          return;
        }
      }
    }
    enqueue({
      module: 'speaking',
      kind: 'mock',
      score_raw: null,
      band_estimate: bandMid,
      duration_seconds: Number.isFinite(speech) ? speech : null,
    });
    setBusy(false);
    finishMock(next);
  }

  if (loading || !plan) {
    return (
      <Screen>
        <Loading label="Preparing your mock…" />
      </Screen>
    );
  }

  const listeningTest = getListeningTest(plan.listeningTestId);
  const readingTest = getReadingTest(plan.readingTestId);
  const prompt1 = getWritingPrompt(plan.writingTask1PromptId);
  const prompt2 = getWritingPrompt(plan.writingTask2PromptId);
  const set = speakingSet.current;
  const speechNum = Number(speechSeconds);
  const pauseNum = Number(pauseCount);
  const longestNum = Number(longestPause);
  const liveRange =
    Number.isFinite(speechNum) &&
    speechNum > 0 &&
    Number.isFinite(pauseNum) &&
    Number.isFinite(longestNum)
      ? estimateBandRange(
          speechNum,
          SPEAKING_TARGET_SECONDS,
          Math.max(0, Math.floor(pauseNum)),
          Math.max(0, longestNum),
        )
      : null;

  return (
    <Screen>
      <Title>
        Full mock — {track === 'academic' ? 'Academic' : 'General Training'}
      </Title>
      <Body>
        {SECTION_ORDER.map((key, i) => {
          const done =
            key === 'listening'
              ? result.listening !== undefined
              : key === 'reading'
                ? result.reading !== undefined
                : key === 'writing'
                  ? result.writing !== undefined
                  : result.speaking !== undefined;
          const expired =
            (key === 'listening' && result.listening?.expired) ||
            (key === 'reading' && result.reading?.expired) ||
            (key === 'writing' && result.writing?.expired);
          return `${i === sectionIdx ? '▶ ' : ''}${SECTION_LABELS[key]}${done ? (expired ? ' (expired)' : ' ✓') : ''}`;
        }).join('  ·  ')}
      </Body>
      {remaining !== null ? (
        <Countdown seconds={remaining} testID="mock-countdown" />
      ) : null}
      {!online ? (
        <Caption>
          Offline — this sitting is scored on your phone and will sync when
          you sign in and connect.
        </Caption>
      ) : null}
      <ErrorText message={error} />
      {feedbackNote ? <Body>{feedbackNote}</Body> : null}

      {section === 'listening' && listeningTest ? (
        <>
          <Heading>
            Listening — {listeningTest.title} (32 minutes)
          </Heading>
          <Caption>
            Audio is not bundled yet — read each transcript and answer the
            questions.
          </Caption>
          {listeningTest.parts.map(part => (
            <Card key={part.part}>
              <Heading>
                Part {part.part}: {part.title}
              </Heading>
              <Caption>{part.setting}</Caption>
              <Body>{part.transcript}</Body>
              {part.questions.map(q => (
                <QuestionInput
                  key={q.no}
                  q={q}
                  value={answers[String(q.no)] ?? null}
                  onChange={value =>
                    setAnswers(prev => ({...prev, [String(q.no)]: value}))
                  }
                />
              ))}
            </Card>
          ))}
          <AppButton
            title={busy ? 'Submitting…' : 'Submit Listening'}
            onPress={() => void submitScored('listening')}
            disabled={busy}
            accessibilityLabel="Submit Listening section"
          />
        </>
      ) : null}

      {section === 'reading' && readingTest ? (
        <>
          <Heading>Reading — {readingTest.title} (60 minutes)</Heading>
          {readingTest.passages.map(passage => (
            <Card key={passage.section}>
              <Heading>
                Section {passage.section}: {passage.title}
              </Heading>
              <Body>{passage.text}</Body>
              {passage.questions.map(q => (
                <QuestionInput
                  key={q.no}
                  q={q}
                  value={answers[String(q.no)] ?? null}
                  onChange={value =>
                    setAnswers(prev => ({...prev, [String(q.no)]: value}))
                  }
                />
              ))}
            </Card>
          ))}
          <AppButton
            title={busy ? 'Submitting…' : 'Submit Reading'}
            onPress={() => void submitScored('reading')}
            disabled={busy}
            accessibilityLabel="Submit Reading section"
          />
        </>
      ) : null}

      {section === 'writing' && prompt1 && prompt2 ? (
        <>
          <Heading>Writing — 60 minutes, both tasks</Heading>
          <Card>
            <Heading>Task 1 — {prompt1.title}</Heading>
            <Body>{prompt1.prompt}</Body>
            <Caption>
              At least {prompt1.min_words} words · about{' '}
              {prompt1.suggested_minutes} minutes
            </Caption>
            <AppTextInput
              label={`Task 1 answer (${wordCount(task1Text)} words)`}
              value={task1Text}
              onChangeText={setTask1Text}
              multiline
              testID="mock-writing-task1"
            />
          </Card>
          <Card>
            <Heading>Task 2 — {prompt2.title}</Heading>
            <Body>{prompt2.prompt}</Body>
            <Caption>
              At least {prompt2.min_words} words · about{' '}
              {prompt2.suggested_minutes} minutes
            </Caption>
            <AppTextInput
              label={`Task 2 answer (${wordCount(task2Text)} words)`}
              value={task2Text}
              onChangeText={setTask2Text}
              multiline
              testID="mock-writing-task2"
            />
          </Card>
          <AppButton
            title={busy ? 'Submitting…' : 'Submit Writing'}
            onPress={() => void submitWriting()}
            disabled={busy}
            accessibilityLabel="Submit Writing section"
          />
        </>
      ) : null}

      {section === 'speaking' ? (
        <>
          <Heading>Speaking — {set.topic}</Heading>
          <Body>
            Talk through this set, then enter your timing below. The band
            range comes from timing signals only — it cannot judge
            pronunciation, vocabulary, or ideas.
          </Body>
          <Card>
            <Heading>Part 1</Heading>
            {set.part1.map((question, i) => (
              <Body key={i}>• {question}</Body>
            ))}
          </Card>
          <Card>
            <Heading>Part 2 — cue card</Heading>
            <Body>{set.part2.cue}</Body>
            {set.part2.points.map((point, i) => (
              <Body key={i}>• {point}</Body>
            ))}
            <Caption>
              {set.part2.prep_seconds}s to prepare · {set.part2.talk_seconds}
              s to talk
            </Caption>
          </Card>
          <Card>
            <Heading>Part 3</Heading>
            {set.part3.map((question, i) => (
              <Body key={i}>• {question}</Body>
            ))}
          </Card>
          <Card>
            <Heading>Your timing</Heading>
            <AppTextInput
              label="Seconds you spoke (target 120)"
              value={speechSeconds}
              onChangeText={setSpeechSeconds}
              keyboardType="decimal-pad"
              testID="mock-speaking-seconds"
            />
            <AppTextInput
              label="Pauses over 0.7 seconds"
              value={pauseCount}
              onChangeText={setPauseCount}
              keyboardType="number-pad"
              testID="mock-speaking-pauses"
            />
            <AppTextInput
              label="Longest pause (seconds)"
              value={longestPause}
              onChangeText={setLongestPause}
              keyboardType="decimal-pad"
              testID="mock-speaking-longest-pause"
            />
            {liveRange ? (
              <Body>
                Estimated range: Band {liveRange.bandLow.toFixed(1)}–
                {liveRange.bandHigh.toFixed(1)} — practice estimate, not an
                official score
              </Body>
            ) : null}
          </Card>
          <AppButton
            title={busy ? 'Please wait…' : 'Complete Speaking with this range'}
            onPress={() => void completeSpeaking(true)}
            disabled={busy}
            accessibilityLabel="Complete Speaking with this fluency range"
          />
          <AppButton
            title="Finish without a Speaking band"
            variant="secondary"
            onPress={() => void completeSpeaking(false)}
            disabled={busy}
            accessibilityLabel="Finish the mock without a Speaking band"
          />
          <Caption>
            Without a Speaking band there is no overall band for this mock
            — the same as the real test rule.
          </Caption>
        </>
      ) : null}

      {(section === 'listening' && !listeningTest) ||
      (section === 'reading' && !readingTest) ||
      (section === 'writing' && (!prompt1 || !prompt2)) ? (
        <EmptyState message="That section's content could not be loaded from the bundled content." />
      ) : null}
    </Screen>
  );
}
