/**
 * Root navigator — one native stack, light header.
 * Guests see Auth; signed-in learners see the MainTabs bottom tabs
 * (Home, Vocabulary, Mock, Progress, Settings) with the feature
 * screens in the stack above them.
 */

import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {NavigationContainer} from '@react-navigation/native';
import React from 'react';
import {AuthScreen} from '../features/auth/AuthScreen';
import {useOfflineGuest} from '../features/auth/guestMode';
import {FeedbackScreen} from '../features/feedback/FeedbackScreen';
import {ListeningListScreen} from '../features/listening/ListeningListScreen';
import {ListeningTestScreen} from '../features/listening/ListeningTestScreen';
import {MockResultsScreen} from '../features/mock/MockResultsScreen';
import {MockRunnerScreen} from '../features/mock/MockRunnerScreen';
import {ReadingListScreen} from '../features/reading/ReadingListScreen';
import {ReadingTestScreen} from '../features/reading/ReadingTestScreen';
import {ResourcesScreen} from '../features/resources/ResourcesScreen';
import {PrivacyScreen} from '../features/settings/PrivacyScreen';
import {SpeakingHistoryScreen} from '../features/speaking/SpeakingHistoryScreen';
import {SpeakingListScreen} from '../features/speaking/SpeakingListScreen';
import {SpeakingSetScreen} from '../features/speaking/SpeakingSetScreen';
import {VocabularyReviewScreen} from '../features/vocab/VocabularyReviewScreen';
import {WritingListScreen} from '../features/writing/WritingListScreen';
import {WritingPromptScreen} from '../features/writing/WritingPromptScreen';
import {useAuthStore} from '../store/authStore';
import {colors} from '../theme/tokens';
import {Loading} from '../components/ui';
import {MainTabs} from './MainTabs';
import type {RootStackParamList} from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const screenOptions = {
  headerStyle: {backgroundColor: colors.surface},
  headerTintColor: colors.primary,
  headerTitleStyle: {fontWeight: '700' as const},
  headerShadowVisible: false,
  contentStyle: {backgroundColor: colors.background},
};

export function RootNavigator() {
  const status = useAuthStore(s => s.status);
  // A guest who chose "Continue offline" on Auth sees Home, not Auth;
  // practice is fully offline. Signing in (or logging out) clears it.
  const offlineGuest = useOfflineGuest(s => s.offlineGuest);

  if (status === 'loading') {
    return <Loading label="Opening PrepSathi…" />;
  }

  return (
    <NavigationContainer
      theme={{
        dark: false,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.ink,
          border: colors.border,
          notification: colors.gold,
        },
        fonts: {
          regular: {fontFamily: 'System', fontWeight: '400'},
          medium: {fontFamily: 'System', fontWeight: '500'},
          bold: {fontFamily: 'System', fontWeight: '700'},
          heavy: {fontFamily: 'System', fontWeight: '800'},
        },
      }}>
      <Stack.Navigator screenOptions={screenOptions}>
        {status === 'guest' && !offlineGuest ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{title: 'PrepSathi', headerShown: false}}
          />
        ) : (
          <>
            <Stack.Screen
              name="MainTabs"
              component={MainTabs}
              options={{title: 'PrepSathi'}}
            />
            <Stack.Screen
              name="ListeningList"
              component={ListeningListScreen}
              options={{title: 'Listening'}}
            />
            <Stack.Screen
              name="ListeningTest"
              component={ListeningTestScreen}
              options={{title: 'Listening test'}}
            />
            <Stack.Screen
              name="ReadingList"
              component={ReadingListScreen}
              options={{title: 'Reading'}}
            />
            <Stack.Screen
              name="ReadingTest"
              component={ReadingTestScreen}
              options={{title: 'Reading test'}}
            />
            <Stack.Screen
              name="WritingList"
              component={WritingListScreen}
              options={{title: 'Writing'}}
            />
            <Stack.Screen
              name="WritingPrompt"
              component={WritingPromptScreen}
              options={{title: 'Writing prompt'}}
            />
            <Stack.Screen
              name="SpeakingList"
              component={SpeakingListScreen}
              options={{title: 'Speaking'}}
            />
            <Stack.Screen
              name="SpeakingSet"
              component={SpeakingSetScreen}
              options={{title: 'Speaking set'}}
            />
            <Stack.Screen
              name="SpeakingHistory"
              component={SpeakingHistoryScreen}
              options={{title: 'My recordings'}}
            />
            <Stack.Screen
              name="VocabularyReview"
              component={VocabularyReviewScreen}
              options={{title: 'Review words'}}
            />
            <Stack.Screen
              name="MockRunner"
              component={MockRunnerScreen}
              options={{title: 'Mock test'}}
            />
            <Stack.Screen
              name="MockResults"
              component={MockResultsScreen}
              options={{title: 'Mock results'}}
            />
            <Stack.Screen
              name="Feedback"
              component={FeedbackScreen}
              options={{title: 'Send feedback'}}
            />
            <Stack.Screen
              name="Resources"
              component={ResourcesScreen}
              options={{title: 'Official resources'}}
            />
            <Stack.Screen
              name="Privacy"
              component={PrivacyScreen}
              options={{title: 'Privacy'}}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
