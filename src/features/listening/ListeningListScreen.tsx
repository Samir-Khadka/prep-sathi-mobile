/**
 * Listening list: the 4 bundled Listening tests.
 * Tap a test to pick a mode (Timed 32:00 / Practice untimed),
 * then navigate to ListeningTest. Works fully offline — the
 * content is bundled, and the server is never needed here.
 */

import {useNavigation} from '@react-navigation/native';
import React, {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {
  allListeningQuestions,
  listeningTests,
} from '@/content';
import {
  AppButton,
  Body,
  Caption,
  Card,
  Screen,
  Subheading,
  Title,
} from '@/components/ui';
import type {RootNavigation} from '@/navigation/types';
import {spacing} from '@/theme/tokens';

export function ListeningListScreen() {
  const navigation = useNavigation<RootNavigation>();
  const [pickedId, setPickedId] = useState<string | null>(null);

  return (
    <Screen testID="listening-list">
      <Title>Listening</Title>
      <Body>
        Four practice tests, 40 questions each. Audio is coming soon —
        for now, read each part&apos;s transcript and answer from it.
      </Body>
      {listeningTests.map(test => {
        const total = allListeningQuestions(test).length;
        const picked = pickedId === test.id;
        return (
          <Card key={test.id} testID={`listening-test-${test.id}`}>
            <Pressable
              onPress={() => setPickedId(picked ? null : test.id)}
              accessibilityRole="button"
              accessibilityLabel={`${test.title}, 4 parts, ${total} questions, about 30 minutes. Tap to choose a mode.`}
              accessibilityState={{expanded: picked}}>
              <Subheading>{test.title}</Subheading>
              <Caption>
                4 parts · {total} questions · about 30 minutes
              </Caption>
              <Caption>
                {test.parts.map(part => part.title).join(' · ')}
              </Caption>
            </Pressable>
            {picked ? (
              <View style={styles.modeRow}>
                <AppButton
                  title="Timed · 32:00"
                  onPress={() =>
                    navigation.navigate('ListeningTest', {
                      testId: test.id,
                      mode: 'timed',
                    })
                  }
                  accessibilityLabel={`Start ${test.title} timed, 32 minutes`}
                  testID={`start-timed-${test.id}`}
                />
                <AppButton
                  title="Practice · untimed"
                  variant="secondary"
                  onPress={() =>
                    navigation.navigate('ListeningTest', {
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
  modeRow: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
});
