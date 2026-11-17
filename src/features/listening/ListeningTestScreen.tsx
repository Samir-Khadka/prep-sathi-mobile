/**
 * Listening test: 4 parts in order, each with its setting and
 * transcript, then its questions.
 *
 * A part with a real recording (`audio_url` set) renders the audio
 * player (offline-first download + play); a part without one shows
 * the "Audio coming soon" note and no audio is faked. The transcript
 * is always shown, so practice never depends on the recording.
 *
 * Timed mode counts down from the server session's expiry when
 * online, otherwise from a local 32:00 clock. Submit goes to the
 * server when a session exists; any failure scores on-device and
 * queues the attempt for later sync. A timed submit past the
 * limit + 60s grace is refused, mirroring the backend rule.
 */

import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {apiBaseUrl, startListening, submitListening} from '@/api/client';
import {
  allListeningQuestions,
  getListeningTest,
} from '@/content';
import {
  AppButton,
  Body,
  Caption,
  Card,
  Countdown,
  EmptyState,
  ErrorText,
  Screen,
  SectionHeader,
  Subheading,
  Title,
} from '@/components/ui';
import {
  LISTENING_TIME_LIMIT_SECONDS,
  listeningBand,
} from '@/lib/scoring';
import {formatDuration} from '@/lib/time';
import type {RootNavigation, RootStackParamList} from '@/navigation/types';
import {spacing} from '@/theme/tokens';
import {resolveAudioUrl} from './audioCache';
import {ListeningAudioPlayer} from './ListeningAudioPlayer';
import {
  QuestionField,
  ResultsView,
  answeredCount,
  usePracticeSession,
} from './practice';

type ListeningTestRoute = RouteProp<RootStackParamList, 'ListeningTest'>;

export function ListeningTestScreen() {
  const route = useRoute<ListeningTestRoute>();
  const navigation = useNavigation<RootNavigation>();
  const {testId, mode} = route.params;
  const test = getListeningTest(testId);
  const questions = useMemo(
    () => (test ? allListeningQuestions(test) : []),
    [test],
  );
  const session = usePracticeSession({
    module: 'listening',
    testId,
    mode,
    timeLimitSeconds: LISTENING_TIME_LIMIT_SECONDS,
    questions,
    bandFor: listeningBand,
    startSession: startListening,
    submitSession: submitListening,
  });

  if (!test) {
    return (
      <Screen testID="listening-test-missing">
        <Title>Listening test</Title>
        <EmptyState message="That test could not be found." />
        <AppButton
          title="Back to Listening tests"
          onPress={() => navigation.navigate('ListeningList')}
        />
      </Screen>
    );
  }

  if (session.outcome) {
    return (
      <Screen testID="listening-test-results">
        <Title>{test.title} — Results</Title>
        <ResultsView
          outcome={session.outcome}
          total={questions.length}
          questions={questions}
        />
        <AppButton
          title="Retake this test"
          variant="secondary"
          onPress={session.restart}
          accessibilityLabel={`Retake ${test.title}`}
          testID="retake-test"
        />
        <AppButton
          title="Back to Listening tests"
          variant="ghost"
          onPress={() => navigation.navigate('ListeningList')}
          testID="back-to-list"
        />
      </Screen>
    );
  }

  const answered = answeredCount(questions, session.answers);
  return (
    <Screen testID="listening-test">
      <Title>{test.title}</Title>
      <Caption>
        {mode === 'timed'
          ? `Timed · ${formatDuration(LISTENING_TIME_LIMIT_SECONDS)}`
          : 'Practice · untimed'}
      </Caption>
      {mode === 'timed' && session.remaining !== null ? (
        <Countdown seconds={session.remaining} testID="test-countdown" />
      ) : null}
      {session.timeUp ? (
        <ErrorText message="Time is up — submit now. You have 60 seconds of grace before the submit is refused." />
      ) : null}
      <Caption>
        Answered {answered} of {questions.length}
      </Caption>

      {test.parts.map(part => {
        const audioUrl = part.audio_url
          ? resolveAudioUrl(part.audio_url, apiBaseUrl())
          : null;
        return (
          <View key={part.part} style={styles.partBlock}>
            <SectionHeader>
              Part {part.part} — {part.title}
            </SectionHeader>
            <Body>{part.setting}</Body>
            {audioUrl ? (
              <ListeningAudioPlayer
                testId={test.id}
                part={part.part}
                audioUrl={audioUrl}
                audioNote={part.audio_note}
              />
            ) : (
              <Card testID={`audio-note-part-${part.part}`}>
                <Subheading>Audio coming soon — read the transcript</Subheading>
                <Caption>{part.audio_note}</Caption>
              </Card>
            )}
            <Card testID={`transcript-part-${part.part}`}>
              <Body>{part.transcript}</Body>
            </Card>
            {part.questions.map(question => (
              <QuestionField
                key={question.no}
                question={question}
                value={session.answers[String(question.no)] ?? null}
                onChange={value => session.setAnswer(question.no, value)}
              />
            ))}
          </View>
        );
      })}

      {session.submitError ? (
        <ErrorText message={session.submitError} />
      ) : null}
      {session.expired ? (
        <AppButton
          title="Start again"
          onPress={session.restart}
          accessibilityLabel={`Start ${test.title} again`}
          testID="restart-test"
        />
      ) : (
        <AppButton
          title={session.submitting ? 'Submitting…' : 'Submit answers'}
          onPress={session.submit}
          disabled={session.submitting}
          accessibilityLabel="Submit answers"
          testID="submit-answers"
        />
      )}
      <AppButton
        title="Back to Listening tests"
        variant="ghost"
        onPress={() => navigation.navigate('ListeningList')}
        testID="back-to-list"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  partBlock: {
    gap: spacing.md,
  },
});
