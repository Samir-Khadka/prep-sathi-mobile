/**
 * Send feedback: category picker + message (max 2000 chars).
 * Online only — offline the form says so plainly and does NOT
 * pretend it sent; the message stays in the box so nothing is lost.
 * Past feedback below, with open/resolved badges.
 */

import React, {useState} from 'react';
import {
  AppButton,
  AppTextInput,
  Body,
  Caption,
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  Title,
} from '@/components/ui';
import {submitFeedback} from '@/api/client';
import {useOwnFeedback} from '@/api/queries';
import {FEEDBACK_CATEGORIES, type FeedbackCategory} from '@/api/types';

const CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  bug: 'Something is broken',
  content: 'Mistake in the practice material',
  feature: 'Feature request',
  other: 'Something else',
};

export function FeedbackScreen() {
  const [category, setCategory] = useState<FeedbackCategory>('bug');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const mine = useOwnFeedback();

  async function submit() {
    setError('');
    setSent(false);
    if (message.trim().length === 0) {
      setError('Write your message first.');
      return;
    }
    setBusy(true);
    try {
      await submitFeedback({
        category,
        message: message.trim(),
        page: 'feedback',
      });
      setMessage('');
      setSent(true);
      await mine.refetch();
    } catch (err) {
      if (err instanceof TypeError) {
        setError(
          'Sending feedback needs a connection — your message is still here, try again when you are online. It has not been sent.',
        );
      } else {
        setError(
          err instanceof Error ? err.message : 'Could not send feedback.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Title>Send feedback</Title>
      <Body>
        Found a mistake, hit a bug, or want something added? Tell us here
        — it goes straight to the PrepSathi team, no email needed.
      </Body>
      {sent ? (
        <Body>
          Thank you — your feedback has been sent. We read every message
          and fix the most-reported issues first.
        </Body>
      ) : null}
      <Body>What is it about?</Body>
      {FEEDBACK_CATEGORIES.map(value => (
        <AppButton
          key={value}
          title={CATEGORY_LABELS[value]}
          variant={category === value ? 'primary' : 'secondary'}
          onPress={() => setCategory(value)}
          accessibilityLabel={`Category: ${CATEGORY_LABELS[value]}`}
        />
      ))}
      <AppTextInput
        label={`Your message (up to 2000 characters, ${message.length}/2000)`}
        value={message}
        onChangeText={text => setMessage(text.slice(0, 2000))}
        multiline
        maxLength={2000}
        testID="feedback-message"
      />
      <ErrorText message={error} />
      <AppButton
        title={busy ? 'Sending…' : 'Send feedback'}
        onPress={() => void submit()}
        disabled={busy || message.trim().length === 0}
        accessibilityLabel="Send feedback"
        testID="feedback-submit"
      />
      <Caption>
        Feedback needs a connection. If you are offline, your message
        stays here until you can send it — it is never silently dropped.
      </Caption>
      <Title>Your past feedback</Title>
      {mine.isPending ? (
        <Loading label="Loading your feedback…" />
      ) : mine.isError ? (
        <Body>
          Sign in and connect to see your past feedback — the form above
          still works when you are online.
        </Body>
      ) : (mine.data ?? []).length === 0 ? (
        <EmptyState message="No feedback sent yet." />
      ) : (
        (mine.data ?? []).map(item => (
          <Card key={item.id}>
            <Body>
              {CATEGORY_LABELS[item.category as FeedbackCategory] ??
                item.category}{' '}
              · {item.resolved ? 'resolved' : 'open'}
            </Body>
            <Caption>{item.message}</Caption>
          </Card>
        ))
      )}
    </Screen>
  );
}
