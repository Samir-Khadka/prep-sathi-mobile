/**
 * Home: greeting, the four module cards + Vocabulary + Full mock +
 * My progress, a dashboard summary strip (server when online, local
 * on-device progress when offline), a pending-sync badge, and links
 * to Settings, Resources, Feedback and Privacy.
 */

import React, {useState} from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  AppButton,
  BandChip,
  Body,
  Caption,
  Card,
  Heading,
  Screen,
  Title,
} from '@/components/ui';
import {useDashboard} from '@/api/queries';
import {useAuthStore} from '@/store/authStore';
import {useSettingsStore} from '@/store/settingsStore';
import {useSyncStore} from '@/store/syncStore';
import {getLocalVocab} from '@/store/storage';
import {colors, radius, spacing, typography} from '@/theme/tokens';
import type {RootNavigation, RootStackParamList} from '@/navigation/types';
import {useOfflineGuest} from '@/features/auth/guestMode';
import {summariseLocalProgress} from './localProgress';

type NavTarget = keyof RootStackParamList;

const MODULES: Array<{
  title: string;
  description: string;
  route: NavTarget;
  params?: object;
  label: string;
}> = [
  {
    title: 'Listening',
    description: '40 questions in 4 parts — 32 minutes, transcript shown.',
    route: 'ListeningList',
    label: 'Open Listening practice',
  },
  {
    title: 'Reading',
    description: '3 passages, 40 questions — 60 minutes.',
    route: 'ReadingList',
    label: 'Open Reading practice',
  },
  {
    title: 'Writing',
    description: 'Task 1 and Task 2 with feedback on the four criteria.',
    route: 'WritingList',
    label: 'Open Writing practice',
  },
  {
    title: 'Speaking',
    description: 'Cue-card sets with on-device recording and a fluency range.',
    route: 'SpeakingList',
    label: 'Open Speaking practice',
  },
  {
    title: 'Vocabulary',
    description: '350 words with spaced-repetition review.',
    route: 'Vocabulary',
    label: 'Open Vocabulary',
  },
  {
    title: 'Full mock',
    description:
      'Listening, Reading, Writing and Speaking in one sitting, in test order.',
    route: 'MockList',
    label: 'Open full mock tests',
  },
  {
    title: 'My progress',
    description: 'Attempts, latest bands and your overall estimate.',
    route: 'Dashboard',
    label: 'Open my progress dashboard',
  },
];

