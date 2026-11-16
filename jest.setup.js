/**
 * Jest setup: in-memory mocks for native modules that cannot run in
 * the Jest (Node) environment. Pure-logic tests (scoring, spaced
 * repetition, fluency, feedback, content) run against the real code;
 * anything touching MMKV, recording or the filesystem uses these.
 */

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

// --- react-native-audio-recorder-player ------------------------------
jest.mock('react-native-audio-recorder-player', () => {
  class AudioRecorderPlayer {
    addRecordBackListener = jest.fn();
    removeRecordBackListener = jest.fn();
    addPlayBackListener = jest.fn();
    removePlayBackListener = jest.fn();
    startRecorder = jest.fn(async () => '/tmp/test-recording.m4a');
    stopRecorder = jest.fn(async () => '/tmp/test-recording.m4a');
    startPlayer = jest.fn(async () => '/tmp/test-recording.m4a');
    stopPlayer = jest.fn(async () => {});
    pausePlayer = jest.fn(async () => {});
    resumePlayer = jest.fn(async () => {});
    setVolume = jest.fn(async () => {});
    setSubscriptionDuration = jest.fn(() => {});
  }
  return {__esModule: true, default: AudioRecorderPlayer};
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
}));
