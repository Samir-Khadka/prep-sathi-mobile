/**
 * Auth state (Zustand 5). The JWT lives in the OS Keychain/Keystore
 * (see src/store/tokenStore.ts) and the user in MMKV (see
 * src/store/storage.ts); this store is the in-memory view of them.
 */

import {create} from 'zustand';
import {fetchMe, login as apiLogin, signup as apiSignup} from '../api/client';
import {getStoredUser, setLegacyAuthToken, setStoredUser, type StoredUser} from './storage';
import {
  deleteAuthToken,
  loadAuthToken,
  migrateLegacyToken,
  saveAuthToken,
} from './tokenStore';

interface AuthState {
  user: StoredUser | null;
  token: string | null;
  /** 'loading' while hydrating from the Keychain on launch. */
  status: 'loading' | 'authed' | 'guest';
  error: string | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  token: null,
  status: 'loading',
  error: null,

  hydrate: async () => {
    await migrateLegacyToken();
    const token = await loadAuthToken();
    const user = getStoredUser();
    if (token && user) {
      set({token, user, status: 'authed'});
    } else {
      set({token: null, user: null, status: 'guest'});
    }
  },

  login: async (email, password) => {
    set({error: null});
    try {
      const {access_token} = await apiLogin({email, password});
      await saveAuthToken(access_token);
      const me = await fetchMe();
      const user: StoredUser = {
        id: me.id,
        email: me.email,
        name: me.name,
        target_band_overall: me.target_band_overall,
        target_band_writing: me.target_band_writing,
      };
      setStoredUser(user);
      set({token: access_token, user, status: 'authed'});
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not sign in.';
      set({error: message});
      throw err;
    }
  },

  signup: async (email, password, name) => {
    set({error: null});
    try {
      const {access_token} = await apiSignup({
        email,
        password,
        name,
        target_band_overall: null,
        target_band_writing: null,
      });
      await saveAuthToken(access_token);
      const me = await fetchMe();
      const user: StoredUser = {
        id: me.id,
        email: me.email,
        name: me.name,
        target_band_overall: me.target_band_overall,
        target_band_writing: me.target_band_writing,
      };
      setStoredUser(user);
      set({token: access_token, user, status: 'authed'});
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not create the account.';
      set({error: message});
      throw err;
    }
  },

  logout: async () => {
    // Guest state first, so the UI switches immediately; the
    // secure-store delete follows and never blocks it.
    set({token: null, user: null, status: 'guest', error: null});
    setStoredUser(null);
    setLegacyAuthToken(null);
    await deleteAuthToken();
  },

  clearError: () => {
    if (get().error !== null) {
      set({error: null});
    }
  },
}));
