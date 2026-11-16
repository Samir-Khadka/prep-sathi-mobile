/**
 * Settings: API base URL, track, target bands, app info, logout,
 * and a short "About PrepSathi".
 */

import React, {useState} from 'react';
import {
  AppButton,
  AppTextInput,
  Body,
  Caption,
  Card,
  ErrorText,
  Screen,
  Title,
} from '@/components/ui';
import {
  CONTENT_VERSION,
  listeningTests,
  readingTests,
  speakingSets,
  vocabularyDeck,
  writingPrompts,
} from '@/content/index';
import {useAuthStore} from '@/store/authStore';
import {useOfflineGuest} from '@/features/auth/guestMode';
import {useSettingsStore} from '@/store/settingsStore';
import {DEFAULT_API_BASE_URL} from '@/store/storage';

/** null = blank (clear); undefined = invalid input. */
function parseBand(value: string): number | null | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }
  const num = Number(trimmed);
  if (Number.isNaN(num) || num < 1 || num > 9) {
    return undefined;
  }
  return Math.round(num * 2) / 2;
}

export function SettingsScreen() {
  const apiBaseUrl = useSettingsStore(s => s.apiBaseUrl);
  const setApiBaseUrl = useSettingsStore(s => s.setApiBaseUrl);
  const track = useSettingsStore(s => s.track);
  const setTrack = useSettingsStore(s => s.setTrack);
  const targetOverall = useSettingsStore(s => s.targetBandOverall);
  const targetWriting = useSettingsStore(s => s.targetBandWriting);
  const setTargets = useSettingsStore(s => s.setTargets);
  const logout = useAuthStore(s => s.logout);
  const setOfflineGuest = useOfflineGuest(s => s.setOfflineGuest);

  const [urlDraft, setUrlDraft] = useState(apiBaseUrl);
  const [urlSaved, setUrlSaved] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [overallDraft, setOverallDraft] = useState(
    targetOverall !== null ? String(targetOverall) : '',
  );
  const [writingDraft, setWritingDraft] = useState(
    targetWriting !== null ? String(targetWriting) : '',
  );
  const [targetError, setTargetError] = useState('');

  function saveUrl() {
    const clean = urlDraft.trim().replace(/\/$/, '');
    if (!/^https?:\/\/.+/.test(clean)) {
      setUrlError('Enter a full URL starting with http:// or https://');
      setUrlSaved(false);
      return;
    }
    setUrlError('');
    setApiBaseUrl(clean);
    setUrlSaved(true);
  }

  function saveTargets() {
    const overall = parseBand(overallDraft);
    const writing = parseBand(writingDraft);
    if (overall === undefined || writing === undefined) {
      setTargetError('Target bands must be between 1.0 and 9.0, or blank.');
      return;
    }
    setTargetError('');
    setTargets(overall, writing);
  }

  return (
    <Screen>
      <Title>Settings</Title>
      <Card>
        <Body>API address</Body>
        <AppTextInput
          label="API base URL"
          value={urlDraft}
          onChangeText={text => {
            setUrlDraft(text);
            setUrlSaved(false);
          }}
          autoCapitalize="none"
          autoComplete="off"
          keyboardType="url"
          testID="settings-api-url"
        />
        <Caption>Default: {DEFAULT_API_BASE_URL}</Caption>
        {urlError ? <ErrorText message={urlError} /> : null}
        {urlSaved ? <Body>Saved — the new address takes effect immediately.</Body> : null}
        <AppButton
          title="Save API address"
          variant="secondary"
          onPress={saveUrl}
          accessibilityLabel="Save API base URL"
        />
      </Card>
      <Card>
        <Body>Track</Body>
        <AppButton
          title="Academic"
          variant={track === 'academic' ? 'primary' : 'secondary'}
          onPress={() => setTrack('academic')}
          accessibilityLabel="Choose Academic track"
        />
        <AppButton
          title="General Training"
          variant={track === 'general' ? 'primary' : 'secondary'}
          onPress={() => setTrack('general')}
          accessibilityLabel="Choose General Training track"
        />
      </Card>
      <Card>
        <Body>Target bands</Body>
        <AppTextInput
          label="Target overall band (1.0–9.0, blank to clear)"
          value={overallDraft}
          onChangeText={setOverallDraft}
          keyboardType="decimal-pad"
          testID="settings-target-overall"
        />
        <AppTextInput
          label="Target Writing band (1.0–9.0, blank to clear)"
          value={writingDraft}
          onChangeText={setWritingDraft}
          keyboardType="decimal-pad"
          testID="settings-target-writing"
        />
        {targetError ? <ErrorText message={targetError} /> : null}
        <AppButton
          title="Save target bands"
          variant="secondary"
          onPress={saveTargets}
          accessibilityLabel="Save target bands"
        />
      </Card>
      <Card>
        <Body>About PrepSathi</Body>
        <Body>
          PrepSathi is free IELTS-format practice — four modules, timed
          tests, full mock sittings and vocabulary review, with honest band
          estimates and no paywall. All practice material is original,
          written to the official IELTS format.
        </Body>
        <Caption>Mobile app v0.1.0</Caption>
        <Caption>
          Practice content: web {CONTENT_VERSION.webVersion} (commit{' '}
          {CONTENT_VERSION.webMain}, copied {CONTENT_VERSION.copiedAt})
        </Caption>
        <Caption>
          Bundled content: {listeningTests.length} Listening tests ·{' '}
          {readingTests.length} Reading tests · {writingPrompts.length}{' '}
          Writing prompts · {speakingSets.length} Speaking sets ·{' '}
          {vocabularyDeck.length} vocabulary words
        </Caption>
      </Card>
      <AppButton
        title="Log out"
        variant="danger"
        onPress={() => {
          setOfflineGuest(false);
          logout();
        }}
        accessibilityLabel="Log out"
      />
    </Screen>
  );
}
