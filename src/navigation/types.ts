/**
 * Typed navigation params for the whole app.
 * Every screen's params are declared here — no untyped navigation.
 */

import type {NavigatorScreenParams} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

/**
 * The five bottom tabs. Route names are the tab names (Home,
 * Vocabulary, Mock, Progress, Settings) — the screens they render
 * keep their feature names (HomeScreen, VocabularyScreen,
 * MockListScreen, DashboardScreen, SettingsScreen).
 */
export type MainTabParamList = {
  Home: undefined;
  Vocabulary: undefined;
  Mock: undefined;
  Progress: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  /**
   * The tab navigator, rendered as the stack's initial screen for
   * signed-in learners (and offline guests). Its params are the
   * nested tab params — stack screens reach a tab with
   * navigate('MainTabs', {screen: 'Vocabulary'}) because a bare
   * navigate('Vocabulary') from a stack screen does NOT descend
   * into the focused child navigator (navigationInChildEnabled
   * defaults to false in @react-navigation/core's useOnAction).
   */
  MainTabs: NavigatorScreenParams<MainTabParamList>;
  /**
   * Tab routes, kept here at type level only — they are rendered by
   * MainTabs, not by this stack. Screens typed with RootNavigation
   * (e.g. HomeScreen, which lives inside the tabs) navigate to them
   * by bare name and the tab navigator handles it; stack screens
   * must use the nested MainTabs form above.
   */
  Home: undefined;
  Vocabulary: undefined;
  Mock: undefined;
  Progress: undefined;
  Settings: undefined;
  ListeningList: undefined;
  ListeningTest: {testId: string; mode: 'timed' | 'practice'};
  ReadingList: {track?: 'academic' | 'general'};
  ReadingTest: {testId: string; mode: 'timed' | 'practice'};
  WritingList: {track?: 'academic' | 'general'};
  WritingPrompt: {promptId: string};
  SpeakingList: undefined;
  SpeakingSet: {setId: string};
  SpeakingHistory: undefined;
  VocabularyReview: undefined;
  MockRunner: {mockId: number; track: 'academic' | 'general'};
  MockResults: {mockId: number};
  Feedback: undefined;
  Resources: undefined;
  Privacy: undefined;
};

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
