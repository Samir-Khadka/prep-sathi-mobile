/**
 * Full progress view: attempts total + by module, latest band per
 * module, overall estimate, target bands, vocabulary total/due, and
 * the last 10 attempts. Server dashboard when online; offline
 * fallback from the on-device sync queue and local vocabulary, with
 * a clear "Offline — showing on-device progress" note.
 */

import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  BandChip,
  Body,
  Caption,
  Card,
  EmptyState,
  Heading,
  Loading,
  Screen,
  SectionHeader,
  Title,
} from '@/components/ui';
import {useDashboard} from '@/api/queries';
import {useSettingsStore} from '@/store/settingsStore';
import {useSyncStore} from '@/store/syncStore';
import {getLocalVocab} from '@/store/storage';
import {colors, spacing, typography} from '@/theme/tokens';
import {summariseLocalProgress} from './localProgress';

const MODULE_LABELS: Record<string, string> = {
  listening: 'Listening',
  reading: 'Reading',
  writing: 'Writing',
  speaking: 'Speaking',
};

function formatDate(value: string | number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function DashboardScreen() {
  const dashboard = useDashboard();
  const pending = useSyncStore(s => s.pending);
  const targetOverall = useSettingsStore(s => s.targetBandOverall);
  const targetWriting = useSettingsStore(s => s.targetBandWriting);
  const [localVocab] = useState(() => getLocalVocab());

  if (dashboard.isPending && !dashboard.data) {
    return (
      <Screen>
        <Loading label="Loading your progress…" />
      </Screen>
    );
  }

  const server = dashboard.data ?? null;
  const local = summariseLocalProgress(pending, localVocab);
  const showingLocal = !server;

  const attemptsTotal = server
    ? server.attempts_total
    : local.attemptsTotal;
  const attemptsByModule = server
    ? server.attempts_by_module
    : local.attemptsByModule;
  const latest = server
    ? server.latest_band_by_module
    : local.latestBandByModule;
  const overall = server ? server.overall_estimate : local.overallEstimate;
  const vocabTotal = server ? server.vocabulary_total : local.vocabularyTotal;
  const vocabDue = server ? server.vocabulary_due : local.vocabularyDue;
  const targets = {
    overall: server?.target_band_overall ?? targetOverall,
    writing: server?.target_band_writing ?? targetWriting,
  };

  return (
    <Screen>
      <Title>My progress</Title>
      {showingLocal ? (
        <Body>Offline — showing on-device progress</Body>
      ) : null}
      <Card>
        <Heading>Overall estimate</Heading>
        <BandChip band={overall} />
        {overall === null ? (
          <Body>
            Practise all four modules to see an overall estimate — it
            needs a latest band in Listening, Reading, Writing and
            Speaking.
          </Body>
        ) : null}
        <Body>
          Target overall:{' '}
          {targets.overall !== null && targets.overall !== undefined
            ? `Band ${Number(targets.overall).toFixed(1)}`
            : 'not set — set it in Settings'}
        </Body>
        <Body>
          Target Writing:{' '}
          {targets.writing !== null && targets.writing !== undefined
            ? `Band ${Number(targets.writing).toFixed(1)}`
            : 'not set — set it in Settings'}
        </Body>
      </Card>
      <Card>
        <Heading>Attempts</Heading>
        <Body>
          {attemptsTotal} attempt{attemptsTotal === 1 ? '' : 's'} in total
          {showingLocal && pending.length > 0
            ? ` (${pending.length} waiting to sync)`
            : ''}
        </Body>
        {Object.keys(attemptsByModule).length === 0 ? (
          <Caption>No attempts yet — your first test will appear here.</Caption>
        ) : (
          Object.entries(attemptsByModule).map(([module, count]) => (
            <View key={module} style={styles.row}>
              <Text style={styles.rowLabel}>
                {MODULE_LABELS[module] ?? module}
              </Text>
              <Text style={styles.rowValue}>{count}</Text>
            </View>
          ))
        )}
      </Card>
      <Card>
        <Heading>Latest band per module</Heading>
        {(['listening', 'reading', 'writing', 'speaking'] as const).map(
          module => (
            <View key={module} style={styles.row}>
              <Text style={styles.rowLabel}>{MODULE_LABELS[module]}</Text>
              <Text style={styles.rowValue}>
                {latest[module] !== null && latest[module] !== undefined
                  ? `Band ${Number(latest[module]).toFixed(1)}`
                  : '—'}
              </Text>
            </View>
          ),
        )}
        <Caption>
          Every band is a practice estimate, not an official score.
        </Caption>
      </Card>
      <Card>
        <Heading>Vocabulary</Heading>
        <Body>
          {vocabTotal} word{vocabTotal === 1 ? '' : 's'} in your deck ·{' '}
          {vocabDue} due for review
        </Body>
      </Card>
      <SectionHeader>Recent attempts</SectionHeader>
      {server ? (
        server.attempts_recent.length === 0 ? (
          <EmptyState message="No attempts yet." />
        ) : (
          server.attempts_recent.map(attempt => (
            <Card key={attempt.id}>
              <Body>
                {MODULE_LABELS[attempt.module] ?? attempt.module} ·{' '}
                {attempt.kind === 'mock' ? 'mock' : 'practice'}
              </Body>
              <Caption>
                {attempt.band_estimate !== null
                  ? `Band ${Number(attempt.band_estimate).toFixed(1)}`
                  : attempt.score_raw !== null
                    ? `${attempt.score_raw} / 40`
                    : 'No band yet'}{' '}
                · {formatDate(attempt.created_at)}
              </Caption>
            </Card>
          ))
        )
      ) : local.recent.length === 0 ? (
        <EmptyState message="No attempts on this device yet." />
      ) : (
        local.recent.map(attempt => (
          <Card key={attempt.localId}>
            <Body>
              {MODULE_LABELS[attempt.module] ?? attempt.module} ·{' '}
              {attempt.kind === 'mock' ? 'mock' : 'practice'} · waiting to
              sync
            </Body>
            <Caption>
              {attempt.band_estimate !== null
                ? `Band ${Number(attempt.band_estimate).toFixed(1)}`
                : attempt.score_raw !== null
                  ? `${attempt.score_raw} / 40`
                  : 'No band yet'}{' '}
              · {formatDate(attempt.createdAt)}
            </Caption>
          </Card>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowLabel: {
    ...typography.body,
    color: colors.ink,
  },
  rowValue: {
    ...typography.body,
    color: colors.ink,
    fontWeight: '700',
  },
});
