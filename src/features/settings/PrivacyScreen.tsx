/**
 * Privacy note — plain language, matching the web Privacy page.
 * What is stored, what never leaves the phone, and what we do not
 * do. Account deletion: there is no delete endpoint on the backend,
 * so deletion is requested through the in-app Feedback form for now
 * — this screen says that plainly instead of inventing an endpoint.
 */

import React from 'react';
import {useNavigation} from '@react-navigation/native';
import {
  AppButton,
  Body,
  Card,
  Heading,
  Screen,
  Title,
} from '@/components/ui';
import type {RootNavigation} from '@/navigation/types';

export function PrivacyScreen() {
  const navigation = useNavigation<RootNavigation>();

  return (
    <Screen>
      <Title>Privacy note</Title>
      <Body>
        PrepSathi is a free practice app. This note explains, in plain
        words, what we store and what we do not.
      </Body>
      <Card>
        <Heading>What is stored</Heading>
        <Body>
          Your account: your name, email address and your target band.
          Your password is stored as a one-way hash — nobody at PrepSathi
          can read it.
        </Body>
        <Body>
          Your attempts: your answers and scores from timed tests and full
          mock sittings, so your dashboard can show your progress and your
          band estimates.
        </Body>
        <Body>
          Your vocabulary: the words you have practised and your review
          schedule, so spaced repetition can remind you at the right time.
        </Body>
      </Card>
      <Card>
        <Heading>What is never uploaded</Heading>
        <Body>
          Speaking practice recordings stay on your device. They are saved
          on your phone only and are never uploaded to our servers. You
          can delete a single recording, or all of them, from your
          Speaking recordings at any time.
        </Body>
      </Card>
      <Card>
        <Heading>What we do not do</Heading>
        <Body>No third-party trackers and no advertising.</Body>
        <Body>We do not sell or share your data with anyone.</Body>
        <Body>
          We do not use any Cambridge or IELTS test content — all practice
          material is original, written to the official IELTS format.
        </Body>
      </Card>
      <Card>
        <Heading>Deleting your account</Heading>
        <Body>
          You can ask for your account to be deleted — including your
          attempts and vocabulary. There is no self-service delete button
          in the app yet, so please ask through the in-app Feedback form
          and the PrepSathi team will delete it for you. Recordings
          already live on your device only, so deleting them there removes
          them completely.
        </Body>
        <AppButton
          title="Request deletion via Feedback"
          variant="secondary"
          onPress={() => navigation.navigate('Feedback')}
          accessibilityLabel="Request account deletion via the feedback form"
        />
      </Card>
    </Screen>
  );
}
