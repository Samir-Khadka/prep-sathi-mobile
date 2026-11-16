/**
 * Speaking list — the 15 bundled speaking sets, plus a link to the
 * on-device recording history. Recordings never leave the device.
 */

import {useNavigation} from '@react-navigation/native';
import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  AppButton,
  Body,
  Card,
  Screen,
  Title,
} from '../../components/ui';
import {speakingSets} from '../../content';
import type {RootNavigation} from '../../navigation/types';
import {colors, radius, spacing, typography} from '../../theme/tokens';

export function SpeakingListScreen() {
  const navigation = useNavigation<RootNavigation>();

  return (
    <Screen>
      <Title>Speaking</Title>
      <Body>
        Fifteen speaking sets. Each one has Part 1 questions, a Part 2
        cue card with a 60-second preparation and a 2-minute talk, Part
        3 questions, and a sample answer. You can record yourself and
        get a fluency estimate from timing only — recordings stay on
        this device.
      </Body>
      <AppButton
        title="My recordings"
        variant="secondary"
        onPress={() => navigation.navigate('SpeakingHistory')}
        accessibilityLabel="Open my speaking recordings"
      />
      <Card>
        <View style={styles.list}>
          {speakingSets.map((set, index) => (
            <Pressable
              key={set.id}
              onPress={() =>
                navigation.navigate('SpeakingSet', {setId: set.id})
              }
              accessibilityRole="button"
              accessibilityLabel={`Speaking set ${index + 1}: ${set.topic}`}
              style={({pressed}) => [
                styles.row,
                pressed && styles.rowPressed,
              ]}>
              <Text style={styles.rowNumber}>{index + 1}</Text>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>{set.topic}</Text>
                <Text style={styles.rowMeta}>
                  Part 1 · Part 2 cue card · Part 3
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowNumber: {
    ...typography.heading,
    color: colors.primary,
    minWidth: 28,
    textAlign: 'center',
  },
  rowText: {
    flex: 1,
    gap: spacing.xs,
  },
  rowTitle: {
    ...typography.subheading,
    color: colors.ink,
  },
  rowMeta: {
    ...typography.caption,
    color: colors.inkMuted,
  },
});
