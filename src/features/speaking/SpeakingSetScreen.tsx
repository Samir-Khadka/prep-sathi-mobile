/**
 * Speaking set — Part 1, Part 2 cue card (60s preparation, 2-minute
 * talk), Part 3, and a sample answer. Recording is explicit and
 * on-device only: audio is saved under the app documents directory
 * with metadata in MMKV, capped at 20 recordings (oldest dropped,
 * file deleted too). Fluency feedback is an estimated RANGE from
 * timing signals only — it cannot judge pronunciation, vocabulary,
 * or ideas.
 *
 * Recording needs the microphone permission (RECORD_AUDIO is in
 * AndroidManifest). Nothing is ever uploaded.
 */

import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {DocumentDirectoryPath, unlink} from '@dr.pogodin/react-native-fs';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {PermissionsAndroid, Platform, StyleSheet, Text, View} from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import {completeSpeaking} from '../../api/client';
import {
  AppButton,
  Body,
  Caption,
  Card,
  EmptyState,
  ErrorText,
  OptionButton,
  Screen,
  SectionHeader,
  Title,
} from '../../components/ui';
import {getSpeakingSet} from '../../content';
import {
  analyseFluency,
  SAMPLE_INTERVAL_SECONDS,
  SPEAKING_TARGET_SECONDS,
  type FluencyEstimate,
} from '../../lib/fluency';
import {BAND_LABEL} from '../../lib/scoring';
import type {RootNavigation, RootStackParamList} from '../../navigation/types';
import {
  getSpeakingRecordings,
  setSpeakingRecordings,
  type StoredSpeakingRecording,
} from '../../store/storage';
import {useSyncStore} from '../../store/syncStore';
import {colors, spacing, typography} from '../../theme/tokens';
import {
  addRecordingWithCap,
  meteringDbToLevel,
  recordingFileName,
} from './recordingStore';

type Part = 'Part 1' | 'Part 2' | 'Part 3';
type Phase = 'idle' | 'prep' | 'recording' | 'recorded';

const PARTS: Part[] = ['Part 1', 'Part 2', 'Part 3'];

