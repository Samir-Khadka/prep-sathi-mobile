/**
 * Sign in / create account, in one screen with a toggle.
 * Practice works fully offline; sign-in only needs a connection.
 * When the network is down, sign-in says so plainly and offers a
 * "Continue offline" path to Home as a guest — dashboard sync and
 * feedback stay signed-in only, and Home says that.
 */

import React, {useState} from 'react';
import {
  AppButton,
  AppTextInput,
  Body,
  Caption,
  ErrorText,
  Screen,
  Title,
} from '@/components/ui';
import {useAuthStore} from '@/store/authStore';
import {useOfflineGuest} from './guestMode';

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(false);
  const [busy, setBusy] = useState(false);
  const login = useAuthStore(s => s.login);
  const signup = useAuthStore(s => s.signup);
  const setOfflineGuest = useOfflineGuest(s => s.setOfflineGuest);

  async function submit() {
    setError('');
    setOffline(false);
    const cleanEmail = email.trim();
    if (!cleanEmail.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    if (mode === 'signup' && password.length < 8) {
      setError('Your password needs at least 8 characters.');
      return;
    }
    if (mode === 'login' && password.length === 0) {
      setError('Enter your password.');
      return;
    }
    if (mode === 'signup' && name.trim().length === 0) {
      setError('Enter your name.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(cleanEmail, password);
      } else {
        await signup(cleanEmail, password, name.trim());
      }
      // Success flips the auth store to authed; the navigator shows Home.
    } catch (err) {
      if (err instanceof TypeError) {
        // fetch throws TypeError when the device is offline.
        setOffline(true);
        setError(
          'You look offline — practice works offline, but sign-in needs a connection.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Could not sign in.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>PrepSathi</Title>
      <Body>
        Free IELTS-format practice. Sign in to save your attempts and
        vocabulary and see your progress on any device — or practise
        offline as a guest.
      </Body>
      <AppButton
        title={mode === 'login' ? 'Create an account instead' : 'Sign in instead'}
        variant="ghost"
        onPress={() =>
          setMode(mode === 'login' ? 'signup' : 'login')
        }
        accessibilityLabel={
          mode === 'login'
            ? 'Switch to create an account'
            : 'Switch to sign in'
        }
      />
      {mode === 'signup' ? (
        <AppTextInput
          label="Your name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
          testID="auth-name"
        />
      ) : null}
      <AppTextInput
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        testID="auth-email"
      />
      <AppTextInput
        label="Password (at least 8 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        testID="auth-password"
      />
      <ErrorText message={error} />
      <AppButton
        title={
          busy
            ? 'Please wait…'
            : mode === 'login'
              ? 'Sign in'
              : 'Create account'
        }
        onPress={submit}
        disabled={busy}
        accessibilityLabel={mode === 'login' ? 'Sign in' : 'Create account'}
        testID="auth-submit"
      />
      {offline ? (
        <>
          <Body>
            Your practice, vocabulary and mock sittings all work offline
            on this phone. Signing in is only needed to save your progress
            to your account and sync it — you can sign in later from
            Settings.
          </Body>
          <AppButton
            title="Continue offline"
            variant="secondary"
            onPress={() => setOfflineGuest(true)}
            accessibilityLabel="Continue offline as a guest"
            testID="auth-continue-offline"
          />
        </>
      ) : null}
      <Caption>
        Every band PrepSathi shows is a practice estimate, not an official
        score.
      </Caption>
    </Screen>
  );
}
