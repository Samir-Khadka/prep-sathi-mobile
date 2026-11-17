/**
 * ReadingListScreen: track filter (Academic default from
 * settings, 6 tests; General Training, 2 tests) and mode picker
 * navigation to ReadingTest.
 */

import {fireEvent, render, screen} from '@testing-library/react-native';
import React from 'react';
import {storage} from '@/store/storage';
import {useSettingsStore} from '@/store/settingsStore';
import {ReadingListScreen} from '../ReadingListScreen';

jest.mock('@react-navigation/native', () => {
  const navigate = jest.fn();
  const goBack = jest.fn();
  (globalThis as unknown as Record<string, unknown>).__navMocks = {
    navigate,
    goBack,
  };
  return {
    useNavigation: () => ({navigate, goBack}),
    useRoute: () => ({params: {}}),
  };
});

function navMocks() {
  return (
    globalThis as unknown as Record<
      string,
      {navigate: jest.Mock; goBack: jest.Mock}
    >
  ).__navMocks;
}

describe('ReadingListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.clearAll();
    useSettingsStore.setState({track: 'academic'});
  });

  it('defaults to Academic with 6 tests', async () => {
    await render(<ReadingListScreen />);
    expect(screen.getByText('Reading')).toBeTruthy();
    for (const id of ['RA1', 'RA2', 'RA3', 'RA4', 'RA5', 'RA6']) {
      expect(screen.getByTestId(`reading-test-${id}`)).toBeTruthy();
    }
    expect(screen.queryByTestId('reading-test-RG1')).toBeNull();
    expect(
      screen.getAllByText(
        'Academic · 3 sections · 40 questions · 60 minutes',
      ),
    ).toHaveLength(6);
  });

  it('switches to General Training with the 2 GT tests and persists the track', async () => {
    await render(<ReadingListScreen />);
    // Press the option text: RNTL fires the press on the
    // Pressable by walking up from its Text child.
    await fireEvent.press(screen.getByText('General Training'));
    expect(screen.getByTestId('reading-test-RG1')).toBeTruthy();
    expect(screen.getByTestId('reading-test-RG2')).toBeTruthy();
    expect(screen.queryByTestId('reading-test-RA1')).toBeNull();
    expect(useSettingsStore.getState().track).toBe('general');
  });

  it('navigates timed and practice from the mode picker', async () => {
    await render(<ReadingListScreen />);
    await fireEvent.press(screen.getByText('Academic Reading Test 1'));
    await fireEvent.press(screen.getByText('Timed · 60:00'));
    expect(navMocks().navigate).toHaveBeenCalledWith('ReadingTest', {
      testId: 'RA1',
      mode: 'timed',
    });
    await fireEvent.press(screen.getByText('Practice · untimed'));
    expect(navMocks().navigate).toHaveBeenCalledWith('ReadingTest', {
      testId: 'RA1',
      mode: 'practice',
    });
  });
});
