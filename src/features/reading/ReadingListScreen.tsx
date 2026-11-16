/**
 * Reading list: bundled Reading tests for the chosen track
 * (Academic / General Training). The filter defaults to the
 * track in settings and updates it when changed. Tap a test
 * to pick a mode (Timed 60:00 / Practice untimed), then
 * navigate to ReadingTest. Works fully offline.
 */

import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {
  allReadingQuestions,
  readingTestsForTrack,
} from '@/content';
import {
  AppButton,
  Body,
  Caption,
  Card,
  EmptyState,
  OptionButton,
  Screen,
  Subheading,
  Title,
} from '@/components/ui';
import type {RootNavigation, RootStackParamList} from '@/navigation/types';
import {useSettingsStore} from '@/store/settingsStore';
import type {Track} from '@/store/storage';
import {spacing} from '@/theme/tokens';

type ReadingListRoute = RouteProp<RootStackParamList, 'ReadingList'>;

const TRACK_LABELS: Record<Track, string> = {
  academic: 'Academic',
  general: 'General Training',
};

export function ReadingListScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<ReadingListRoute>();
  const settingsTrack = useSettingsStore(state => state.track);
  const setSettingsTrack = useSettingsStore(state => state.setTrack);
  const [track, setTrack] = useState<Track>(
    route.params?.track ?? settingsTrack,
  );
  const [pickedId, setPickedId] = useState<string | null>(null);

  const tests = readingTestsForTrack(track);

  const changeTrack = (next: Track) => {
    setTrack(next);
    setSettingsTrack(next);
  };

  return (
    <Screen testID="reading-list">
      <Title>Reading</Title>
      <Body>
        Three passages, 40 questions, 60 minutes in timed mode. Choose
        your track, then pick a test.
      </Body>
      <View style={styles.trackRow} accessibilityRole="radiogroup">
        {(Object.keys(TRACK_LABELS) as Track[]).map(key => (
          <OptionButton
            key={key}
            label={TRACK_LABELS[key]}
            selected={track === key}
            onPress={() => changeTrack(key)}
            accessibilityLabel={`${TRACK_LABELS[key]} track`}
          />
        ))}
      </View>
      {tests.length === 0 ? (
        <EmptyState message={`No ${TRACK_LABELS[track]} Reading tests are bundled yet.`} />
      ) : null}
      {tests.map(test => {
        const total = allReadingQuestions(test).length;
        const picked = pickedId === test.id;
        return (
          <Card key={test.id} testID={`reading-test-${test.id}`}>
            <Pressable
              onPress={() => setPickedId(picked ? null : test.id)}
              accessibilityRole="button"
              accessibilityLabel={`${test.title}, ${TRACK_LABELS[test.track]}, 3 sections, ${total} questions, 60 minutes. Tap to choose a mode.`}
              accessibilityState={{expanded: picked}}>
              <Subheading>{test.title}</Subheading>
              <Caption>
                {TRACK_LABELS[test.track]} · 3 sections · {total} questions ·
                60 minutes
              </Caption>
              <Caption>
                {test.passages.map(passage => passage.title).join(' · ')}
              </Caption>
            </Pressable>
            {picked ? (
              <View style={styles.modeRow}>
                <AppButton
                  title="Timed · 60:00"
                  onPress={() =>
                    navigation.navigate('ReadingTest', {
                      testId: test.id,
                      mode: 'timed',
                    })
                  }
                  accessibilityLabel={`Start ${test.title} timed, 60 minutes`}
                  testID={`start-timed-${test.id}`}
                />
                <AppButton
                  title="Practice · untimed"
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate('ReadingTest', {
                      testId: test.id,
                      mode: 'practice',
                    })
                  }
                  accessibilityLabel={`Start ${test.title} in untimed practice mode`}
                  testID={`start-practice-${test.id}`}
                />
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  trackRow: {
    gap: spacing.sm,
  },
  modeRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
