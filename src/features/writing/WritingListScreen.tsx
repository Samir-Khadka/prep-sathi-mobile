/**
 * Writing list — Academic / General Training filter, Task 1 and
 * Task 2 prompts from the bundled content (offline-first).
 */

import {useRoute, useNavigation, type RouteProp} from '@react-navigation/native';
import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {writingPrompts} from '../../content';
import {
  Body,
  Caption,
  Card,
  EmptyState,
  Heading,
  OptionButton,
  Screen,
  Title,
} from '../../components/ui';
import type {RootNavigation, RootStackParamList} from '../../navigation/types';
import {useSettingsStore} from '../../store/settingsStore';
import {colors, radius, spacing, typography} from '../../theme/tokens';
import type {Track} from '../../store/storage';

const TRACK_LABELS: Record<Track, string> = {
  academic: 'Academic',
  general: 'General Training',
};

export function WritingListScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'WritingList'>>();
  const navigation = useNavigation<RootNavigation>();
  const storedTrack = useSettingsStore(s => s.track);
  const setStoredTrack = useSettingsStore(s => s.setTrack);
  const [track, setTrack] = useState<Track>(route.params?.track ?? storedTrack);

  const changeTrack = (next: Track) => {
    setTrack(next);
    setStoredTrack(next);
  };

  const prompts = writingPrompts.filter(p => p.track === track);
  const task1 = prompts.filter(p => p.task === 1);
  const task2 = prompts.filter(p => p.task === 2);

  const renderPrompt = (prompt: (typeof prompts)[number]) => (
    <Pressable
      key={prompt.id}
      onPress={() => navigation.navigate('WritingPrompt', {promptId: prompt.id})}
      accessibilityRole="button"
      accessibilityLabel={`${prompt.title}. Task ${prompt.task}, at least ${prompt.min_words} words, about ${prompt.suggested_minutes} minutes.`}
      style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
      <Text style={styles.rowTitle}>{prompt.title}</Text>
      <Text style={styles.rowMeta}>
        Task {prompt.task} · at least {prompt.min_words} words · about{' '}
        {prompt.suggested_minutes} minutes
      </Text>
      <Text style={styles.rowExcerpt} numberOfLines={2}>
        {prompt.prompt}
      </Text>
    </Pressable>
  );

  return (
    <Screen>
      <Title>Writing</Title>
      <Body>
        Twenty prompts with model answers. Write your answer, then get
        feedback by the four IELTS criteria — a practice estimate, never
        an official score.
      </Body>
      <View
        style={styles.trackRow}
        accessibilityRole="radiogroup"
        accessibilityLabel="Choose track">
        {(['academic', 'general'] as const).map(t => (
          <View key={t} style={styles.trackOption}>
            <OptionButton
              label={TRACK_LABELS[t]}
              selected={track === t}
              onPress={() => changeTrack(t)}
              accessibilityLabel={`${TRACK_LABELS[t]} track`}
            />
          </View>
        ))}
      </View>
      {prompts.length === 0 ? (
        <EmptyState message="No prompts for this track yet." />
      ) : (
        <>
          <Heading>Task 1</Heading>
          <Card>
            <View style={styles.list}>{task1.map(renderPrompt)}</View>
          </Card>
          <Heading>Task 2</Heading>
          <Card>
            <View style={styles.list}>{task2.map(renderPrompt)}</View>
          </Card>
          <Caption>
            {prompts.length} prompts · {task1.length} Task 1 · {task2.length}{' '}
            Task 2
          </Caption>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  trackRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  trackOption: {
    flex: 1,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowTitle: {
    ...typography.subheading,
    color: colors.ink,
  },
  rowMeta: {
    ...typography.caption,
    color: colors.primary,
  },
  rowExcerpt: {
    ...typography.bodySmall,
    color: colors.inkMuted,
  },
});
