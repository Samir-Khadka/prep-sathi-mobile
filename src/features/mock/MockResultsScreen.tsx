/**
 * Mock results: section statuses (done/expired/pending), each
 * section's band, the overall band with the "practice estimate"
 * label, and a note when an expired Writing section means no overall
 * band is possible (mirrors the backend rule — an expired Writing
 * section can never produce a band, so the overall stays null).
 * Server detail when online; on-device stored results offline or
 * after a reload.
 */

import React, {useEffect, useState} from 'react';
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native';
import {
  AppButton,
  Body,
  Caption,
  Card,
  EmptyState,
  Heading,
  Loading,
  Screen,
  Title,
} from '@/components/ui';
import {getMock} from '@/api/client';
import type {MockDetailResponse} from '@/api/types';
import type {RootNavigation, RootStackParamList} from '@/navigation/types';
import {
  loadLocalMockResult,
  type LocalMockResult,
} from './mockSession';

function bandText(value: number | null | undefined): string {
  return value === null || value === undefined
    ? '—'
    : `Band ${value.toFixed(1)}`;
}

export function MockResultsScreen() {
  const navigation = useNavigation<RootNavigation>();
  const route = useRoute<RouteProp<RootStackParamList, 'MockResults'>>();
  const {mockId} = route.params;
  const [detail, setDetail] = useState<MockDetailResponse | null>(null);
  const [local] = useState<LocalMockResult | null>(() =>
    loadLocalMockResult(mockId),
  );
  const [loading, setLoading] = useState(mockId > 0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mockId <= 0) {
      return;
    }
    let cancelled = false;
    getMock(mockId)
      .then(res => {
        if (!cancelled) {
          setDetail(res);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setLoading(false);
          if (!(err instanceof TypeError)) {
            setError(
              err instanceof Error
                ? err.message
                : 'Could not load this mock.',
            );
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mockId]);

  if (loading) {
    return (
      <Screen>
        <Loading label="Loading your mock results…" />
      </Screen>
    );
  }

  if (!detail && !local) {
    return (
      <Screen>
        <Title>Mock results</Title>
        {error ? <Body>{error}</Body> : null}
        <EmptyState message="No results for this mock on this device yet — finish a mock sitting to see its results here." />
        <AppButton
          title="Back to mocks"
          variant="secondary"
          onPress={() => navigation.navigate('MainTabs', {screen: 'Mock'})}
          accessibilityLabel="Back to full mock tests"
        />
      </Screen>
    );
  }

  const track = detail?.track ?? local?.track ?? 'academic';
  const status = detail?.status ?? local?.status ?? 'in_progress';
  const currentSection = detail?.current_section ?? '';
  const overall = detail ? detail.overall_band : (local?.overall ?? null);

  const listening = detail
    ? {
        status: detail.sections.listening.status,
        scoreRaw: detail.sections.listening.score_raw,
        band: detail.sections.listening.band_estimate,
      }
    : local?.listening
      ? {
          status: local.listening.expired ? 'expired' : 'done',
          scoreRaw: local.listening.scoreRaw,
          band: local.listening.band,
        }
      : {status: 'pending', scoreRaw: null, band: null};
  const reading = detail
    ? {
        status: detail.sections.reading.status,
        scoreRaw: detail.sections.reading.score_raw,
        band: detail.sections.reading.band_estimate,
      }
    : local?.reading
      ? {
          status: local.reading.expired ? 'expired' : 'done',
          scoreRaw: local.reading.scoreRaw,
          band: local.reading.band,
        }
      : {status: 'pending', scoreRaw: null, band: null};
  const writing = detail
    ? {
        status: detail.sections.writing.status,
        bandLow: detail.sections.writing.band_low,
        bandHigh: detail.sections.writing.band_high,
      }
    : local?.writing
      ? {
          status: local.writing.expired ? 'expired' : 'done',
          bandLow: local.writing.bandLow,
          bandHigh: local.writing.bandHigh,
        }
      : {status: 'pending', bandLow: null, bandHigh: null};
  const speaking = detail
    ? {
        status: detail.sections.speaking.status,
        band: detail.sections.speaking.band_estimate,
      }
    : local?.speaking
      ? {
          status: 'done',
          band: local.speaking.band,
        }
      : {status: 'pending', band: null};

  const writingExpired = writing.status === 'expired';
  const wrongListening =
    local?.listening?.results.filter(r => !r.correct).map(r => r.no) ?? [];
  const wrongReading =
    local?.reading?.results.filter(r => !r.correct).map(r => r.no) ?? [];

  return (
    <Screen>
      <Title>
        Full mock results —{' '}
        {track === 'academic' ? 'Academic' : 'General Training'}
      </Title>
      <Body>
        {status === 'complete'
          ? 'Complete'
          : `In progress — ${currentSection || 'not finished'}`}
        {detail ? ` · started ${new Date(detail.started_at).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'})}` : ''}
        {!detail && local
          ? ` · started ${new Date(local.startedAt).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'})} · saved on this device`
          : ''}
      </Body>
      <Card>
        <Heading>Overall band</Heading>
        <Body>
          {overall !== null ? `Band ${overall.toFixed(1)}` : 'Pending'}
        </Body>
        <Caption>practice estimate, not an official score</Caption>
        {overall === null ? (
          <Body>
            {writingExpired
              ? 'Writing ran out of time, so it has no band range. An expired Writing section can never produce a band, so this mock has no overall band.'
              : speaking.status === 'done'
                ? 'A section expired before it could be scored, so there is no overall band for this mock.'
                : 'Complete Speaking to see your overall estimate.'}
          </Body>
        ) : null}
      </Card>
      <Card>
        <Heading>Listening — {listening.status}</Heading>
        <Body>
          {listening.scoreRaw !== null
            ? `${listening.scoreRaw} / 40 correct — `
            : ''}
          {bandText(listening.band)} · practice estimate, not an official
          score
          {listening.status === 'expired' ? ' (section ran out of time)' : ''}
        </Body>
        {wrongListening.length > 0 ? (
          <Caption>
            Questions to review: {wrongListening.join(', ')}
          </Caption>
        ) : null}
      </Card>
      <Card>
        <Heading>Reading — {reading.status}</Heading>
        <Body>
          {reading.scoreRaw !== null
            ? `${reading.scoreRaw} / 40 correct — `
            : ''}
          {bandText(reading.band)} · practice estimate, not an official
          score
          {reading.status === 'expired' ? ' (section ran out of time)' : ''}
        </Body>
        {wrongReading.length > 0 ? (
          <Caption>
            Questions to review: {wrongReading.join(', ')}
          </Caption>
        ) : null}
      </Card>
      <Card>
        <Heading>Writing — {writing.status}</Heading>
        <Body>
          {writing.bandLow !== null && writing.bandHigh !== null
            ? `Band ${writing.bandLow.toFixed(1)}–${writing.bandHigh.toFixed(1)} · practice estimate, not an official score`
            : 'No band yet'}
          {writing.status === 'expired' ? ' (section ran out of time)' : ''}
        </Body>
        {local?.writing && !local.writing.feedbackAvailable ? (
          <Caption>
            Detailed Writing feedback was not available for this sitting —{' '}
            {local.writing.expired
              ? 'the section ran out of time.'
              : 'the feedback is available online or once the on-device feedback lands.'}{' '}
            Words written: Task 1 {local.writing.task1Words}, Task 2{' '}
            {local.writing.task2Words}.
          </Caption>
        ) : local?.writing ? (
          <Caption>
            Words written: Task 1 {local.writing.task1Words}, Task 2{' '}
            {local.writing.task2Words}.
          </Caption>
        ) : null}
      </Card>
      <Card>
        <Heading>Speaking — {speaking.status}</Heading>
        <Body>
          {speaking.band !== null
            ? `${bandText(speaking.band)} · practice estimate, not an official score — from the on-device fluency range of your talk (timing signals only).`
            : 'No band yet — complete the Speaking section to add one.'}
        </Body>
        {local?.speaking?.bandLow !== null &&
        local?.speaking?.bandLow !== undefined &&
        local?.speaking?.bandHigh !== null ? (
          <Caption>
            Fluency range: Band {local.speaking.bandLow.toFixed(1)}–
            {local.speaking.bandHigh.toFixed(1)}
          </Caption>
        ) : null}
      </Card>
      {status !== 'complete' && currentSection !== 'done' && detail ? (
        <AppButton
          title="Resume mock"
          variant="secondary"
          onPress={() =>
            navigation.navigate('MockRunner', {
              mockId,
              track: track as 'academic' | 'general',
            })
          }
          accessibilityLabel="Resume this mock"
        />
      ) : null}
      <AppButton
        title="Back to mocks"
        variant="secondary"
        onPress={() => navigation.navigate('MainTabs', {screen: 'Mock'})}
        accessibilityLabel="Back to full mock tests"
      />
      <AppButton
        title="Back home"
        variant="ghost"
        onPress={() => navigation.navigate('MainTabs', {screen: 'Home'})}
        accessibilityLabel="Back home"
      />
    </Screen>
  );
}
