/**
 * Offline-guest mode: the learner chose "Continue offline" on the
 * Auth screen instead of signing in. Practice is fully offline, so a
 * guest can use Home and every practice screen; dashboard sync and
 * feedback need sign-in. Lives here (not in the auth store) so the
 * auth foundation stays untouched — RootNavigator reads it to decide
 * whether a guest sees Auth or Home.
 */

import {create} from 'zustand';

interface GuestModeState {
  offlineGuest: boolean;
  setOfflineGuest: (value: boolean) => void;
}

export const useOfflineGuest = create<GuestModeState>()(set => ({
  offlineGuest: false,
  setOfflineGuest: value => set({offlineGuest: value}),
}));