export function HomeScreen() {
  const navigation = useNavigation<RootNavigation>();
  const user = useAuthStore(s => s.user);
  const offlineGuest = useOfflineGuest(s => s.offlineGuest);
  const setOfflineGuest = useOfflineGuest(s => s.setOfflineGuest);
  const track = useSettingsStore(s => s.track);
  const pending = useSyncStore(s => s.pending);
  const syncPending = useSyncStore(s => s.syncPending);
  const syncing = useSyncStore(s => s.syncing);
  const [localVocab] = useState(() => getLocalVocab());
  const dashboard = useDashboard();
  const local = summariseLocalProgress(pending, localVocab);

  function go(item: (typeof MODULES)[number]) {
    // Each route named explicitly: navigate() needs a literal screen
    // name, not a union of them.
    switch (item.route) {
      case 'ListeningList':
        navigation.navigate('ListeningList');
        break;
      case 'ReadingList':
        navigation.navigate('ReadingList', {track});
        break;
      case 'WritingList':
        navigation.navigate('WritingList', {track});
        break;
      case 'SpeakingList':
        navigation.navigate('SpeakingList');
        break;
      case 'Vocabulary':
        navigation.navigate('Vocabulary');
        break;
      case 'MockList':
        navigation.navigate('MockList');
        break;
      case 'Dashboard':
        navigation.navigate('Dashboard');
        break;
      default:
        break;
    }
  }
  const name = user?.name?.trim() ? user.name.trim() : 'Learner';
  const server = dashboard.data ?? null;
  const showingLocal = !server;
  const latest = server
    ? server.latest_band_by_module
    : local.latestBandByModule;
  const overall = server ? server.overall_estimate : local.overallEstimate;
  const vocabDue = server ? server.vocabulary_due : local.vocabularyDue;

  return (
    <Screen>
      <Title>{`Namaste, ${name}`}</Title>
      <Body>
        {track === 'academic'
          ? 'Academic track — every band is a practice estimate, not an official score.'
          : 'General Training track — every band is a practice estimate, not an official score.'}
      </Body>
      {offlineGuest ? (
        <Card>
          <Body>
            You are practising offline as a guest. Your attempts are saved
            on this phone; sign in to save them to your account and sync
            them.
          </Body>
          <AppButton
            title="Sign in"
            variant="secondary"
            onPress={() => setOfflineGuest(false)}
            accessibilityLabel="Sign in to your account"
          />
        </Card>
      ) : null}
      {pending.length > 0 ? (
        <Card>
          <Body>
            {pending.length === 1
              ? '1 attempt waiting to sync.'
              : `${pending.length} attempts waiting to sync.`}
          </Body>
          {!offlineGuest ? (
            <AppButton
              title={syncing ? 'Syncing…' : 'Sync now'}
              variant="secondary"
              disabled={syncing}
              onPress={() => void syncPending()}
              accessibilityLabel="Sync pending attempts now"
            />
          ) : null}
        </Card>
      ) : null}
      <Card>
        <Heading>Your progress</Heading>
        {showingLocal ? (
          <Caption>Offline — showing on-device progress</Caption>
        ) : null}
        <View style={styles.bandRow}>
          {(['listening', 'reading', 'writing', 'speaking'] as const).map(
            module => (
              <View key={module} style={styles.bandCell}>
                <Text style={styles.moduleLabel}>{module}</Text>
                <Text style={styles.bandValue}>
                  {latest[module] !== null && latest[module] !== undefined
                    ? `Band ${Number(latest[module]).toFixed(1)}`
                    : '—'}
                </Text>
              </View>
            ),
          )}
        </View>
        <BandChip band={overall} />
        <Caption>
          {vocabDue > 0
            ? `${vocabDue} word${vocabDue === 1 ? '' : 's'} due for review.`
            : 'No vocabulary due right now.'}
        </Caption>
        <AppButton
          title="See full progress"
          variant="secondary"
          onPress={() => navigation.navigate('Dashboard')}
          accessibilityLabel="See full progress dashboard"
        />
      </Card>
      {MODULES.map(item => (
        <Pressable
          key={item.title}
          onPress={() => go(item)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          style={styles.moduleCard}>
          <Text style={styles.moduleTitle}>{item.title}</Text>
          <Text style={styles.moduleDescription}>{item.description}</Text>
        </Pressable>
      ))}
      <View style={styles.linkRow}>
        <AppButton
          title="Settings"
          variant="ghost"
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel="Open Settings"
        />
        <AppButton
          title="Resources"
          variant="ghost"
          onPress={() => navigation.navigate('Resources')}
          accessibilityLabel="Open official resources"
        />
        <AppButton
          title="Feedback"
          variant="ghost"
          onPress={() => navigation.navigate('Feedback')}
          accessibilityLabel="Send feedback"
        />
        <AppButton
          title="Privacy"
          variant="ghost"
          onPress={() => navigation.navigate('Privacy')}
          accessibilityLabel="Open privacy note"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bandCell: {
    flex: 1,
    minWidth: 70,
    gap: spacing.xs,
  },
  moduleLabel: {
    ...typography.caption,
    color: colors.inkMuted,
    textTransform: 'capitalize',
  },
  bandValue: {
    ...typography.subheading,
    color: colors.ink,
  },
  moduleCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  moduleTitle: {
    ...typography.subheading,
    color: colors.ink,
  },
  moduleDescription: {
    ...typography.body,
    color: colors.inkMuted,
  },
  linkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
