/**
 * MainTabs: the five bottom tabs render, switch screens, and keep
 * navigation working from inside the tabs and from stack screens
 * above them. Renders the real RootNavigator — no navigation mocks,
 * so a broken route name fails here, not on a phone.
 *
 * The queries hit the real API client and fail offline; the screens
 * fall back to on-device data, which is the behaviour under test.
 */

import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import React from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {RootNavigator} from '../RootNavigator';
import {useAuthStore} from '../../store/authStore';
import {setLocalVocab} from '../../store/storage';

jest.setTimeout(30000);

// The screens under test hit the real API client. Mock fetch to fail
// immediately: the behaviour under test is the offline fallback to
// on-device data, and a real request would both depend on the network
// and leave undici's keep-alive socket open, so Jest never exits
// (CI runs without --forceExit).
beforeEach(() => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new TypeError('Network request failed'));
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderSignedIn() {
  useAuthStore.setState({
    status: 'authed',
    user: {
      id: 1,
      email: 'test@example.com',
      name: 'Test',
      target_band_overall: null,
      target_band_writing: null,
    },
  });
  const queryClient = new QueryClient({
    // gcTime 0: a real query that loses its last observer schedules
    // a GC timer for the default 5 minutes, and that timer keeps
    // Node alive — Jest would never exit (CI runs without
    // --forceExit). The app's own client keeps the default.
    defaultOptions: {queries: {retry: false, gcTime: 0}},
  });
  // SafeAreaProvider only renders children once insets exist; in
  // Jest the native onInsetsChange never fires, so pass zero
  // initial metrics instead of mocking the provider.
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: {x: 0, y: 0, width: 390, height: 844},
        insets: {top: 0, left: 0, right: 0, bottom: 0},
      }}>
      <QueryClientProvider client={queryClient}>
        <RootNavigator />
      </QueryClientProvider>
    </SafeAreaProvider>,
  );
}

/** The tab bar button for a tab: on iOS its label is "X, tab, N of 5". */
function tabButton(label: string) {
  return screen.getByLabelText(new RegExp(`^${label}, tab, \\d of 5$`));
}

describe('MainTabs', () => {
  it('renders all five tab labels with Home active first', async () => {
    await renderSignedIn();
    await waitFor(() =>
      expect(screen.getByText('Namaste, Test')).toBeTruthy(),
    );
    // 'Home', 'Mock' and 'Progress' appear only as tab labels;
    // 'Vocabulary' and 'Settings' also appear as Home module/link text.
    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.getByText('Mock')).toBeTruthy();
    expect(screen.getByText('Progress')).toBeTruthy();
    expect(screen.getAllByText('Vocabulary').length).toBeGreaterThanOrEqual(
      2,
    );
    expect(screen.getAllByText('Settings').length).toBeGreaterThanOrEqual(2);
    expect(tabButton('Home')).toBeTruthy();
    expect(tabButton('Vocabulary')).toBeTruthy();
    expect(tabButton('Mock')).toBeTruthy();
    expect(tabButton('Progress')).toBeTruthy();
    expect(tabButton('Settings')).toBeTruthy();
  });

  it('pressing a tab switches screens', async () => {
    await renderSignedIn();
    await waitFor(() =>
      expect(screen.getByText('Namaste, Test')).toBeTruthy(),
    );

    fireEvent.press(tabButton('Vocabulary'));
    await waitFor(() =>
      expect(
        screen.getByLabelText('Open vocabulary review'),
      ).toBeTruthy(),
    );

    fireEvent.press(tabButton('Progress'));
    // Dashboard shows a loading state until its (offline-failing)
    // query settles, so allow longer than waitFor's 1s default.
    await waitFor(() => expect(screen.getByText('My progress')).toBeTruthy(), {
      timeout: 15000,
    });
    expect(screen.getByText('Overall estimate')).toBeTruthy();

    fireEvent.press(tabButton('Mock'));
    await waitFor(() => expect(screen.getByTestId('mock-start')).toBeTruthy());

    fireEvent.press(tabButton('Settings'));
    await waitFor(() =>
      expect(screen.getByTestId('settings-api-url')).toBeTruthy(),
    );

    fireEvent.press(tabButton('Home'));
    await waitFor(() =>
      expect(screen.getByText('Namaste, Test')).toBeTruthy(),
    );
  });

  it('a Home module-card press navigates to a detail screen from inside the tabs', async () => {
    await renderSignedIn();
    await waitFor(() =>
      expect(screen.getByText('Namaste, Test')).toBeTruthy(),
    );

    fireEvent.press(screen.getByLabelText('Open Listening practice'));
    await waitFor(() =>
      expect(screen.getByTestId('listening-test-L1')).toBeTruthy(),
    );
    // The tab bar is covered by the pushed stack screen, so there is
    // no tab to press here — the detail screen itself proves the
    // module card navigated from inside the tabs.
  });

  it('navigating to a tab screen from a stack screen works', async () => {
    // The bundled seed marks all 350 words due, so a review would
    // need 350 answers; instead seed one word that is not due yet,
    // so the review screen lands on "Review complete" at once and
    // its "Back to Vocabulary" button is rendered immediately.
    setLocalVocab([
      {
        word: 'test',
        meaning: 'a trial',
        example: '',
        topic: 'general',
        intervalDays: 1,
        nextReviewMs: Date.now() + 86400000,
        serverId: null,
        createdAt: Date.now(),
      },
    ]);
    await renderSignedIn();
    await waitFor(() =>
      expect(screen.getByText('Namaste, Test')).toBeTruthy(),
    );

    // Vocabulary tab -> review (a stack screen above the tabs) ...
    fireEvent.press(tabButton('Vocabulary'));
    await waitFor(() =>
      expect(
        screen.getByLabelText('Open vocabulary review'),
      ).toBeTruthy(),
    );
    fireEvent.press(screen.getByLabelText('Open vocabulary review'));
    await waitFor(() =>
      expect(screen.getByLabelText('Back to vocabulary list')).toBeTruthy(),
    );

    // ... and back to the Vocabulary tab from that stack screen.
    // VocabularyReview navigates via navigate('MainTabs',
    // {screen: 'Vocabulary'}); a bare navigate('Vocabulary') would
    // not descend into the tabs from a stack screen.
    fireEvent.press(screen.getByLabelText('Back to vocabulary list'));
    await waitFor(() =>
      expect(
        screen.getByLabelText('Open vocabulary review'),
      ).toBeTruthy(),
    );
    expect(tabButton('Vocabulary')).toBeTruthy();
  });
});
