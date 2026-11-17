/**
 * audioCache: URL resolution, cache paths, download and the
 * offline-first ensure flow. react-native-fs and NetInfo are the
 * shared Jest mocks (jest.setup.js); downloadFile's default mock
 * resolves HTTP 200.
 */

import NetInfo from '@react-native-community/netinfo';
import {
  DocumentDirectoryPath,
  downloadFile,
  exists,
  mkdir,
  unlink,
} from '@dr.pogodin/react-native-fs';
import {
  cachePathFor,
  downloadAudio,
  ensureCachedAudio,
  isAudioCached,
  resolveAudioUrl,
} from '../audioCache';

const mockedExists = exists as jest.Mock;
const mockedMkdir = mkdir as jest.Mock;
const mockedUnlink = unlink as jest.Mock;
const mockedDownloadFile = downloadFile as jest.Mock;
const mockedNetFetch = NetInfo.fetch as jest.Mock;

const BASE = 'https://prepsathi-api.onrender.com';

describe('resolveAudioUrl', () => {
  it('joins a relative path onto the base URL', () => {
    expect(
      resolveAudioUrl('/static/audio/listening/L5/part1.mp3', BASE),
    ).toBe(
      'https://prepsathi-api.onrender.com/static/audio/listening/L5/part1.mp3',
    );
  });

  it('tolerates a trailing slash on the base URL', () => {
    expect(
      resolveAudioUrl('/static/audio/listening/L5/part1.mp3', `${BASE}/`),
    ).toBe(
      'https://prepsathi-api.onrender.com/static/audio/listening/L5/part1.mp3',
    );
  });

  it('adds a leading slash to a bare relative path', () => {
    expect(
      resolveAudioUrl('static/audio/listening/L5/part1.mp3', BASE),
    ).toBe(
      'https://prepsathi-api.onrender.com/static/audio/listening/L5/part1.mp3',
    );
  });

  it('passes absolute URLs through unchanged', () => {
    const absolute = 'https://cdn.example.org/l5-part1.mp3';
    expect(resolveAudioUrl(absolute, BASE)).toBe(absolute);
  });

  it('returns null for a null audio_url', () => {
    expect(resolveAudioUrl(null, BASE)).toBeNull();
  });
});

describe('cachePathFor', () => {
  it('puts the MP3 under prepsathi-audio in the documents directory', () => {
    expect(cachePathFor('L5', 1)).toBe(
      `${DocumentDirectoryPath}/prepsathi-audio/L5-part1.mp3`,
    );
    expect(cachePathFor('L8', 4)).toBe(
      `${DocumentDirectoryPath}/prepsathi-audio/L8-part4.mp3`,
    );
  });
});

describe('isAudioCached', () => {
  it('returns true when the file exists', async () => {
    mockedExists.mockResolvedValue(true);
    await expect(isAudioCached('L5', 1)).resolves.toBe(true);
    expect(mockedExists).toHaveBeenCalledWith(
      `${DocumentDirectoryPath}/prepsathi-audio/L5-part1.mp3`,
    );
  });

  it('returns false when the file is missing', async () => {
    mockedExists.mockResolvedValue(false);
    await expect(isAudioCached('L5', 1)).resolves.toBe(false);
  });
});

describe('downloadAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDownloadFile.mockImplementation(() => ({
      jobId: 1,
      promise: Promise.resolve({
        jobId: 1,
        statusCode: 200,
        bytesWritten: 1234,
      }),
    }));
  });

  it('downloads to the cache path and returns it', async () => {
    const remote = `${BASE}/static/audio/listening/L5/part1.mp3`;
    await expect(downloadAudio('L5', 1, remote)).resolves.toBe(
      `${DocumentDirectoryPath}/prepsathi-audio/L5-part1.mp3`,
    );
    expect(mockedMkdir).toHaveBeenCalledWith(
      `${DocumentDirectoryPath}/prepsathi-audio`,
    );
    expect(mockedDownloadFile).toHaveBeenCalledWith(
      expect.objectContaining({fromUrl: remote}),
    );
    const options = mockedDownloadFile.mock.calls[0][0];
    expect(options.toFile).toBe(
      `${DocumentDirectoryPath}/prepsathi-audio/L5-part1.mp3`,
    );
  });

  it('reports progress to the callback', async () => {
    mockedDownloadFile.mockImplementation(options => {
      options.progress?.({
        jobId: 1,
        contentLength: 1000,
        bytesWritten: 250,
      });
      return {
        jobId: 1,
        promise: Promise.resolve({
          jobId: 1,
          statusCode: 200,
          bytesWritten: 1000,
        }),
      };
    });
    const onProgress = jest.fn();
    await downloadAudio(
      'L5',
      1,
      `${BASE}/static/audio/listening/L5/part1.mp3`,
      onProgress,
    );
    expect(onProgress).toHaveBeenCalledWith({
      bytesWritten: 250,
      contentLength: 1000,
    });
  });

  it('throws and removes a partial file on a non-200 response', async () => {
    mockedDownloadFile.mockImplementation(() => ({
      jobId: 1,
      promise: Promise.resolve({
        jobId: 1,
        statusCode: 404,
        bytesWritten: 0,
      }),
    }));
    await expect(
      downloadAudio('L5', 1, `${BASE}/static/audio/listening/L5/part1.mp3`),
    ).rejects.toThrow('HTTP 404');
    expect(mockedUnlink).toHaveBeenCalledWith(
      `${DocumentDirectoryPath}/prepsathi-audio/L5-part1.mp3`,
    );
  });
});

describe('ensureCachedAudio', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('uses the cached file without downloading', async () => {
    mockedExists.mockResolvedValue(true);
    await expect(
      ensureCachedAudio({
        testId: 'L5',
        part: 1,
        remoteUrl: `${BASE}/static/audio/listening/L5/part1.mp3`,
      }),
    ).resolves.toEqual({
      status: 'cached',
      localPath: `${DocumentDirectoryPath}/prepsathi-audio/L5-part1.mp3`,
    });
    expect(mockedDownloadFile).not.toHaveBeenCalled();
  });

  it('downloads when online and nothing is cached', async () => {
    mockedExists.mockResolvedValue(false);
    await expect(
      ensureCachedAudio({
        testId: 'L5',
        part: 1,
        remoteUrl: `${BASE}/static/audio/listening/L5/part1.mp3`,
      }),
    ).resolves.toEqual({
      status: 'downloaded',
      localPath: `${DocumentDirectoryPath}/prepsathi-audio/L5-part1.mp3`,
    });
    expect(mockedDownloadFile).toHaveBeenCalled();
  });

  it('reports offline without downloading when offline and uncached', async () => {
    mockedExists.mockResolvedValue(false);
    mockedNetFetch.mockResolvedValue({
      isConnected: false,
      isInternetReachable: false,
    });
    await expect(
      ensureCachedAudio({
        testId: 'L5',
        part: 1,
        remoteUrl: `${BASE}/static/audio/listening/L5/part1.mp3`,
      }),
    ).resolves.toEqual({status: 'offline'});
    expect(mockedDownloadFile).not.toHaveBeenCalled();
  });
});
