/**
 * TanStack Query 5 setup: shared QueryClient, online state from
 * NetInfo, and typed read hooks for the catalogue endpoints.
 * Feature screens own their mutations with useMutation.
 */

import NetInfo from '@react-native-community/netinfo';
import {
  onlineManager,
  QueryClient,
  useQuery,
} from '@tanstack/react-query';
import {
  fetchDashboard,
  listModules,
  listOwnFeedback,
  listResources,
} from './client';
import type {
  DashboardOut,
  FeedbackOut,
  ModuleInfo,
  ResourceLink,
} from './types';

onlineManager.setEventListener(setOnline => {
  return NetInfo.addEventListener(state => {
    setOnline(Boolean(state.isConnected));
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error) => {
        // Do not retry auth/validation failures; retry network once.
        if (error instanceof Error && 'status' in error) {
          return false;
        }
        return failureCount < 1;
      },
    },
  },
});

export const queryKeys = {
  modules: ['modules'],
  resources: ['resources'],
  dashboard: ['dashboard'],
  attempts: ['attempts'],
  feedback: ['feedback'],
  listeningList: ['practice', 'listening'],
  readingList: (track: string) => ['practice', 'reading', track],
  writingList: (track: string) => ['practice', 'writing', track],
  speakingList: ['practice', 'speaking'],
  vocabulary: ['vocabulary'],
  vocabularyDue: ['vocabulary', 'due'],
  mocks: ['mock'],
  mockDetail: (mockId: number) => ['mock', mockId],
} as const;

export function useModules() {
  return useQuery<ModuleInfo[]>({
    queryKey: queryKeys.modules,
    queryFn: listModules,
  });
}

export function useResources() {
  return useQuery<ResourceLink[]>({
    queryKey: queryKeys.resources,
    queryFn: listResources,
  });
}

export function useDashboard() {
  return useQuery<DashboardOut>({
    queryKey: queryKeys.dashboard,
    queryFn: fetchDashboard,
  });
}

export function useOwnFeedback() {
  return useQuery<FeedbackOut[]>({
    queryKey: queryKeys.feedback,
    queryFn: listOwnFeedback,
  });
}
