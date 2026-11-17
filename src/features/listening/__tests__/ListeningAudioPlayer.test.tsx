/**
 * ListeningAudioPlayer: cached playback, on-demand download,
 * offline fallback, progress/seek, error states, and the
 * single-player rule. The nitro-sound hook is the shared Jest mock
 * (jest.setup.js): progress is driven by invoking the listener
 * captured via Sound.addPlayBackListener, end-of-track via
 * Sound.addPlaybackEndListener.
 */

import NetInfo from '@react-native-community/netinfo';
import {fireEvent, render, screen, waitFor} from '@testing-library/react-native';
import {
  DocumentDirectoryPath,
  downloadFile,
  exists,
} from '@dr.pogodin/react-native-fs';
import Sound from 'react-native-nitro-sound';
import React from 'react';
import {
  ListeningAudioPlayer,
  formatPlaybackTime,
} from '../ListeningAudioPlayer';
import {resetPlaybackManagerForTests} from '../playbackManager';

const mockedExists = exists as jest.Mock;
const mockedDownloadFile = downloadFile as jest.Mock;
const mockedNetFetch = NetInfo.fetch as jest.Mock;
const mockedStartPlayer = Sound.startPlayer as jest.Mock;
const mockedStopPlayer = Sound.stopPlayer as jest.Mock;
const mockedPausePlayer = Sound.pausePlayer as jest.Mock;
const mockedResumePlayer = Sound.resumePlayer as jest.Mock;
const mockedSeekToPlayer = Sound.seekToPlayer as jest.Mock;

const TEST_ID = 'L5';
const PART = 1;
const AUDIO_URL =
  'https://prepsathi-api.onrender.com/static/audio/listening/L5/part1.mp3';
const LOCAL_PATH = `${DocumentDirectoryPath}/prepsathi-audio/L5-part1.mp3`;

function renderPlayer(part: number = PART) {
  return render(
    <ListeningAudioPlayer
      testId={TEST_ID}
      part={part}
      audioUrl={AUDIO_URL}
      audioNote="Audio is pending a real recording."
    />,
  );
}

function playbackListener(): (e: {
  duration: number;
  currentPosition: number;
}) => void {
  const calls = (Sound.addPlayBackListener as jest.Mock).mock.calls;
  return calls[calls.length - 1][0];
}

function playbackEndListener(): (e: {
  duration: number;
  currentPosition: number;
}) => void {
  const calls = (Sound.addPlaybackEndListener as jest.Mock).mock.calls;
  return calls[calls.length - 1][0];
}

describe('formatPlaybackTime', () => {
  it('formats milliseconds as mm:ss', () => {
    expect(formatPlaybackTime(0)).toBe('00:00');
    expect(formatPlaybackTime(61000)).toBe('01:01');
    expect(formatPlaybackTime(3599000)).toBe('59:59');
    expect(formatPlaybackTime(-500)).toBe('00:00');
  });
});

