/**
 * ListeningTestScreen: renders a full test from bundled content,
 * scores on-device and queues the attempt when the server is
 * unreachable, and uses the server score when a session exists.
 * No audio is faked: each part shows its transcript + audio note.
 */

import {act, fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import React from 'react';
import {
  startListening,
  submitListening,
} from '@/api/client';
import {storage} from '@/store/storage';
import {useSyncStore} from '@/store/syncStore';
import {ListeningTestScreen} from '../ListeningTestScreen';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  const goBack = jest.fn();
  (globalThis as unknown as Record<string, unknown>).__navMocks = {
    navigate,
    goBack,
  };
  return {
    useNavigation: () => ({navigate, goBack}),
    useRoute: () => ({
      params:
        (globalThis as unknown as Record<string, unknown>)
          .__routeParams ?? {},
    }),
  };
});

jest.mock('@/api/client', () => {
  class ApiError extends Error {
    status: number;
    detail: string;
    constructor(status: number, detail: string) {
      super(detail);
      this.name = 'ApiError';
      this.status = status;
      this.detail = detail;
    }
  }
  return {
    ApiError,
    startListening: jest.fn(),
    submitListening: jest.fn(),
    // Offline sync: posting the queued attempt fails, so it stays queued.
    recordAttempt: jest.fn(async () => {
      throw new TypeError('offline');
    }),
  };
});

function setRoute(params: Record<string, unknown>) {
  (globalThis as unknown as Record<string, unknown>).__routeParams = params;
}

const mockedStart = startListening as jest.Mock;
const mockedSubmit = submitListening as jest.Mock;

describe('ListeningTestScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.clearAll();
    useSyncStore.setState({pending: []});
    setRoute({testId: 'L1', mode: 'practice'});
    mockedStart.mockRejectedValue(new TypeError('offline'));
    mockedSubmit.mockRejectedValue(new TypeError('offline'));
  });

  it('shows parts with transcripts and audio notes, never audio', async () => {
    await render(<ListeningTestScreen />);
    expect(screen.getByText('Listening Test 1')).toBeTruthy();
    expect(screen.getByText('Part 1 — Joining a swimming course')).toBeTruthy();
    expect(screen.getByText('Part 4 — Sleep and memory')).toBeTruthy();
    expect(screen.getByTestId('transcript-part-1')).toBeTruthy();
    expect(
      screen.getAllByText('Audio coming soon — read the transcript'),
    ).toHaveLength(4);
    expect(screen.getAllByText(/Audio is pending/)).toHaveLength(4);
    expect(screen.getByText('Answered 0 of 40')).toBeTruthy();
  });

  it('counts down from 32:00 in timed mode', async () => {
    setRoute({testId: 'L1', mode: 'timed'});
    await render(<ListeningTestScreen />);
    expect(screen.getByTestId('test-countdown')).toBeTruthy();
    // A second may elapse during the async render, so accept 32:00 or 31:5x.
    expect(screen.getByText(/^3[12]:[0-5][0-9]$/)).toBeTruthy();
  });

  it('scores on-device and queues the attempt when the server is unreachable', async () => {
    await render(<ListeningTestScreen />);
    // Q1 (short): "half past nine" is correct.
    await fireEvent.changeText(screen.getByTestId('answer-1'), 'half past nine');
    // Q31 (mcq): option index 1 is correct.
    await fireEvent.press(
      screen.getByText('B. Sleep helps organise what we have learned'),
    );
    expect(screen.getByText('Answered 2 of 40')).toBeTruthy();

    await fireEvent.press(screen.getByText('Submit answers'));
    await waitFor(() => screen.getByTestId('results-summary'));
    expect(screen.getByText('Score: 2 / 40')).toBeTruthy();
    expect(screen.getByText('Band 1.0')).toBeTruthy();
    expect(screen.getByText(/Scored on this device/)).toBeTruthy();
    expect(screen.getByText('Question 31 — Correct')).toBeTruthy();
    expect(screen.getByText('Question 1 — Correct')).toBeTruthy();

    await waitFor(() =>
      expect(useSyncStore.getState().pending).toHaveLength(1),
    );
    const queued = useSyncStore.getState().pending[0];
    expect(queued.module).toBe('listening');
    expect(queued.score_raw).toBe(2);
    expect(queued.band_estimate).toBe(1.0);
  });

  it('uses the server score when a session exists', async () => {
    const now = new Date().toISOString();
    mockedStart.mockResolvedValue({
      session_id: 7,
      started_at: now,
      time_limit_seconds: null,
      expires_at: null,
    });
    mockedSubmit.mockResolvedValue({
      score_raw: 2,
      band_estimate: 1.0,
      band_label: 'practice estimate, not an official score',
      duration_seconds: 120,
      overtime: false,
      results: [
        {
          no: 1,
          correct: true,
          your_answer: 'half past nine',
          correct_answer: 'half past nine',
          explanation: 'The receptionist says half past nine.',
          evidence: 'RECEPTIONIST: The class starts at half past nine.',
        },
      ],
    });
    await render(<ListeningTestScreen />);
    // Let the start-session effect resolve and store the session id.
    await waitFor(() => {
      expect(mockedStart).toHaveBeenCalled();
    });
    await act(async () => {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), 0);
      });
    });

    await fireEvent.changeText(screen.getByTestId('answer-1'), 'half past nine');
    await fireEvent.press(screen.getByText('Submit answers'));
    await waitFor(() => screen.getByTestId('results-summary'));
    expect(screen.getByText('Score: 2 / 40')).toBeTruthy();
    expect(screen.getByText(/Scored by the PrepSathi server/)).toBeTruthy();
    expect(mockedSubmit).toHaveBeenCalledWith('L1', {
      session_id: 7,
      answers: {1: 'half past nine'},
    });
    expect(useSyncStore.getState().pending).toHaveLength(0);
  });

  it('shows a missing-test state for an unknown id', async () => {
    setRoute({testId: 'L99', mode: 'practice'});
    await render(<ListeningTestScreen />);
    expect(screen.getByText('That test could not be found.')).toBeTruthy();
  });
});
