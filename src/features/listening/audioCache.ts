/**
 * Listening audio cache — offline-first.
 *
 * The server serves one MP3 per part at
 * `/static/audio/listening/<TEST_ID>/part<N>.mp3` (see the shared
 * audio contract). Nothing is synthesised or faked: until a real
 * recording exists on the server, `audio_url` stays null and the
 * screen shows the transcript instead.
 *
 * A part's audio is downloaded on demand (first Play press while
 * online) into the app documents directory and played from disk
 * afterwards. The cache manifest is the files themselves — a file
 * exists iff that part is cached. `resolveAudioUrl` and
 * `cachePathFor` are pure and unit-testable without native modules.
 */

import NetInfo from '@react-native-community/netinfo';
import {
  DocumentDirectoryPath,
  downloadFile,
  exists,
  mkdir,
  unlink,
} from '@dr.pogodin/react-native-fs';

export const AUDIO_CACHE_DIR_NAME = 'prepsathi-audio';

/** Absolute path of the app documents directory. */
export function audioCacheDirPath(): string {
  return `${DocumentDirectoryPath}/${AUDIO_CACHE_DIR_NAME}`;
}

/** On-disk path for one part's cached MP3. Pure. */
export function cachePathFor(testId: string, part: number): string {
  return `${audioCacheDirPath()}/${testId}-part${part}.mp3`;
}

/**
 * Resolve an `audio_url` from content against the API base URL.
 * Absolute URLs pass through unchanged; relative paths are joined
 * onto the base (trailing slash tolerated). Null stays null. Pure.
 */
export function resolveAudioUrl(
  audioUrl: string | null,
  baseUrl: string,
): string | null {
  if (!audioUrl) {
    return null;
  }
  if (/^https?:\/\//i.test(audioUrl)) {
    return audioUrl;
  }
  const base = baseUrl.replace(/\/$/, '');
  const path = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`;
  return `${base}${path}`;
}

/** True when this part's MP3 is already on disk. */
export async function isAudioCached(
  testId: string,
  part: number,
): Promise<boolean> {
  try {
    return await exists(cachePathFor(testId, part));
  } catch {
    return false;
  }
}

export interface DownloadProgress {
  bytesWritten: number;
  contentLength: number;
}

/**
 * Download one part's MP3 into the cache directory and return its
 * local path. Throws on a non-200 response (partial file removed)
 * or on a network failure — the caller shows the transcript.
 */
export async function downloadAudio(
  testId: string,
  part: number,
  remoteUrl: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<string> {
  const toFile = cachePathFor(testId, part);
  await mkdir(audioCacheDirPath());
  const {promise} = downloadFile({
    fromUrl: remoteUrl,
    toFile,
    progress:
      onProgress === undefined
        ? undefined
        : res =>
            onProgress({
              bytesWritten: res.bytesWritten,
              contentLength: res.contentLength,
            }),
  });
  const result = await promise;
  if (result.statusCode !== 200) {
    await unlink(toFile).catch(() => undefined);
    throw new Error(
      `Audio download failed (HTTP ${result.statusCode})`,
    );
  }
  return toFile;
}

export type CachedAudio =
  | {status: 'cached' | 'downloaded'; localPath: string}
  | {status: 'offline'};

/**
 * Offline-first fetch: a cached file is used as-is; otherwise the
 * file is downloaded when online. Returns `{status: 'offline'}` —
 * never throws for being offline — when there is nothing cached
 * and no connection, so the caller can fall back to the transcript.
 */
export async function ensureCachedAudio(args: {
  testId: string;
  part: number;
  remoteUrl: string;
  onProgress?: (progress: DownloadProgress) => void;
}): Promise<CachedAudio> {
  const localPath = cachePathFor(args.testId, args.part);
  if (await isAudioCached(args.testId, args.part)) {
    return {status: 'cached', localPath};
  }
  const net = await NetInfo.fetch();
  if (!net.isConnected) {
    return {status: 'offline'};
  }
  const downloaded = await downloadAudio(
    args.testId,
    args.part,
    args.remoteUrl,
    args.onProgress,
  );
  return {status: 'downloaded', localPath: downloaded};
}
