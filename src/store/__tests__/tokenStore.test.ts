/**
 * tokenStore tests. The Keychain is the in-memory mock from
 * jest.setup.js (reset with __clearAllEntries()); the legacy MMKV
 * token is the MMKV mock from the same setup (reset with
 * storage.clearAll()). The token value is never asserted against
 * a log — there is no logging of it anywhere.
 */

import * as Keychain from 'react-native-keychain';
import {
  getLegacyAuthToken,
  setLegacyAuthToken,
  storage,
} from '../storage';
import {
  __resetTokenCache,
  AUTH_TOKEN_SERVICE,
  deleteAuthToken,
  loadAuthToken,
  migrateLegacyToken,
  saveAuthToken,
} from '../tokenStore';

const keychainMock = Keychain as unknown as {
  __clearAllEntries: () => void;
  getGenericPassword: jest.Mock;
  setGenericPassword: jest.Mock;
  hasGenericPassword: jest.Mock;
  resetGenericPassword: jest.Mock;
};

const SERVICE = {service: AUTH_TOKEN_SERVICE};

beforeEach(() => {
  keychainMock.__clearAllEntries();
  storage.clearAll();
  __resetTokenCache();
  jest.clearAllMocks();
});

describe('save / load / delete', () => {
  it('saves a token to the Keychain and loads it back', async () => {
    await saveAuthToken('tok-abc');
    __resetTokenCache();
    expect(await loadAuthToken()).toBe('tok-abc');
    const stored = await Keychain.getGenericPassword(SERVICE);
    expect(stored).not.toBe(false);
    if (stored) {
      expect(stored.username).toBe('session');
      expect(stored.password).toBe('tok-abc');
    }
  });

  it('loads null when nothing is stored', async () => {
    expect(await loadAuthToken()).toBeNull();
  });

  it('deletes from the Keychain and clears the cache', async () => {
    await saveAuthToken('tok-abc');
    await deleteAuthToken();
    expect(await loadAuthToken()).toBeNull();
    expect(await Keychain.getGenericPassword(SERVICE)).toBe(false);
  });
});

describe('cache behaviour', () => {
  it('reads the Keychain once per launch', async () => {
    await Keychain.setGenericPassword('session', 'tok-abc', SERVICE);
    expect(await loadAuthToken()).toBe('tok-abc');
    expect(await loadAuthToken()).toBe('tok-abc');
    expect(keychainMock.getGenericPassword).toHaveBeenCalledTimes(1);
  });

  it('serves save/delete from the cache without a Keychain read', async () => {
    await saveAuthToken('tok-abc');
    keychainMock.__clearAllEntries();
    expect(await loadAuthToken()).toBe('tok-abc');
    expect(keychainMock.getGenericPassword).not.toHaveBeenCalled();

    await deleteAuthToken();
    expect(await loadAuthToken()).toBeNull();
    expect(keychainMock.getGenericPassword).not.toHaveBeenCalled();
  });
});

describe('migrateLegacyToken', () => {
  it('moves an MMKV token into the Keychain and removes the MMKV copy', async () => {
    setLegacyAuthToken('legacy-tok');
    expect(await migrateLegacyToken()).toBe('migrated');
    expect(getLegacyAuthToken()).toBeNull();
    __resetTokenCache();
    expect(await loadAuthToken()).toBe('legacy-tok');
  });

  it('returns already-secure and drops a stale MMKV copy', async () => {
    await Keychain.setGenericPassword('session', 'secure-tok', SERVICE);
    setLegacyAuthToken('stale-tok');
    expect(await migrateLegacyToken()).toBe('already-secure');
    expect(getLegacyAuthToken()).toBeNull();
    __resetTokenCache();
    expect(await loadAuthToken()).toBe('secure-tok');
  });

  it('returns none when there is no token anywhere', async () => {
    expect(await migrateLegacyToken()).toBe('none');
  });

  it('returns failed and leaves MMKV intact when the Keychain write fails', async () => {
    setLegacyAuthToken('legacy-tok');
    keychainMock.setGenericPassword.mockRejectedValueOnce(
      new Error('Keychain unavailable'),
    );
    expect(await migrateLegacyToken()).toBe('failed');
    expect(getLegacyAuthToken()).toBe('legacy-tok');
    expect(await Keychain.getGenericPassword(SERVICE)).toBe(false);
  });

  it('returns failed and leaves MMKV intact when the Keychain check fails', async () => {
    setLegacyAuthToken('legacy-tok');
    keychainMock.hasGenericPassword.mockRejectedValueOnce(
      new Error('Keychain unavailable'),
    );
    expect(await migrateLegacyToken()).toBe('failed');
    expect(getLegacyAuthToken()).toBe('legacy-tok');
  });
});

describe('Keychain-failure fallback', () => {
  it('falls back to the legacy MMKV token and never throws', async () => {
    setLegacyAuthToken('legacy-tok');
    keychainMock.getGenericPassword.mockRejectedValueOnce(
      new Error('Keychain unavailable'),
    );
    await expect(loadAuthToken()).resolves.toBe('legacy-tok');
    // The fallback is cached: a second load does not re-read.
    expect(await loadAuthToken()).toBe('legacy-tok');
    expect(keychainMock.getGenericPassword).toHaveBeenCalledTimes(1);
  });

  it('returns null (not a throw) when the Keychain fails and there is no legacy token', async () => {
    keychainMock.getGenericPassword.mockRejectedValueOnce(
      new Error('Keychain unavailable'),
    );
    await expect(loadAuthToken()).resolves.toBeNull();
  });
});
