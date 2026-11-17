/**
 * Auth token storage in the OS secure store (react-native-keychain).
 *
 * The HS256 JWT lives in the iOS Keychain / Android Keystore under a
 * dedicated service, never in plain MMKV and never synced anywhere
 * (Keychain's default storage is local-only). The token value is
 * never logged.
 *
 * A token issued before this change still sits in MMKV under
 * 'auth.token' — see migrateLegacyToken(), which moves it once on
 * launch and then removes the MMKV copy. The MMKV helpers in
 * src/store/storage.ts are legacy-only.
 */

import * as Keychain from 'react-native-keychain';
import {getLegacyAuthToken, setLegacyAuthToken} from './storage';

/** Dedicated Keychain service for the auth token. */
export const AUTH_TOKEN_SERVICE = 'com.prepsathi.app.auth-token';

/** Fixed username — the token is the secret, not the username. */
const KEYCHAIN_USERNAME = 'session';

/**
 * In-memory cache. `undefined` = not loaded yet this launch;
 * `null` = loaded, no token. loadAuthToken reads the Keychain once
 * per launch; save/delete keep the cache in step.
 */
let cachedToken: string | null | undefined;
/** In-flight first load, so concurrent callers share one Keychain read. */
let loadPromise: Promise<string | null> | null = null;

/** Test-only reset for the in-memory cache (jest: use with Keychain's __clearAllEntries()). */
export function __resetTokenCache(): void {
  cachedToken = undefined;
  loadPromise = null;
}

export async function saveAuthToken(token: string): Promise<void> {
  await Keychain.setGenericPassword(KEYCHAIN_USERNAME, token, {
    service: AUTH_TOKEN_SERVICE,
  });
  cachedToken = token;
}

/**
 * The cached token after the first load, else one Keychain read.
 * Falls back to the legacy MMKV token if the Keychain read throws,
 * so a Keychain failure never signs the user out. Never throws.
 */
export async function loadAuthToken(): Promise<string | null> {
  if (cachedToken !== undefined) {
    return cachedToken;
  }
  if (loadPromise !== null) {
    return loadPromise;
  }
  loadPromise = (async (): Promise<string | null> => {
    try {
      const credentials = await Keychain.getGenericPassword({
        service: AUTH_TOKEN_SERVICE,
      });
      const token = credentials ? credentials.password : null;
      cachedToken = token;
      return token;
    } catch {
      const legacy = getLegacyAuthToken();
      cachedToken = legacy;
      return legacy;
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

/** Best-effort delete: the cache is cleared even if Keychain fails. */
export async function deleteAuthToken(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({service: AUTH_TOKEN_SERVICE});
  } catch {
    // Logout must not fail on a Keychain error; the in-memory
    // token is gone either way.
  }
  cachedToken = null;
}

export type MigrationResult =
  | 'migrated'
  | 'already-secure'
  | 'none'
  | 'failed';

/**
 * One-time move of a pre-Keychain MMKV token into the Keychain.
 * On any Keychain error returns 'failed' and leaves MMKV intact,
 * so the legacy token stays usable via loadAuthToken's fallback.
 */
export async function migrateLegacyToken(): Promise<MigrationResult> {
  let hasSecure: boolean;
  try {
    hasSecure = await Keychain.hasGenericPassword({
      service: AUTH_TOKEN_SERVICE,
    });
  } catch {
    return 'failed';
  }
  const legacy = getLegacyAuthToken();
  if (hasSecure) {
    // A previous launch already migrated (or a fresh login saved);
    // drop any stale MMKV copy.
    if (legacy !== null) {
      setLegacyAuthToken(null);
    }
    return 'already-secure';
  }
  if (legacy === null) {
    return 'none';
  }
  try {
    await Keychain.setGenericPassword(KEYCHAIN_USERNAME, legacy, {
      service: AUTH_TOKEN_SERVICE,
    });
  } catch {
    return 'failed';
  }
  setLegacyAuthToken(null);
  cachedToken = legacy;
  return 'migrated';
}
