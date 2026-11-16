/**
 * Reading test: 3 passages in order, each with its full text,
 * then its questions.
 *
 * Same session pattern as Listening (see
 * src/features/listening/practice.tsx): timed mode counts down
 * from the server session's expiry when online, otherwise from
 * a local 60:00 clock; submit goes to the server when a session
 * exists and falls back to on-device scoring + a queued sync;
 * a timed submit past the limit + 60s grace is refused.
 * Bands use the track's table: Academic or General Training.
 */

import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {startReading, submitReading} from '@/api/client';
import {
  allReadingQuestions,
  getReadingTest,
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
  Title,
} from '@/components/ui';
import {
  READING_TIME_LIMIT_SECONDS,
  readingBand,
} from '@/lib/scoring';
import {formatDuration} from '@/lib/time';
import type {RootNavigation, RootStackParamList} from '@/navigation/types';
import {spacing} from '@/theme/tokens';
import {
  QuestionField,
  ResultsView,
  answeredCount,
  usePracticeSession,
} from '@/features/listening/practice';

type ReadingTestRoute = RouteProp<RootStackParamList, 'ReadingTest'>;

export function ReadingTestScreen() {
  const route = useRoute<ReadingTestRoute>();
  const navigation = useNavigation<RootNavigation>();
  const {testId, mode} = route.params;
  const test = getReadingTest(testId);
  const questions = useMemo(
    () => (test ? allReadingQuestions(test) : []),
    [test],
  );
  const track = test?.track ?? 'academic';
  const session = usePracticeSession({
    module: 'reading',
    testId,
    mode,
    timeLimitSeconds: READING_TIME_LIMIT_SECONDS,
    questions,
    bandFor: score => readingBand(track, score),
    startSession: startReading,
    submitSession: submitReading,
  });

  if (!test) {
    return (
      <Screen testID="reading-test-missing">
        <Title>Reading test</Title>
        <EmptyState message="That test could not be found." />
        <AppButton
          title="Back to Reading tests"
          onPress={() => navigation.navigate('ReadingList', {})}
        />
      </Screen>
    );
  }

  if (session.outcome) {
    return (
      <Screen testID="reading-test-results">
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
          title="Back to Reading tests"
          variant="ghost"
          onPress={() => navigation.navigate('ReadingList', {})}
          testID="back-to-list"
        />
      </Screen>
    );
  }

  const answered = answeredCount(questions, session.answers);
  return (
    <Screen testID="reading-test">
      <Title>{test.title}</Title>
      <Caption>
        {test.track === 'general' ? 'General Training' : 'Academic'} ·{' '}
        {mode === 'timed'
          ? `Timed · ${formatDuration(READING_TIME_LIMIT_SECONDS)}`
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

      {test.passages.map(passage => (
        <View key={passage.section} style={styles.passageBlock}>
          <SectionHeader>
            Section {passage.section} — {passage.title}
          </SectionHeader>
          <Card testID={`passage-${passage.section}`}>
            <Body>{passage.text}</Body>
          </Card>
          {passage.questions.map(question => (
            <QuestionField
              key={question.no}
              question={question}
              value={session.answers[String(question.no)] ?? null}
              onChange={value => session.setAnswer(question.no, value)}
            />
          ))}
        </View>
      ))}

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
        title="Back to Reading tests"
        variant="ghost"
        onPress={() => navigation.navigate('ReadingList', {})}
        testID="back-to-list"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  passageBlock: {
    gap: spacing.md,
  },
});
