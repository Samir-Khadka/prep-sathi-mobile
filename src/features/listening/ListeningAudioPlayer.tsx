/**
 * Listening audio player — one per part, rendered only when the
 * part has an `audio_url` (a real recording on the server).
 *
 * Offline-first: a cached MP3 plays from disk; otherwise the first
 * Play press downloads it (downloading state shown) and then plays.
 * Offline with nothing cached shows a note and falls back to the
 * transcript the screen already renders below — audio is never
 * faked, and a load/play failure shows the audio note instead of a
 * broken player.
 *
 * Playback uses react-native-nitro-sound's `useSoundWithStates`
 * hook (each hook owns its own native Sound instance):
 * `startPlayer(localPath)` / `pausePlayer` / `resumePlayer` /
 * `stopPlayer` / `seekToPlayer(ms)`, progress from the
 * `addPlayBackListener` callback (`PlayBackType.duration` and
 * `currentPosition`, both milliseconds) and end-of-track from
 * `addPlaybackEndListener`; `setSubscriptionDuration(0.5)` ticks
 * progress twice a second. Only one part plays at a time (see
 * playbackManager); starting a part stops any other part.
 */

import NetInfo from '@react-native-community/netinfo';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useSoundWithStates} from 'react-native-nitro-sound';
import {AppButton, Caption, Card, ErrorText, Subheading} from '@/components/ui';
import {colors, radius, spacing, typography} from '@/theme/tokens';
import {
  cachePathFor,
  ensureCachedAudio,
  isAudioCached,
} from './audioCache';
import {claimPlayback, releasePlayback} from './playbackManager';

export const SEEK_STEP_MS = 10_000;

export function formatPlaybackTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

type CacheState =
  | 'checking'
  | 'cached'
  | 'not-cached'
  | 'downloading'
  | 'offline'
  | 'error';
type PlayState = 'idle' | 'playing' | 'paused' | 'ended';