function formatClock(totalSeconds: number): string {
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export function SpeakingSetScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'SpeakingSet'>>();
  const navigation = useNavigation<RootNavigation>();
  const enqueue = useSyncStore(s => s.enqueue);
  const set = getSpeakingSet(route.params.setId);

  const [part, setPart] = useState<Part>('Part 2');
  const [phase, setPhase] = useState<Phase>('idle');
  const [prepLeft, setPrepLeft] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [fluency, setFluency] = useState<FluencyEstimate | null>(null);
  const [error, setError] = useState('');
  const [prepNote, setPrepNote] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSample, setShowSample] = useState(false);

  const levelsRef = useRef<number[]>([]);
  const elapsedRef = useRef(0);
  const prepLeftRef = useRef(0);
  const filePathRef = useRef<string | null>(null);

  const talkSeconds = set
    ? part === 'Part 2'
      ? set.part2.talk_seconds
      : SPEAKING_TARGET_SECONDS
    : SPEAKING_TARGET_SECONDS;

  const stopRecording = useCallback(async () => {
    try {
      const uri = await AudioRecorderPlayer.stopRecorder();
      if (uri) {
        filePathRef.current = uri;
      }
    } catch {
      // Keep the path we started with; the file may still exist.
    }
    AudioRecorderPlayer.removeRecordBackListener();
    const duration = Math.max(1, elapsedRef.current);
    const estimate = analyseFluency(
      levelsRef.current,
      SAMPLE_INTERVAL_SECONDS,
      duration,
      talkSeconds,
    );
    setFluency(estimate);
    setPhase('recorded');
    setSaved(false);
  }, [talkSeconds]);

  const stopRecordingRef = useRef(stopRecording);
  stopRecordingRef.current = stopRecording;

  // Timers: preparation countdown, and the talk clock (auto-stops).
  useEffect(() => {
    if (phase !== 'prep' && phase !== 'recording') {
      return undefined;
    }
    const id = setInterval(() => {
      if (phase === 'prep') {
        prepLeftRef.current -= 1;
        setPrepLeft(prepLeftRef.current);
        if (prepLeftRef.current <= 0) {
          setPhase('idle');
          setPrepNote(
            'Preparation time is up — start recording when you are ready.',
          );
        }
      } else {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= talkSeconds) {
          void stopRecordingRef.current();
        }
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, talkSeconds]);

  // Never leave the recorder running if the screen unmounts.
  useEffect(
    () => () => {
      AudioRecorderPlayer.removeRecordBackListener();
      void AudioRecorderPlayer.stopRecorder().catch(() => undefined);
    },
    [],
  );

  if (!set) {
    return (
      <Screen>
        <Title>Speaking set</Title>
        <EmptyState message="This speaking set could not be found." />
        <AppButton
          title="Back to Speaking"
          variant="secondary"
          onPress={() => navigation.navigate('SpeakingList')}
        />
      </Screen>
    );
  }

  const startPrep = () => {
    setError('');
    setPrepNote('');
    prepLeftRef.current = set.part2.prep_seconds;
    setPrepLeft(set.part2.prep_seconds);
    setPhase('prep');
  };

  const startRecording = async () => {
    setError('');
    setPrepNote('');
    setFluency(null);
    setSaved(false);
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone permission',
            message:
              'PrepSathi needs the microphone so you can record your speaking practice. Recordings stay on this device.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError(
            'Microphone permission was denied — recording needs it. You can allow it in the app settings.',
          );
          return;
        }
      }
      const createdAt = Date.now();
      const path = `${DocumentDirectoryPath}/${recordingFileName(
        set.id,
        createdAt,
      )}`;
      filePathRef.current = path;
      levelsRef.current = [];
      elapsedRef.current = 0;
      setElapsed(0);
      AudioRecorderPlayer.setSubscriptionDuration(SAMPLE_INTERVAL_SECONDS);
      AudioRecorderPlayer.addRecordBackListener(event => {
        levelsRef.current.push(meteringDbToLevel(event.currentMetering));
      });
      await AudioRecorderPlayer.startRecorder(path, undefined, true);
      setPhase('recording');
    } catch (err) {
      AudioRecorderPlayer.removeRecordBackListener();
      setError(
        err instanceof Error
          ? `Could not start recording: ${err.message}`
          : 'Could not start recording.',
      );
    }
  };

  const saveRecording = async () => {
    if (!fluency || !filePathRef.current || saving) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const createdAt = Date.now();
      const recording: StoredSpeakingRecording = {
        id: `${createdAt}-${Math.random().toString(36).slice(2, 8)}`,
        setId: set.id,
        topic: set.topic,
        part,
        filePath: filePathRef.current,
        durationSeconds: fluency.durationSeconds,
        createdAt,
        fluency: {
          speechSeconds: fluency.speechSeconds,
          pauseCount: fluency.pauseCount,
          longestPauseSeconds: fluency.longestPauseSeconds,
          bandLow: fluency.bandLow,
          bandHigh: fluency.bandHigh,
          notes: fluency.notes,
        },
      };
      const {kept, dropped} = addRecordingWithCap(
        getSpeakingRecordings(),
        recording,
      );
      for (const old of dropped) {
        await unlink(old.filePath).catch(() => undefined);
      }
      setSpeakingRecordings(kept);
      setSaved(true);
      try {
        await completeSpeaking({
          set_id: set.id,
          duration_seconds: fluency.durationSeconds,
        });
      } catch {
        enqueue({
          module: 'speaking',
          kind: 'practice',
          score_raw: null,
          band_estimate: (fluency.bandLow + fluency.bandHigh) / 2,
          duration_seconds: fluency.durationSeconds,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save the recording.',
      );
    } finally {
      setSaving(false);
    }
  };

  const changePart = (next: Part) => {
    if (phase === 'recording' || phase === 'prep') {
      return;
    }
    setPart(next);
    setFluency(null);
    setSaved(false);
    setError('');
    setPrepNote('');
  };

  return (
    <Screen>
      <Title>{set.topic}</Title>
      <Caption>Speaking set {set.id} · Part 1 · Part 2 · Part 3</Caption>

      <View accessibilityRole="radiogroup" accessibilityLabel="Choose part">
        {PARTS.map(p => (
          <OptionButton
            key={p}
            label={p}
            selected={part === p}
            onPress={() => changePart(p)}
            accessibilityLabel={`Practise ${p}`}
          />
        ))}
      </View>

      {part === 'Part 1' ? (
        <Card>
          <SectionHeader>Part 1 — questions</SectionHeader>
          {set.part1.map(q => (
            <Body key={q}>• {q}</Body>
          ))}
        </Card>
      ) : null}

      {part === 'Part 2' ? (
        <Card>
          <SectionHeader>Part 2 — cue card</SectionHeader>
          <Body>{set.part2.cue}</Body>
          {set.part2.points.map(point => (
            <Body key={point}>• {point}</Body>
          ))}
          <Caption>
            Preparation: {set.part2.prep_seconds}s · Talk:{' '}
            {set.part2.talk_seconds}s
          </Caption>
          {phase === 'prep' ? (
            <Text style={styles.timer} accessibilityLabel={`${prepLeft} seconds of preparation left`}>
              Prep {formatClock(prepLeft)}
            </Text>
          ) : null}
          {phase === 'idle' && prepNote ? <Caption>{prepNote}</Caption> : null}
          {phase === 'idle' ? (
            <AppButton
              title="Start 60-second preparation"
              variant="secondary"
              onPress={startPrep}
              accessibilityLabel="Start 60 second preparation timer"
            />
          ) : null}
        </Card>
      ) : null}

      {part === 'Part 3' ? (
        <Card>
          <SectionHeader>Part 3 — questions</SectionHeader>
          {set.part3.map(q => (
            <Body key={q}>• {q}</Body>
          ))}
        </Card>
      ) : null}

      <AppButton
        title={showSample ? 'Hide sample answer' : 'Show sample answer'}
        variant="secondary"
        onPress={() => setShowSample(v => !v)}
        accessibilityLabel={
          showSample ? 'Hide sample answer' : 'Show sample answer'
        }
      />
      {showSample ? (
        <Card>
          <SectionHeader>Sample answer</SectionHeader>
          <Body>{set.sample_answer}</Body>
        </Card>
      ) : null}

      <Card>
        <SectionHeader>Record yourself — {part}</SectionHeader>
        <Body>
          Talk for up to {formatClock(talkSeconds)}. Your fluency estimate
          comes from timing only (how long you spoke vs paused).
        </Body>
        {phase === 'recording' ? (
          <Text
            style={styles.timer}
            accessibilityLabel={`${elapsed} seconds recorded, ${talkSeconds - elapsed} seconds left`}>
            ● {formatClock(elapsed)} / {formatClock(talkSeconds)}
          </Text>
        ) : null}
        {phase === 'idle' || phase === 'recorded' ? (
          <AppButton
            title={fluency ? 'Record again' : 'Start recording'}
            onPress={() => void startRecording()}
            accessibilityLabel={`Start recording ${part}`}
          />
        ) : null}
        {phase === 'prep' ? (
          <AppButton
            title="Start recording now"
            onPress={() => void startRecording()}
            accessibilityLabel="Start recording now, before preparation ends"
          />
        ) : null}
        {phase === 'recording' ? (
          <AppButton
            title="Stop recording"
            variant="danger"
            onPress={() => void stopRecording()}
            accessibilityLabel="Stop recording"
          />
        ) : null}
        <ErrorText message={error} />
        {fluency && phase === 'recorded' ? (
          <View style={styles.fluency}>
            <Text style={styles.fluencyTitle}>
              Fluency estimate: Band {fluency.bandLow.toFixed(1)} –{' '}
              {fluency.bandHigh.toFixed(1)}
            </Text>
            <Caption>{BAND_LABEL}</Caption>
            {fluency.notes.map(note => (
              <Text key={note} style={styles.note}>
                • {note}
              </Text>
            ))}
            {saved ? (
              <Caption>
                Saved on this device. Find it under My recordings — nothing
                is uploaded.
              </Caption>
            ) : (
              <AppButton
                title={saving ? 'Saving…' : 'Save this recording'}
                onPress={() => void saveRecording()}
                disabled={saving}
                accessibilityLabel="Save this recording on this device"
              />
            )}
          </View>
        ) : null}
      </Card>

      <AppButton
        title="My recordings"
        variant="ghost"
        onPress={() => navigation.navigate('SpeakingHistory')}
        accessibilityLabel="Open my speaking recordings"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  timer: {
    ...typography.heading,
    color: colors.primary,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  fluency: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  fluencyTitle: {
    ...typography.subheading,
    color: colors.ink,
  },
  note: {
    ...typography.bodySmall,
    color: colors.inkMuted,
  },
});
