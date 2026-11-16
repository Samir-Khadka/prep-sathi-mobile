/**
 * ReadingTestScreen: renders a full test from bundled content
 * (General Training here, so the GT band table applies), scores
 * on-device and queues the attempt when the server is unreachable.
 */

import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import React from 'react';
import {
  startReading,
  submitReading,
} from '@/api/client';
import {storage} from '@/store/storage';
import {useSyncStore} from '@/store/syncStore';
import {ReadingTestScreen} from '../ReadingTestScreen';

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
    startReading: jest.fn(),
    submitReading: jest.fn(),
    // Offline sync: posting the queued attempt fails, so it stays queued.
    recordAttempt: jest.fn(async () => {
      throw new TypeError('offline');
    }),
  };
});

function setRoute(params: Record<string, unknown>) {
  (globalThis as unknown as Record<string, unknown>).__routeParams = params;
}

const mockedStart = startReading as jest.Mock;
const mockedSubmit = submitReading as jest.Mock;

describe('ReadingTestScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.clearAll();
    useSyncStore.setState({pending: []});
    setRoute({testId: 'RG1', mode: 'practice'});
    mockedStart.mockRejectedValue(new TypeError('offline'));
    mockedSubmit.mockRejectedValue(new TypeError('offline'));
  });

  it('shows passages with full text and their questions', async () => {
    await render(<ReadingTestScreen />);
    expect(screen.getByText('General Training Reading Test 1')).toBeTruthy();
    expect(screen.getByText('Section 1 — Everyday Notices')).toBeTruthy();
    expect(
      screen.getByText(
        'Section 3 — Neither Rain nor Snow: The Story of the Postal Service',
      ),
    ).toBeTruthy();
    expect(screen.getByTestId('passage-1')).toBeTruthy();
    expect(screen.getByText('Answered 0 of 40')).toBeTruthy();
  });

  it('counts down from 60:00 in timed mode', async () => {
    setRoute({testId: 'RG1', mode: 'timed'});
    await render(<ReadingTestScreen />);
    expect(screen.getByTestId('test-countdown')).toBeTruthy();
    // A second may elapse during the async render, so accept 60:00 or 59:5x.
    expect(screen.getByText(/^[56][0-9]:[0-5][0-9]$/)).toBeTruthy();
  });

  it('scores on-device with the GT band table and queues the attempt offline', async () => {
    await render(<ReadingTestScreen />);
    // Q1 (tfng): FALSE is correct. Q14 (mcq): "25 days" (index 1) is correct.
    // Press option text: RNTL fires the press on the Pressable by
    // walking up from its Text child.
    await fireEvent.press(screen.getAllByText('FALSE')[0]);
    await fireEvent.press(screen.getByText('B. 25 days'));
    expect(screen.getByText('Answered 2 of 40')).toBeTruthy();

    await fireEvent.press(screen.getByText('Submit answers'));
    await waitFor(() => screen.getByTestId('results-summary'));
    expect(screen.getByText('Score: 2 / 40')).toBeTruthy();
    expect(screen.getByText('Band 1.0')).toBeTruthy();
    expect(screen.getByText(/Scored on this device/)).toBeTruthy();
    expect(screen.getByText('Question 1 — Correct')).toBeTruthy();
    expect(screen.getByText('Question 14 — Correct')).toBeTruthy();
    // Evidence-linked explanations are shown per question. (The
    // sentence also occurs in the passage text, so it appears twice.)
    expect(
      screen.getAllByText(
        /The library is closed on Sundays and public holidays/,
      ).length,
    ).toBeGreaterThanOrEqual(2);

    await waitFor(() =>
      expect(useSyncStore.getState().pending).toHaveLength(1),
    );
    const queued = useSyncStore.getState().pending[0];
    expect(queued.module).toBe('reading');
    expect(queued.score_raw).toBe(2);
    expect(queued.band_estimate).toBe(1.0);
  });

  it('shows a missing-test state for an unknown id', async () => {
    setRoute({testId: 'RA99', mode: 'practice'});
    await render(<ReadingTestScreen />);
    expect(screen.getByText('That test could not be found.')).toBeTruthy();
  });
});
