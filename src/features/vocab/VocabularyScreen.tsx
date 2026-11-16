/**
 * Vocabulary — the 250-word deck, seeded from bundled content into
 * local state on first open. Search, add, and delete are all local;
 * a server id (when present) is deleted best-effort. Local state is
 * the source of truth offline.
 */

import {useFocusEffect, useNavigation} from '@react-navigation/native';
import React, {useCallback, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, View} from 'react-native';
import {deleteVocabulary} from '../../api/client';
import {
  AppButton,
  AppTextInput,
  Body,
  Caption,
  Card,
  EmptyState,
  ErrorText,
  Screen,
  Title,
} from '../../components/ui';
import {formatDuration} from '../../lib/time';
import type {RootNavigation} from '../../navigation/types';
import {
  getLocalVocab,
  setLocalVocab,
  type LocalVocabItem,
} from '../../store/storage';
import {colors, radius, spacing, typography} from '../../theme/tokens';
import {
  buildLocalWord,
  dueItems,
  ensureSeeded,
  filterVocab,
} from './vocabStore';

export function VocabularyScreen() {
  const navigation = useNavigation<RootNavigation>();
  const [items, setItems] = useState<LocalVocabItem[]>(() => ensureSeeded());
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newMeaning, setNewMeaning] = useState('');
  const [newExample, setNewExample] = useState('');
  const [newTopic, setNewTopic] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(() => {
    setItems(ensureSeeded());
  }, []);

  useFocusEffect(refresh);

  const persist = (next: LocalVocabItem[]) => {
    setLocalVocab(next);
    setItems(next);
  };

  const due = dueItems(items);
  const visible = filterVocab(items, query);

  const addWord = () => {
    if (!newWord.trim() || !newMeaning.trim()) {
      setError('A word and its meaning are both needed.');
      return;
    }
    setError('');
    const item = buildLocalWord({
      word: newWord,
      meaning: newMeaning,
      example: newExample,
      topic: newTopic,
    });
    persist([item, ...getLocalVocab()]);
    setNewWord('');
    setNewMeaning('');
    setNewExample('');
    setNewTopic('');
    setShowAdd(false);
  };

  const deleteWord = (item: LocalVocabItem) => {
    const next = getLocalVocab().filter(
      candidate =>
        !(
          candidate.word === item.word &&
          candidate.createdAt === item.createdAt
        ),
    );
    persist(next);
    if (item.serverId !== null) {
      // Best-effort: the word is already gone locally.
      void deleteVocabulary(item.serverId).catch(() => undefined);
    }
  };

  const renderItem = ({item}: {item: LocalVocabItem}) => {
    const isDue = due.some(
      d => d.word === item.word && d.createdAt === item.createdAt,
    );
    return (
      <Card>
        <View style={styles.wordRow}>
          <View style={styles.wordText}>
            <Text style={styles.word}>{item.word}</Text>
            <Body>{item.meaning}</Body>
            {item.example ? <Caption>“{item.example}”</Caption> : null}
            <Caption>
              {item.topic}
              {isDue ? ' · due for review' : ''} · next review in{' '}
              {formatDuration(
                Math.max(0, item.nextReviewMs - Date.now()) / 1000,
              )}
            </Caption>
          </View>
          <Pressable
            onPress={() => deleteWord(item)}
            accessibilityRole="button"
            accessibilityLabel={`Delete word ${item.word}`}
            style={({pressed}) => [
              styles.deleteButton,
              pressed && styles.pressed,
            ]}>
            <Text style={styles.deleteText}>Delete</Text>
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <Screen scroll={false}>
      <FlatList
        data={visible}
        keyExtractor={item => `${item.createdAt}:${item.word}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Title>Vocabulary</Title>
            <Body>
              {items.length} words · {due.length} due for review. Words are
              stored on this device; review them on a spaced schedule.
            </Body>
            <AppButton
              title={
                due.length > 0
                  ? `Review ${due.length} due word${due.length === 1 ? '' : 's'}`
                  : 'Review words'
              }
              onPress={() => navigation.navigate('VocabularyReview')}
              accessibilityLabel="Open vocabulary review"
            />
            <AppTextInput
              label="Search words, meanings, or topics"
              value={query}
              onChangeText={setQuery}
              placeholder="e.g. curriculum"
              accessibilityLabel="Search vocabulary"
              testID="vocab-search"
            />
            <AppButton
              title={showAdd ? 'Cancel adding a word' : 'Add a word'}
              variant="secondary"
              onPress={() => {
                setShowAdd(v => !v);
                setError('');
              }}
              accessibilityLabel={
                showAdd ? 'Cancel adding a word' : 'Add a word'
              }
            />
            {showAdd ? (
              <Card>
                <AppTextInput
                  label="Word"
                  value={newWord}
                  onChangeText={setNewWord}
                  placeholder="e.g. resilient"
                  accessibilityLabel="New word"
                />
                <AppTextInput
                  label="Meaning"
                  value={newMeaning}
                  onChangeText={setNewMeaning}
                  placeholder="e.g. able to recover quickly"
                  accessibilityLabel="New word meaning"
                />
                <AppTextInput
                  label="Example (optional)"
                  value={newExample}
                  onChangeText={setNewExample}
                  placeholder="e.g. She is resilient under pressure."
                  accessibilityLabel="New word example, optional"
                />
                <AppTextInput
                  label="Topic (optional)"
                  value={newTopic}
                  onChangeText={setNewTopic}
                  placeholder="e.g. education"
                  accessibilityLabel="New word topic, optional"
                />
                <ErrorText message={error} />
                <AppButton
                  title="Save word"
                  onPress={addWord}
                  accessibilityLabel="Save new word"
                />
              </Card>
            ) : null}
            <ErrorText message={showAdd ? '' : error} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            message={
              query
                ? `No words match “${query}”.`
                : 'No words yet.'
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: spacing.md,
    paddingBottom: spacing.md,
  },
  listContent: {
    gap: spacing.md,
  },
  wordRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  wordText: {
    flex: 1,
    gap: spacing.xs,
  },
  word: {
    ...typography.subheading,
    color: colors.ink,
  },
  deleteButton: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  deleteText: {
    ...typography.caption,
    color: colors.danger,
  },
  pressed: {
    opacity: 0.7,
  },
});
