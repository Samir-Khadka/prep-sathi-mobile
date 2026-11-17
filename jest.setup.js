/**
 * Jest setup: in-memory mocks for native modules that cannot run in
 * the Jest (Node) environment. Pure-logic tests (scoring, spaced
 * repetition, fluency, feedback, content) run against the real code;
 * anything touching MMKV, recording or the filesystem uses these.
 */

// React 19: enable the act() environment, or state updates triggered
// outside render (listeners, async effects) never flush
// synchronously inside act()/waitFor and tests see stale trees.
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// --- react-native-mmkv: in-memory key/value store --------------------
// MMKV v4 exposes createMMKV({id}) — MMKV itself is only a type.
jest.mock('react-native-mmkv', () => {
  const stores = new Map();
  function createMMKV({id} = {}) {
    const storeId = id ?? 'default';
    if (!stores.has(storeId)) {
      stores.set(storeId, new Map());
    }
    const map = stores.get(storeId);
    return {
      getString: key => {
        const value = map.get(key);
        return value === undefined ? undefined : String(value);
      },
      set: (key, value) => {
        map.set(key, String(value));
      },
      remove: key => map.delete(key),
      clearAll: () => {
        map.clear();
      },
      getAllKeys: () => Array.from(map.keys()),
      contains: key => map.has(key),
    };
  }
  return {createMMKV};
});

// --- react-native-reanimated / worklets ------------------------------
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const {View, Text, ScrollView} = require('react-native');
  return {
    __esModule: true,
    default: {
      View,
      Text,
      ScrollView,
      createAnimatedComponent: c => c,
    },
    useSharedValue: v => ({value: v}),
    useAnimatedStyle: fn => fn(),
    withTiming: v => v,
    withSpring: v => v,
    withDelay: (_d, v) => v,
    withSequence: (...args) => args[args.length - 1],
    runOnJS: fn => fn,
    runOnUI: fn => fn,
    Easing: {linear: v => v},
  };
});

jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(() => ({})),
  runOnJS: fn => fn,
  runOnUI: fn => fn,
}));

