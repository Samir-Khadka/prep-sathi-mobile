/**
 * Writing prompt — read the prompt, write an answer with a live word
 * count, and get per-criterion feedback.
 *
 * Feedback is online-first (POST /api/practice/writing/feedback) and
 * falls back to the on-device port in src/lib/feedback.ts when the
 * device is offline or the server cannot be reached. Submitting also
 * records the attempt on the server, or queues it for later sync when
 * offline. Every band is labelled a practice estimate, never an
 * official score.
 */

import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import React, {useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {submitWriting, writingFeedback} from '../../api/client';
import type {WritingFeedbackResponse} from '../../api/types';
import {
  AppButton,
  AppTextInput,
  Body,
  Caption,
  Card,
  EmptyState,
  ErrorText,
  Heading,
  Screen,
  SectionHeader,
  Title,
} from '../../components/ui';
import {getWritingPrompt} from '../../content';
import {analyseWriting, countWords} from '../../lib/feedback';
import {BAND_LABEL} from '../../lib/scoring';
import type {RootNavigation, RootStackParamList} from '../../navigation/types';
import {useSyncStore} from '../../store/syncStore';
import {colors, spacing, typography} from '../../theme/tokens';

const CRITERION_LABELS: Record<string, string> = {
  task_achievement: 'Task achievement',
  coherence: 'Coherence and cohesion',
  lexical: 'Lexical resource',
  grammar: 'Grammatical range and accuracy',
};

const CRITERION_ORDER = [
  'task_achievement',
  'coherence',
  'lexical',
  'grammar',
];

export function WritingPromptScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'WritingPrompt'>>();
  const navigation = useNavigation<RootNavigation>();
  const enqueue = useSyncStore(s => s.enqueue);
  const prompt = getWritingPrompt(route.params.promptId);

  const [text, setText] = useState('');
  const [feedback, setFeedback] = useState<WritingFeedbackResponse | null>(
    null,
  );
  const [feedbackSource, setFeedbackSource] = useState<
    'server' | 'offline' | null
  >(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showModel, setShowModel] = useState(false);
  const [savedNote, setSavedNote] = useState('');
  const startedAtRef = useRef(Date.now());

  if (!prompt) {
    return (
      <Screen>
        <Title>Writing prompt</Title>
        <EmptyState message="This prompt could not be found." />
        <AppButton
          title="Back to Writing"
          variant="secondary"
          onPress={() => navigation.navigate('WritingList', {})}
        />
      </Screen>
    );
  }

  const wordCount = countWords(text);
  const meetsMinimum = wordCount >= prompt.min_words;

  const submit = async () => {
    if (!text.trim()) {
      setError('Write something first — your answer is empty.');
      return;
    }
    setError('');
    setSavedNote('');
    setSubmitting(true);
    const durationSeconds = Math.floor((Date.now() - startedAtRef.current) / 1000);
    try {
      let result: WritingFeedbackResponse;
      let source: 'server' | 'offline';
      try {
        result = await writingFeedback({prompt_id: prompt.id, text});
        source = 'server';
      } catch {
        // Offline (or server unreachable): score on-device.
        result = analyseWriting(prompt, text);
        source = 'offline';
      }
      setFeedback(result);
      setFeedbackSource(source);
      const bandEstimate = (result.band_low + result.band_high) / 2;
      try {
        await submitWriting({
          prompt_id: prompt.id,
          text,
          duration_seconds: durationSeconds,
        });
        setSavedNote('Attempt saved on the server.');
      } catch {
        enqueue({
          module: 'writing',
          kind: 'practice',
          score_raw: result.word_count,
          band_estimate: bandEstimate,
          duration_seconds: durationSeconds,
        });
        setSavedNote('Saved on this device — it will sync when you are online.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not get feedback. Try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      <Title>{prompt.title}</Title>
      <Caption>
        Task {prompt.task} · {prompt.track === 'academic' ? 'Academic' : 'General Training'} ·
        at least {prompt.min_words} words · about {prompt.suggested_minutes}{' '}
        minutes
      </Caption>
      <Card>
        <Body>{prompt.prompt}</Body>
      </Card>

      <AppButton
        title={showModel ? 'Hide model answer' : 'Show model answer'}
        variant="secondary"
        onPress={() => setShowModel(v => !v)}
        accessibilityLabel={
          showModel
            ? 'Hide model answer and commentary'
            : 'Show model answer and commentary'
        }
      />
      {showModel ? (
        <Card>
          <SectionHeader>Model answer</SectionHeader>
          <Body>{prompt.model_answer}</Body>
          <SectionHeader>What makes this band 7</SectionHeader>
          <Body>{prompt.commentary}</Body>
        </Card>
      ) : null}

      <SectionHeader>Your answer</SectionHeader>
      <AppTextInput
        label={`Your answer — ${wordCount} words (minimum ${prompt.min_words})`}
        value={text}
        onChangeText={value => {
          setText(value);
          if (feedback) {
            setFeedback(null);
            setFeedbackSource(null);
          }
        }}
        multiline
        numberOfLines={12}
        placeholder="Write your answer here…"
        accessibilityLabel={`Your answer. ${wordCount} words, minimum ${prompt.min_words}.`}
        testID="writing-answer-input"
      />
      <Caption>
        {wordCount} words · minimum {prompt.min_words} ·{' '}
        {meetsMinimum
          ? 'you meet the minimum.'
          : `${prompt.min_words - wordCount} more words to reach the minimum.`}
      </Caption>

      <AppButton
        title={submitting ? 'Getting feedback…' : 'Get feedback'}
        onPress={submit}
        disabled={submitting || !text.trim()}
        accessibilityLabel="Get feedback on your answer"
        testID="writing-submit"
      />
      <ErrorText message={error} />
      {savedNote ? <Caption>{savedNote}</Caption> : null}

      {feedback ? (
        <Card testID="writing-feedback">
          <Heading>
            Band {feedback.band_low.toFixed(1)} – {feedback.band_high.toFixed(1)}
          </Heading>
          <Caption>{BAND_LABEL}</Caption>
          <Caption>
            {feedback.word_count} words · minimum {feedback.min_words} ·{' '}
            {feedback.meets_minimum ? 'minimum met' : 'below minimum'}
            {feedbackSource === 'offline'
              ? ' · scored on this device (offline)'
              : ' · scored by the server'}
          </Caption>
          {CRITERION_ORDER.map(key => {
            const criterion = feedback.criteria[key];
            if (!criterion) {
              return null;
            }
            return (
              <View key={key} style={styles.criterion}>
                <Text style={styles.criterionTitle}>
                  {CRITERION_LABELS[key] ?? key}: Band{' '}
                  {criterion.band_low.toFixed(1)} –{' '}
                  {criterion.band_high.toFixed(1)}
                </Text>
                {criterion.notes.map(note => (
                  <Text key={note} style={styles.note}>
                    • {note}
                  </Text>
                ))}
              </View>
            );
          })}
          <Body>{feedback.limits}</Body>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  criterion: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
  criterionTitle: {
    ...typography.subheading,
    color: colors.ink,
  },
  note: {
    ...typography.bodySmall,
    color: colors.inkMuted,
  },
});