export function ListeningAudioPlayer({
  testId,
  part,
  audioUrl,
  audioNote,
}: {
  testId: string;
  part: number;
  /** Absolute URL of the MP3 (already resolved against the API base). */
  audioUrl: string;
  audioNote: string;
}) {
  const playerId = `${testId}-part${part}`;
  const [cacheState, setCacheState] = useState<CacheState>('checking');
  const [playState, setPlayState] = useState<PlayState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(
    null,
  );

  const playStateRef = useRef<PlayState>('idle');
  // Local path of the cached file, if any. A ref (not state): the
  // cache-state change above already re-renders when it is set.
  const localPathRef = useRef<string | null>(null);

  const updatePlayState = useCallback((next: PlayState) => {
    playStateRef.current = next;
    setPlayState(next);
  }, []);

  const handlePlaybackEnd = useCallback(() => {
    updatePlayState('ended');
    releasePlayback(playerId);
  }, [playerId, updatePlayState]);

  const {sound, state, startPlayer, pausePlayer, resumePlayer, stopPlayer, seekToPlayer} =
    useSoundWithStates({
      subscriptionDuration: 0.5,
      onPlaybackEnd: handlePlaybackEnd,
    });

  // Stop this part (and free the single-player slot) — used by the
  // manager when another part starts, and by the Stop button.
  const stopSelf = useCallback(async () => {
    try {
      await stopPlayer();
    } catch {
      // The native player is already gone; treat as stopped.
    }
    updatePlayState('idle');
  }, [stopPlayer, updatePlayState]);
  const stopSelfRef = useRef(stopSelf);
  useEffect(() => {
    stopSelfRef.current = stopSelf;
  });

  // Never leave audio playing if the screen unmounts. The hook's
  // autoDispose destroys the native instance; stopping on the raw
  // instance (not the hook wrapper, which would recreate it) is
  // safe either way — a disposed instance just throws, caught here.
  const soundRef = useRef(sound);
  useEffect(() => {
    soundRef.current = sound;
  });
  useEffect(() => {
    return () => {
      releasePlayback(playerId);
      try {
        void soundRef.current.stopPlayer().catch(() => undefined);
      } catch {
        // Already disposed.
      }
    };
  }, [playerId]);

  // On mount: is this part already downloaded? If not, note whether
  // we are online — offline with nothing cached means transcript
  // only until the next online visit.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (await isAudioCached(testId, part)) {
        if (cancelled) {
          return;
        }
        localPathRef.current = cachePathFor(testId, part);
        setCacheState('cached');
        return;
      }
      const net = await NetInfo.fetch();
      if (cancelled) {
        return;
      }
      setCacheState(net.isConnected ? 'not-cached' : 'offline');
    })();
    return () => {
      cancelled = true;
    };
  }, [testId, part]);

  const play = useCallback(async () => {
    if (playStateRef.current === 'playing') {
      return;
    }
    setError(null);
    // Resume a paused track without restarting it.
    if (playStateRef.current === 'paused') {
      await claimPlayback(playerId, stopSelfRef.current);
      try {
        await resumePlayer();
        updatePlayState('playing');
      } catch (err) {
        releasePlayback(playerId);
        setError(
          err instanceof Error
            ? `Could not resume audio: ${err.message}`
            : 'Could not resume audio.',
        );
      }
      return;
    }
    let path = localPathRef.current;
    if (!path) {
      setCacheState('downloading');
      setDownloadProgress(0);
      let result;
      try {
        result = await ensureCachedAudio({
          testId,
          part,
          remoteUrl: audioUrl,
          onProgress: progress => {
            setDownloadProgress(
              progress.contentLength > 0
                ? progress.bytesWritten / progress.contentLength
                : null,
            );
          },
        });
      } catch (err) {
        setCacheState('error');
        setError(
          err instanceof Error
            ? `Could not download audio: ${err.message}`
            : 'Could not download audio.',
        );
        return;
      }
      if (result.status === 'offline') {
        setCacheState('offline');
        return;
      }
      path = result.localPath;
      localPathRef.current = path;
      setCacheState('cached');
    }
    await claimPlayback(playerId, stopSelfRef.current);
    try {
      await startPlayer(path);
      updatePlayState('playing');
    } catch (err) {
      releasePlayback(playerId);
      setCacheState('error');
      setError(
        err instanceof Error
          ? `Could not play audio: ${err.message}`
          : 'Could not play audio.',
      );
    }
  }, [audioUrl, part, playerId, resumePlayer, startPlayer, testId, updatePlayState]);

  const pause = useCallback(async () => {
    try {
      await pausePlayer();
      updatePlayState('paused');
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not pause audio: ${err.message}`
          : 'Could not pause audio.',
      );
    }
  }, [pausePlayer, updatePlayState]);

  const stop = useCallback(async () => {
    releasePlayback(playerId);
    await stopSelfRef.current();
  }, [playerId]);

  const seekBy = useCallback(
    async (deltaMs: number) => {
      const {position, duration} = state.playback;
      const target = Math.min(Math.max(0, position + deltaMs), duration);
      try {
        await seekToPlayer(target);
      } catch (err) {
        setError(
          err instanceof Error
            ? `Could not seek: ${err.message}`
            : 'Could not seek.',
        );
      }
    },
    [seekToPlayer, state.playback],
  );

  const {position, duration} = state.playback;
  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const canSeek = duration > 0 && playState !== 'idle';
  const showTransport =
    cacheState === 'cached' || cacheState === 'not-cached';

  return (
    <Card testID={`audio-player-part-${part}`}>
      <Subheading>Listen — Part {part}</Subheading>
      <Caption>{audioNote}</Caption>

      {cacheState === 'checking' ? (
        <Caption>Checking for downloaded audio…</Caption>
      ) : null}
      {cacheState === 'downloading' ? (
        <View style={styles.statusRow}>
          <ActivityIndicator color={colors.primary} />
          <Caption>
            Downloading audio…
            {downloadProgress !== null
              ? ` ${Math.round(downloadProgress * 100)}%`
              : ''}
          </Caption>
        </View>
      ) : null}
      {cacheState === 'offline' ? (
        <Caption>
          You are offline and this audio is not downloaded yet — it needs
          downloading when you are back online. Read the transcript below
          for now.
        </Caption>
      ) : null}
      {cacheState === 'error' ? (
        <ErrorText
          message={`${error ?? 'Could not load this audio.'} Read the transcript below.`}
        />
      ) : null}

      {showTransport ? (
        <View>
          <View style={styles.progressRow}>
            <View
              style={styles.progressTrack}
              testID={`audio-progress-part-${part}`}
              accessibilityRole="progressbar"
              accessibilityValue={{
                now: Math.round(progress * 100),
                min: 0,
                max: 100,
              }}>
              <View
                style={[
                  styles.progressFill,
                  {width: `${Math.round(progress * 100)}%`},
                ]}
              />
            </View>
            <Text
              style={styles.time}
              testID={`audio-time-part-${part}`}>
              {formatPlaybackTime(position)} / {formatPlaybackTime(duration)}
            </Text>
          </View>
          <View style={styles.transportRow}>
            <Pressable
              onPress={() => void seekBy(-SEEK_STEP_MS)}
              disabled={!canSeek}
              accessibilityRole="button"
              accessibilityLabel="Back 10 seconds"
              testID={`audio-seek-back-part-${part}`}
              style={({pressed}) => [
                styles.seekButton,
                pressed && styles.pressed,
                !canSeek && styles.disabled,
              ]}>
              <Text style={styles.seekText}>−10s</Text>
            </Pressable>
            <AppButton
              title={
                playState === 'playing'
                  ? 'Pause'
                  : playState === 'paused'
                    ? 'Resume'
                    : playState === 'ended'
                      ? 'Play again'
                      : 'Play audio'
              }
              onPress={() =>
                void (playState === 'playing' ? pause() : play())
              }
              accessibilityLabel={
                playState === 'playing'
                  ? `Pause Part ${part} audio`
                  : `Play Part ${part} audio`
              }
              testID={`audio-play-part-${part}`}
            />
            <Pressable
              onPress={() => void seekBy(SEEK_STEP_MS)}
              disabled={!canSeek}
              accessibilityRole="button"
              accessibilityLabel="Forward 10 seconds"
              testID={`audio-seek-forward-part-${part}`}
              style={({pressed}) => [
                styles.seekButton,
                pressed && styles.pressed,
                !canSeek && styles.disabled,
              ]}>
              <Text style={styles.seekText}>+10s</Text>
            </Pressable>
          </View>
          {playState === 'playing' || playState === 'paused' ? (
            <AppButton
              title="Stop"
              variant="ghost"
              onPress={() => void stop()}
              accessibilityLabel={`Stop Part ${part} audio`}
              testID={`audio-stop-part-${part}`}
            />
          ) : null}
          {cacheState === 'not-cached' ? (
            <Caption>
              Downloads once, then plays offline. Nothing is recorded or
              uploaded.
            </Caption>
          ) : (
            <Caption>Downloaded — plays offline.</Caption>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressTrack: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    flex: 1,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
  },
  time: {
    ...typography.bodySmall,
    color: colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  transportRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  seekButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: spacing.sm,
  },
  seekText: {
    ...typography.button,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.4,
  },
});
