/**
 * Speaking history — on-device recordings, newest first.
 *
 * Audio files live on disk; MMKV holds metadata only. Playback uses
 * the recorder-player. Deleting a recording removes its file and its
 * metadata. Nothing is ever uploaded.
 */

import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {exists, unlink} from '@dr.pogodin/react-native-fs';
import React, {useCallback, useEffect, useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {
  AppButton,
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
  getSpeakingRecordings,
  setSpeakingRecordings,
  type StoredSpeakingRecording,
} from '../../store/storage';
import {colors, radius, spacing, typography} from '../../theme/tokens';

export function SpeakingHistoryScreen() {
  const navigation = useNavigation<RootNavigation>();
  const [recordings, setRecordings] = useState<StoredSpeakingRecording[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  const refresh = useCallback(() => {
    setRecordings(
      [...getSpeakingRecordings()].sort((a, b) => b.createdAt - a.createdAt),
    );
  }, []);

  useFocusEffect(refresh);

  // Stop playback if the screen unmounts.
  useEffect(
    () => () => {
      AudioRecorderPlayer.removePlayBackListener();
      void AudioRecorderPlayer.stopPlayer().catch(() => undefined);
    },
    [],
  );

  const togglePlay = async (recording: StoredSpeakingRecording) => {
    setError('');
    try {
      if (playingId === recording.id) {
        await AudioRecorderPlayer.stopPlayer();
        AudioRecorderPlayer.removePlayBackListener();
        setPlayingId(null);
        return;
      }
      if (playingId) {
        await AudioRecorderPlayer.stopPlayer();
        AudioRecorderPlayer.removePlayBackListener();
      }
      const fileExists = await exists(recording.filePath);
      if (!fileExists) {
        setError(
          `The audio file for “${recording.topic}” is missing from this device.`,
        );
        return;
      }
      AudioRecorderPlayer.addPlayBackListener(() => undefined);
      await AudioRecorderPlayer.startPlayer(recording.filePath);
      setPlayingId(recording.id);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not play the recording.',
      );
    }
  };

  const deleteOne = async (recording: StoredSpeakingRecording) => {
    if (playingId === recording.id) {
      await AudioRecorderPlayer.stopPlayer().catch(() => undefined);
      AudioRecorderPlayer.removePlayBackListener();
      setPlayingId(null);
    }
    await unlink(recording.filePath).catch(() => undefined);
    const next = getSpeakingRecordings().filter(r => r.id !== recording.id);
    setSpeakingRecordings(next);
    refresh();
  };

  const deleteAll = async () => {
    if (!confirmDeleteAll) {
      setConfirmDeleteAll(true);
      return;
    }
    await AudioRecorderPlayer.stopPlayer().catch(() => undefined);
    AudioRecorderPlayer.removePlayBackListener();
    setPlayingId(null);
    const current = getSpeakingRecordings();
    for (const recording of current) {
      await unlink(recording.filePath).catch(() => undefined);
    }
    setSpeakingRecordings([]);
    setConfirmDeleteAll(false);
    refresh();
  };

  return (
    <Screen>
      <Title>My recordings</Title>
      <Body>
        Recordings stay on this device and are never uploaded. Up to 20
        are kept — the oldest is dropped when a new one is saved.
      </Body>
      <ErrorText message={error} />
      {recordings.length === 0 ? (
        <EmptyState message="No recordings yet. Record yourself from a speaking set." />
      ) : (
        <>
          <AppButton
            title={
              confirmDeleteAll
                ? 'Tap again to delete all recordings'
                : `Delete all (${recordings.length})`
            }
            variant="danger"
            onPress={() => void deleteAll()}
            accessibilityLabel={
              confirmDeleteAll
                ? 'Confirm delete all recordings'
                : 'Delete all recordings'
            }
          />
          {recordings.map(recording => (
            <Card key={recording.id}>
              <View style={styles.rowHead}>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle}>{recording.topic}</Text>
                  <Caption>
                    {recording.part} ·{' '}
                    {formatDuration(recording.durationSeconds)} ·{' '}
                    {new Date(recording.createdAt).toLocaleDateString()}
                  </Caption>
                  {recording.fluency ? (
                    <Caption>
                      Fluency estimate: Band{' '}
                      {recording.fluency.bandLow.toFixed(1)} –{' '}
                      {recording.fluency.bandHigh.toFixed(1)} · practice
                      estimate, not an official score
                    </Caption>
                  ) : (
                    <Caption>No fluency estimate for this recording.</Caption>
                  )}
                </View>
              </View>
              {recording.fluency?.notes.map(note => (
                <Text key={note} style={styles.note}>
                  • {note}
                </Text>
              ))}
              <View style={styles.actions}>
                <Pressable
                  onPress={() => void togglePlay(recording)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    playingId === recording.id
                      ? `Stop playing ${recording.topic}`
                      : `Play ${recording.topic}`
                  }
                  style={({pressed}) => [
                    styles.actionButton,
                    pressed && styles.actionPressed,
                  ]}>
                  <Text style={styles.actionText}>
                    {playingId === recording.id ? '■ Stop' : '▶ Play'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void deleteOne(recording)}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete recording ${recording.topic}`}
                  style={({pressed}) => [
                    styles.actionButton,
                    styles.actionDanger,
                    pressed && styles.actionPressed,
                  ]}>
                  <Text style={[styles.actionText, styles.actionTextDanger]}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </>
      )}
      <AppButton
        title="Back to Speaking"
        variant="ghost"
        onPress={() => navigation.navigate('SpeakingList')}
        accessibilityLabel="Back to speaking sets"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  rowHead: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    ...typography.subheading,
    color: colors.ink,
  },
  note: {
    ...typography.bodySmall,
    color: colors.inkMuted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    paddingVertical: spacing.md,
  },
  actionDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.danger,
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionText: {
    ...typography.button,
    color: colors.primaryDark,
  },
  actionTextDanger: {
    color: colors.danger,
  },
});
