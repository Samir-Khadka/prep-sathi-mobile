/**
 * Vocabulary review — due words one at a time, spaced repetition.
 *
 * Front: the word. Tap to reveal meaning + example. Correct doubles
 * the interval (capped at 60 days); wrong resets it to 1 day. Local
 * state is the source of truth; when online the server review
 * endpoint is also called best-effort (only for words that have a
 * server id) and never blocks the review.
 */

import {useFocusEffect, useNavigation} from '@react-navigation/native';
import React, {useCallback, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {reviewVocabulary} from '../../api/client';
import {
  AppButton,
  Body,
  Caption,
  Card,
  Screen,
  Title,
} from '../../components/ui';
import {nextIntervalDays} from '../../lib/spacedRepetition';
import type {RootNavigation} from '../../navigation/types';
import {
  getLocalVocab,
  setLocalVocab,
  type LocalVocabItem,
} from '../../store/storage';
import {colors, spacing, typography} from '../../theme/tokens';
import {applyReview, dueItems, ensureSeeded} from './vocabStore';

export function VocabularyReviewScreen() {
  const navigation = useNavigation<RootNavigation>();
  const [queue, setQueue] = useState<LocalVocabItem[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [total, setTotal] = useState(0);

  const refresh = useCallback(() => {
    const due = dueItems(ensureSeeded());
    setQueue(due);
    setTotal(due.length);
    setIndex(0);
    setRevealed(false);
    setReviewed(0);
  }, []);

  useFocusEffect(refresh);

  const current = queue[index];
  const done = total === 0 || index >= queue.length;

  const answer = (correct: boolean) => {
    if (!current) {
      return;
    }
    const nowMs = Date.now();
    const next = applyReview(getLocalVocab(), current, correct, nowMs);
    setLocalVocab(next);
    if (current.serverId !== null) {
      // Best-effort: local state is already saved.
      void reviewVocabulary(current.serverId, correct).catch(() => undefined);
    }
    setReviewed(r => r + 1);
    setIndex(i => i + 1);
    setRevealed(false);
  };

  if (done) {
    return (
      <Screen>
        <Title>Review complete</Title>
        <Card>
          <Body>
            {total === 0
              ? 'No words are due for review right now. Come back tomorrow — or add new words in Vocabulary.'
              : `You reviewed ${reviewed} word${reviewed === 1 ? '' : 's'}. Correct answers wait longer before their next review; wrong ones come back tomorrow.`}
          </Body>
        </Card>
        <AppButton
          title="Back to Vocabulary"
          onPress={() => navigation.navigate('Vocabulary')}
          accessibilityLabel="Back to vocabulary list"
        />
        {total > 0 ? (
          <AppButton
            title="Review again"
            variant="secondary"
            onPress={refresh}
            accessibilityLabel="Check for more due words"
          />
        ) : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Review words</Title>
      <Caption>
        Word {index + 1} of {queue.length} · {reviewed} reviewed
      </Caption>
      <Card>
        <Text style={styles.word} accessibilityLabel={`Word: ${current.word}`}>
          {current.word}
        </Text>
        <Caption>{current.topic}</Caption>
        {revealed ? (
          <View style={styles.reveal}>
            <Body>{current.meaning}</Body>
            {current.example ? (
              <Caption>“{current.example}”</Caption>
            ) : null}
            <Caption>
              Correct → next review in{' '}
              {nextIntervalDays(true, current.intervalDays)}{' '}
              {nextIntervalDays(true, current.intervalDays) === 1
                ? 'day'
                : 'days'}
              ; wrong → tomorrow.
            </Caption>
          </View>
        ) : (
          <AppButton
            title="Tap to reveal meaning"
            variant="secondary"
            onPress={() => setRevealed(true)}
            accessibilityLabel="Reveal meaning and example"
          />
        )}
      </Card>
      {revealed ? (
        <View style={styles.actions}>
          <AppButton
            title="I got it wrong"
            variant="danger"
            onPress={() => answer(false)}
            accessibilityLabel="I got this word wrong, review again tomorrow"
          />
          <AppButton
            title="I got it right"
            onPress={() => answer(true)}
            accessibilityLabel="I got this word right"
          />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  word: {
    ...typography.title,
    color: colors.ink,
    textAlign: 'center',
  },
  reveal: {
    gap: spacing.sm,
  },
  actions: {
    gap: spacing.md,
  },
});
