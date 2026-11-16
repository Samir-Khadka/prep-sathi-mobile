/**
 * Learner settings (Zustand 5 + MMKV): API base URL, Academic /
 * General Training track, and target bands.
 */

import {create} from 'zustand';
import {
  getApiBaseUrl,
  getTargetOverall,
  getTargetWriting,
  getTrack,
  setApiBaseUrl as persistApiBaseUrl,
  setTargetOverall as persistTargetOverall,
  setTargetWriting as persistTargetWriting,
  setTrack as persistTrack,
  type Track,
} from './storage';

interface SettingsState {
  apiBaseUrl: string;
  track: Track;
  targetBandOverall: number | null;
  targetBandWriting: number | null;
  setApiBaseUrl: (url: string) => void;
  setTrack: (track: Track) => void;
  setTargets: (overall: number | null, writing: number | null) => void;
}

export const useSettingsStore = create<SettingsState>()(() => ({
  apiBaseUrl: getApiBaseUrl(),
  track: getTrack(),
  targetBandOverall: getTargetOverall(),
  targetBandWriting: getTargetWriting(),

  setApiBaseUrl: url => {
    persistApiBaseUrl(url);
    useSettingsStore.setState({apiBaseUrl: getApiBaseUrl()});
  },

  setTrack: track => {
    persistTrack(track);
    useSettingsStore.setState({track});
  },

  setTargets: (overall, writing) => {
    persistTargetOverall(overall);
    persistTargetWriting(writing);
    useSettingsStore.setState({
      targetBandOverall: overall,
      targetBandWriting: writing,
    });
  },
}));
