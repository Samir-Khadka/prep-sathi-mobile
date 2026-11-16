/**
 * PrepSathi — free IELTS-format practice for Nepali phone-first
 * learners. All practice content is original; band scores shown
 * anywhere are practice estimates, not official scores.
 */

import NetInfo from '@react-native-community/netinfo';
import {QueryClientProvider} from '@tanstack/react-query';
import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {queryClient} from './api/queries';
import {ErrorBoundary} from './components/ui';
import {RootNavigator} from './navigation/RootNavigator';
import {useAuthStore} from './store/authStore';
import {useSyncStore} from './store/syncStore';

export default function App() {
  const hydrate = useAuthStore(s => s.hydrate);
  const status = useAuthStore(s => s.status);
  const syncPending = useSyncStore(s => s.syncPending);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // When the device comes online and the learner is signed in, push
  // any attempts scored offline to the server.
  useEffect(() => {
    if (status !== 'authed') {
      return undefined;
    }
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected) {
        void syncPending();
      }
    });
    return unsubscribe;
  }, [status, syncPending]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <StatusBar barStyle="dark-content" />
          <RootNavigator />
        </ErrorBoundary>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