// --- @react-native-community/netinfo ---------------------------------
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(async () => ({
      isConnected: true,
      isInternetReachable: true,
    })),
  },
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// --- react-native-nitro-sound -----------------------------------------
// Default export is the Sound singleton; the screens call its methods
// directly. Metering values are dB (-160 silent to 0 loud), matching
// the real Android implementation.
//
// useSound / useSoundWithStates mirror the real hooks' observable
// behaviour: each call owns its state, progress comes from the
// addPlayBackListener callback (PlayBackType.duration and
// currentPosition, both ms) and end-of-track from
// addPlaybackEndListener, and the controls delegate to the Sound
// mock while updating state eagerly. Tests drive playback by
// invoking the listener captured via Sound.addPlayBackListener /
// Sound.addPlaybackEndListener.
jest.mock('react-native-nitro-sound', () => {
  const Sound = {
    mmss: jest.fn(() => '00:00'),
    mmssss: jest.fn(() => '00:00:00'),
    setSubscriptionDuration: jest.fn(() => {}),
    addRecordBackListener: jest.fn(),
    removeRecordBackListener: jest.fn(),
    addPlayBackListener: jest.fn(),
    removePlayBackListener: jest.fn(),
    addPlaybackEndListener: jest.fn(),
    removePlaybackEndListener: jest.fn(),
    startRecorder: jest.fn(async () => '/tmp/test-recording.m4a'),
    stopRecorder: jest.fn(async () => '/tmp/test-recording.m4a'),
    pauseRecorder: jest.fn(async () => '/tmp/test-recording.m4a'),
    resumeRecorder: jest.fn(async () => '/tmp/test-recording.m4a'),
    startPlayer: jest.fn(async () => '/tmp/test-recording.m4a'),
    stopPlayer: jest.fn(async () => {}),
    pausePlayer: jest.fn(async () => {}),
    resumePlayer: jest.fn(async () => {}),
    seekToPlayer: jest.fn(async () => {}),
    setVolume: jest.fn(async () => {}),
    setPlaybackSpeed: jest.fn(async () => {}),
  };

  function makeUseSoundHook(withStates) {
    return function useSoundMock(options = {}) {
      const React = require('react');
      const [isPlaying, setIsPlaying] = React.useState(false);
      const [isRecording, setIsRecording] = React.useState(false);
      const [playback, setPlayback] = React.useState({
        position: 0,
        duration: 0,
      });
      const [recording, setRecording] = React.useState({position: 0});
      // Flat shape (useSound): duration/position only move on seek,
      // matching the real hook, which never updates them from events.
      const [flatPosition, setFlatPosition] = React.useState(0);
      const [flatDuration, setFlatDuration] = React.useState(0);

      React.useEffect(() => {
        if (options.subscriptionDuration != null) {
          Sound.setSubscriptionDuration(options.subscriptionDuration);
        }
        const onPlay = e => {
          const ended = e.duration > 0 && e.currentPosition >= e.duration;
          options.onPlayback?.({...e, ended});
          setPlayback({
            position: Math.min(e.currentPosition ?? 0, e.duration ?? 0),
            duration: e.duration ?? 0,
          });
          if (ended) {
            setIsPlaying(false);
          }
        };
        const onEnd = e => {
          options.onPlayback?.({
            duration: e.duration,
            currentPosition: e.currentPosition,
            ended: true,
          });
          options.onPlaybackEnd?.(e);
          setIsPlaying(false);
          setPlayback({position: e.currentPosition, duration: e.duration});
        };
        Sound.addPlayBackListener(onPlay);
        Sound.addPlaybackEndListener(onEnd);
        return () => {
          Sound.removePlayBackListener();
          Sound.removePlaybackEndListener();
        };
        // Mirror the real hook: listeners attach once, on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);

      const startRecorder = React.useCallback(async (...args) => {
        const res = await Sound.startRecorder(...args);
        setIsRecording(true);
        return res;
      }, []);
      const pauseRecorder = React.useCallback(async () => {
        const res = await Sound.pauseRecorder();
        setIsRecording(false);
        return res;
      }, []);
      const resumeRecorder = React.useCallback(async () => {
        const res = await Sound.resumeRecorder();
        setIsRecording(true);
        return res;
      }, []);
      const stopRecorder = React.useCallback(async () => {
        const res = await Sound.stopRecorder();
        setIsRecording(false);
        return res;
      }, []);
      const startPlayer = React.useCallback(async (...args) => {
        const res = await Sound.startPlayer(...args);
        setIsPlaying(true);
        return res;
      }, []);
      const pausePlayer = React.useCallback(async () => {
        const res = await Sound.pausePlayer();
        setIsPlaying(false);
        return res;
      }, []);
      const resumePlayer = React.useCallback(async () => {
        const res = await Sound.resumePlayer();
        setIsPlaying(true);
        return res;
      }, []);
      const stopPlayer = React.useCallback(async () => {
        const res = await Sound.stopPlayer();
        setIsPlaying(false);
        setPlayback(s => ({...s, position: 0}));
        setFlatPosition(0);
        return res;
      }, []);
      const seekToPlayer = React.useCallback(async time => {
        const res = await Sound.seekToPlayer(time);
        setPlayback(s => ({...s, position: time}));
        setFlatPosition(time);
        return res;
      }, []);
      const setVolume = React.useCallback(async v => Sound.setVolume(v), []);
      const setPlaybackSpeed = React.useCallback(
        async sp => Sound.setPlaybackSpeed(sp),
        [],
      );
      const mmss = React.useCallback(secs => Sound.mmss(secs), []);
      const mmssss = React.useCallback(ms => Sound.mmssss(ms), []);
      const dispose = React.useCallback(() => {}, []);

      const state = withStates
        ? {isRecording, isPlaying, playback, recording}
        : {
            isRecording,
            isPlaying,
            duration: flatDuration,
            currentPosition: flatPosition,
          };

      return {
        sound: Sound,
        state,
        startRecorder,
        pauseRecorder,
        resumeRecorder,
        stopRecorder,
        startPlayer,
        pausePlayer,
        resumePlayer,
        stopPlayer,
        seekToPlayer,
        setVolume,
        setPlaybackSpeed,
        mmss,
        mmssss,
        dispose,
      };
    };
  }

  return {
    __esModule: true,
    default: Sound,
    Sound,
    createSound: jest.fn(() => Sound),
    useSound: makeUseSoundHook(false),
    useSoundWithStates: makeUseSoundHook(true),
  };
});

// --- @dr.pogodin/react-native-fs --------------------------------------
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp/prepsathi-documents',
  CachesDirectoryPath: '/tmp/prepsathi-caches',
  exists: jest.fn(async () => false),
  unlink: jest.fn(async () => {}),
  mkdir: jest.fn(async () => {}),
  moveFile: jest.fn(async () => {}),
  stat: jest.fn(async () => ({size: 0, isFile: () => true})),
  readDir: jest.fn(async () => []),
  downloadFile: jest.fn(() => ({
    jobId: 1,
    promise: Promise.resolve({jobId: 1, statusCode: 200, bytesWritten: 0}),
  })),
}));