describe('ListeningAudioPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPlaybackManagerForTests();
    mockedExists.mockResolvedValue(true);
    mockedNetFetch.mockResolvedValue({
      isConnected: true,
      isInternetReachable: true,
    });
    mockedDownloadFile.mockImplementation(() => ({
      jobId: 1,
      promise: Promise.resolve({
        jobId: 1,
        statusCode: 200,
        bytesWritten: 1234,
      }),
    }));
  });

  it('plays a cached file from disk and shows progress', async () => {
    renderPlayer();
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-1')).toBeTruthy(),
    );
    expect(screen.getByText('Downloaded — plays offline.')).toBeTruthy();
    expect(screen.getByText('Audio is pending a real recording.')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('audio-play-part-1'));
    await waitFor(() =>
      expect(mockedStartPlayer).toHaveBeenCalledWith(LOCAL_PATH),
    );
    expect(screen.getByText('Pause')).toBeTruthy();

    playbackListener()({duration: 120000, currentPosition: 30000});
    await waitFor(() =>
      expect(screen.getByTestId('audio-time-part-1')).toHaveTextContent(
        '00:30 / 02:00',
      ),
    );
  });

  it('pauses and resumes without restarting', async () => {
    renderPlayer();
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-1')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('audio-play-part-1'));
    await waitFor(() => expect(mockedStartPlayer).toHaveBeenCalled());

    await fireEvent.press(screen.getByText('Pause'));
    await waitFor(() => expect(mockedPausePlayer).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText('Resume')).toBeTruthy(),
    );

    await fireEvent.press(screen.getByText('Resume'));
    await waitFor(() => expect(mockedResumePlayer).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText('Pause')).toBeTruthy());
    expect(mockedStartPlayer).toHaveBeenCalledTimes(1);
  });

  it('seeks back and forward by 10 seconds', async () => {
    renderPlayer();
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-1')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('audio-play-part-1'));
    await waitFor(() => expect(mockedStartPlayer).toHaveBeenCalled());
    playbackListener()({duration: 120000, currentPosition: 30000});
    await waitFor(() =>
      expect(screen.getByTestId('audio-time-part-1')).toHaveTextContent(
        '00:30 / 02:00',
      ),
    );

    await fireEvent.press(screen.getByTestId('audio-seek-forward-part-1'));
    await waitFor(() =>
      expect(mockedSeekToPlayer).toHaveBeenCalledWith(40000),
    );
    await fireEvent.press(screen.getByTestId('audio-seek-back-part-1'));
    await waitFor(() =>
      expect(mockedSeekToPlayer).toHaveBeenCalledWith(30000),
    );
  });

  it('shows Play again at the end of the track', async () => {
    renderPlayer();
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-1')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('audio-play-part-1'));
    await waitFor(() => expect(mockedStartPlayer).toHaveBeenCalled());
    playbackEndListener()({duration: 120000, currentPosition: 120000});
    await waitFor(() =>
      expect(screen.getByText('Play again')).toBeTruthy(),
    );
  });

  it('stops and resets to Play audio', async () => {
    renderPlayer();
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-1')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('audio-play-part-1'));
    await waitFor(() => expect(mockedStartPlayer).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId('audio-stop-part-1'));
    await waitFor(() => expect(mockedStopPlayer).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText('Play audio')).toBeTruthy(),
    );
  });

  it('downloads on first Play when online, showing a downloading state', async () => {
    mockedExists.mockResolvedValue(false);
    let resolveDownload!: (result: {
      jobId: number;
      statusCode: number;
      bytesWritten: number;
    }) => void;
    mockedDownloadFile.mockImplementation(() => ({
      jobId: 1,
      promise: new Promise(resolve => {
        resolveDownload = resolve;
      }),
    }));
    renderPlayer();
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-1')).toBeTruthy(),
    );
    expect(
      screen.getByText(
        'Downloads once, then plays offline. Nothing is recorded or uploaded.',
      ),
    ).toBeTruthy();

    await fireEvent.press(screen.getByTestId('audio-play-part-1'));
    await waitFor(() =>
      expect(screen.getByText(/Downloading audio/)).toBeTruthy(),
    );
    expect(mockedDownloadFile).toHaveBeenCalledWith(
      expect.objectContaining({fromUrl: AUDIO_URL, toFile: LOCAL_PATH}),
    );

    resolveDownload({jobId: 1, statusCode: 200, bytesWritten: 1234});
    await waitFor(() =>
      expect(mockedStartPlayer).toHaveBeenCalledWith(LOCAL_PATH),
    );
    expect(screen.getByText('Downloaded — plays offline.')).toBeTruthy();
  });

  it('shows an offline note and no player when offline and uncached', async () => {
    mockedExists.mockResolvedValue(false);
    mockedNetFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
    renderPlayer();
    await waitFor(() =>
      expect(screen.getByText(/You are offline/)).toBeTruthy(),
    );
    expect(screen.queryByTestId('audio-play-part-1')).toBeNull();
    expect(mockedDownloadFile).not.toHaveBeenCalled();
  });

  it('shows the audio note instead of a broken player when the download fails', async () => {
    mockedExists.mockResolvedValue(false);
    mockedDownloadFile.mockImplementation(() => ({
      jobId: 1,
      promise: Promise.resolve({
        jobId: 1,
        statusCode: 404,
        bytesWritten: 0,
      }),
    }));
    renderPlayer();
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-1')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('audio-play-part-1'));
    await waitFor(() =>
      expect(screen.getByText(/Could not download audio/)).toBeTruthy(),
    );
    expect(screen.getByText(/Read the transcript below/)).toBeTruthy();
    expect(mockedStartPlayer).not.toHaveBeenCalled();
  });

  it('shows the audio note instead of a broken player when playback fails', async () => {
    mockedStartPlayer.mockRejectedValueOnce(new Error('boom'));
    renderPlayer();
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-1')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('audio-play-part-1'));
    await waitFor(() =>
      expect(screen.getByText(/Could not play audio/)).toBeTruthy(),
    );
  });

  it('starting a second part stops the first', async () => {
    render(
      <>
        <ListeningAudioPlayer
          testId={TEST_ID}
          part={1}
          audioUrl={AUDIO_URL}
          audioNote="Part 1 note."
        />
        <ListeningAudioPlayer
          testId={TEST_ID}
          part={2}
          audioUrl={AUDIO_URL.replace('part1', 'part2')}
          audioNote="Part 2 note."
        />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-2')).toBeTruthy(),
    );
    await fireEvent.press(screen.getByTestId('audio-play-part-1'));
    await waitFor(() => expect(mockedStartPlayer).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Pause')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('audio-play-part-2'));
    await waitFor(() => expect(mockedStopPlayer).toHaveBeenCalled());
    await waitFor(() => expect(mockedStartPlayer).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByTestId('audio-play-part-1')).toHaveTextContent(
        'Play audio',
      ),
    );
  });
});
