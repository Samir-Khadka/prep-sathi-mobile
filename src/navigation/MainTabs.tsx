/**
 * Bottom tabs — the signed-in learner's main navigation.
 * Five tabs, labels only (no icon library is installed): Home,
 * Vocabulary, Mock, Progress and Settings. The root stack provides
 * the header, so the tab navigator hides its own; detail screens
 * stay in the stack above the tabs.
 */

import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import React from 'react';
import {DashboardScreen} from '../features/dashboard/DashboardScreen';
import {HomeScreen} from '../features/dashboard/HomeScreen';
import {MockListScreen} from '../features/mock/MockListScreen';
import {SettingsScreen} from '../features/settings/SettingsScreen';
import {VocabularyScreen} from '../features/vocab/VocabularyScreen';
import {colors} from '../theme/tokens';
import type {MainTabParamList} from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
        },
      }}>
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{tabBarLabel: 'Home'}}
      />
      <Tab.Screen
        name="Vocabulary"
        component={VocabularyScreen}
        options={{tabBarLabel: 'Vocabulary'}}
      />
      <Tab.Screen
        name="Mock"
        component={MockListScreen}
        options={{tabBarLabel: 'Mock'}}
      />
      <Tab.Screen
        name="Progress"
        component={DashboardScreen}
        options={{tabBarLabel: 'Progress'}}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{tabBarLabel: 'Settings'}}
      />
    </Tab.Navigator>
  );
}
