/**
 * Typed navigation params for the whole app.
 * Every screen's params are declared here — no untyped navigation.
 */

import type {NativeStackNavigationProp} from '@react-navigation/native-stack';

export type RootStackParamList = {
  Auth: undefined;
  Home: undefined;
  Dashboard: undefined;
  ListeningList: undefined;
  ListeningTest: {testId: string; mode: 'timed' | 'practice'};
  ReadingList: {track?: 'academic' | 'general'};
  ReadingTest: {testId: string; mode: 'timed' | 'practice'};
  WritingList: {track?: 'academic' | 'general'};
  WritingPrompt: {promptId: string};
  SpeakingList: undefined;
  SpeakingSet: {setId: string};
  SpeakingHistory: undefined;
  Vocabulary: undefined;
  VocabularyReview: undefined;
  MockList: undefined;
  MockRunner: {mockId: number; track: 'academic' | 'general'};
  MockResults: {mockId: number};
  Feedback: undefined;
  Resources: undefined;
  Privacy: undefined;
  Settings: undefined;
};

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
