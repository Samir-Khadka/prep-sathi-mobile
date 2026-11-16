/**
 * Full mock list: track picker, "Start a full mock", and past mocks.
 * Online: startMock on the server (it picks the pair + prompts) and
 * listMocks. Offline: a local mock from the bundled content using the
 * rotation in src/lib/mock.ts, recorded in the on-device mock
 * history. A mock in progress can be resumed.
 */

import React, {useState} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';
import {
  AppButton,
  Body,
  Caption,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  Title,
} from '@/components/ui';
import {listMocks, startMock} from '@/api/client';
import {queryKeys} from '@/api/queries';
import {useSettingsStore} from '@/store/settingsStore';
import {
  getMockHistory,
  setMockHistory,
  type Track,
} from '@/store/storage';
import type {RootNavigation} from '@/navigation/types';
import {
  buildOfflineMockPlan,
  saveLocalMockPlan,
} from './mockSession';

function statusLabel(status: string, currentSection: string): string {
  if (status === 'complete') {
    return 'Complete';
  }
  if (status === 'in_progress') {
    return `In progress — ${currentSection}`;
  }
  return status;
}

export function MockListScreen() {
  const navigation = useNavigation<RootNavigation>();
  const trackSetting = useSettingsStore(s => s.track);
  const setTrack = useSettingsStore(s => s.setTrack);
  const [track, setTrackState] = useState<Track>(trackSetting);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [localHistory, setLocalHistory] = useState(() => getMockHistory());

  const mocksQuery = useQuery({
    queryKey: queryKeys.mocks,
    queryFn: listMocks,
    retry: false,
  });
  const serverMocks = mocksQuery.data ?? null;
  const inProgress = serverMocks?.find(m => m.status === 'in_progress');

  function pickTrack(next: Track) {
    setTrackState(next);
    setTrack(next);
  }

  async function start() {
    setError('');
    setStarting(true);
    try {
      const started = await startMock(track);
      saveLocalMockPlan(started.mock_id, {
        track: track as Track,
        listeningTestId: started.listening_test_id,
        readingTestId: started.reading_test_id,
        writingTask1PromptId: started.writing_task1_prompt_id,
        writingTask2PromptId: started.writing_task2_prompt_id,
      });
      navigation.navigate('MockRunner', {
        mockId: started.mock_id,
        track: track as Track,
      });
    } catch (err) {
      if (err instanceof TypeError) {
        // Offline: build the same rotation locally from bundled content.
        const history = getMockHistory();
        const plan = buildOfflineMockPlan(track, history);
        const mockId = -Date.now();
        saveLocalMockPlan(mockId, plan);
        setMockHistory([
          ...history,
          {
            track,
            listeningTestId: plan.listeningTestId,
            readingTestId: plan.readingTestId,
            writingTask1PromptId: plan.writingTask1PromptId,
            writingTask2PromptId: plan.writingTask2PromptId,
            startedAt: Date.now(),
            serverMockId: null,
            status: 'in_progress',
          },
        ]);
        setLocalHistory(getMockHistory());
        navigation.navigate('MockRunner', {mockId, track});
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not start the mock.',
        );
      }
    } finally {
      setStarting(false);
    }
  }

  return (
    <Screen>
      <Title>Full mock tests</Title>
      <Body>
        Listening, Reading and Writing in one sitting, in test order, with
        no going back to a closed section — just like test day. A section
        that runs out of time is marked expired and the mock moves on, so
        a missed section never blocks the rest.
      </Body>
      <Card>
        <Body>Track</Body>
        <AppButton
          title="Academic"
          variant={track === 'academic' ? 'primary' : 'secondary'}
          onPress={() => pickTrack('academic')}
          accessibilityLabel="Choose Academic track"
        />
        <AppButton
          title="General Training"
          variant={track === 'general' ? 'primary' : 'secondary'}
          onPress={() => pickTrack('general')}
          accessibilityLabel="Choose General Training track"
        />
      </Card>
      {inProgress ? (
        <Card>
          <Body>
            You have a mock in progress ({inProgress.track},{' '}
            {inProgress.current_section}).
          </Body>
          <AppButton
            title="Resume it"
            variant="secondary"
            onPress={() =>
              navigation.navigate('MockRunner', {
                mockId: inProgress.mock_id,
                track: inProgress.track as Track,
              })
            }
            accessibilityLabel="Resume the mock in progress"
          />
        </Card>
      ) : null}
      <ErrorText message={error} />
      <AppButton
        title={starting ? 'Starting…' : 'Start a full mock'}
        onPress={() => void start()}
        disabled={starting}
        accessibilityLabel="Start a full mock test"
        testID="mock-start"
      />
      <Caption>
        {serverMocks === null && mocksQuery.isError
          ? 'Offline — showing mocks saved on this device.'
          : 'Your past mocks'}
      </Caption>
      {mocksQuery.isPending && !serverMocks ? <Loading label="Loading your mocks…" /> : null}
      {serverMocks !== null ? (
        serverMocks.length === 0 ? (
          <EmptyState message="No mocks yet. Your first full mock is the best way to see where you stand." />
        ) : (
          serverMocks.map(mock => (
            <Card key={mock.mock_id}>
              <Body>
                {mock.track === 'academic' ? 'Academic' : 'General Training'}{' '}
                · {new Date(mock.started_at).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'})}
              </Body>
              <Caption>
                {statusLabel(mock.status, mock.current_section)}
                {mock.overall_band !== null
                  ? ` · Band ${mock.overall_band.toFixed(1)} (practice estimate)`
                  : ''}
              </Caption>
              <AppButton
                title={mock.status === 'complete' ? 'View results' : 'Resume'}
                variant="secondary"
                onPress={() => {
                  if (mock.status === 'complete') {
                    navigation.navigate('MockResults', {mockId: mock.mock_id});
                  } else {
                    navigation.navigate('MockRunner', {
                      mockId: mock.mock_id,
                      track: mock.track as Track,
                    });
                  }
                }}
                accessibilityLabel={
                  mock.status === 'complete'
                    ? `View results for mock ${mock.mock_id}`
                    : `Resume mock ${mock.mock_id}`
                }
              />
            </Card>
          ))
        )
      ) : (
        localHistory.length === 0 ? (
          <EmptyState message="No mocks on this device yet." />
        ) : (
          [...localHistory].reverse().map(entry => (
            <Card key={`${entry.startedAt}-${entry.listeningTestId}`}>
              <Body>
                {entry.track === 'academic' ? 'Academic' : 'General Training'}{' '}
                · {new Date(entry.startedAt).toLocaleDateString(undefined, {day: 'numeric', month: 'short', year: 'numeric'})}
              </Body>
              <Caption>
                Listening {entry.listeningTestId} · Reading{' '}
                {entry.readingTestId} · saved on this device
              </Caption>
            </Card>
          ))
        )
      )}
    </Screen>
  );
}
