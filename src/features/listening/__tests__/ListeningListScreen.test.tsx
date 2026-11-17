/**
 * ListeningListScreen: lists the 4 bundled tests, opens a mode
 * picker per test, and navigates to ListeningTest with the
 * chosen mode.
 */

import {fireEvent, render, screen} from '@testing-library/react-native';
import React from 'react';
import {ListeningListScreen} from '../ListeningListScreen';

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

describe('ListeningListScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists all 8 bundled Listening tests with their shape', async () => {
    await render(<ListeningListScreen />);
    expect(screen.getByText('Listening')).toBeTruthy();
    for (const id of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8']) {
      expect(screen.getByTestId(`listening-test-${id}`)).toBeTruthy();
    }
    expect(
      screen.getAllByText('4 parts · 40 questions · about 30 minutes'),
    ).toHaveLength(8);
  });

  it('navigates timed and practice from the mode picker', async () => {
    await render(<ListeningListScreen />);
    // Press the card title text: RNTL fires the press on the
    // Pressable by walking up from its Text child.
    await fireEvent.press(screen.getByText('Listening Test 1'));
    await fireEvent.press(screen.getByText('Timed · 32:00'));
    expect(navMocks().navigate).toHaveBeenCalledWith('ListeningTest', {
      testId: 'L1',
      mode: 'timed',
    });

    await fireEvent.press(screen.getByText('Practice · untimed'));
    expect(navMocks().navigate).toHaveBeenCalledWith('ListeningTest', {
      testId: 'L1',
      mode: 'practice',
    });
  });
});
