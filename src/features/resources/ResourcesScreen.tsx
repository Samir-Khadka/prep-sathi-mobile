/**
 * Official resources: the 5 free links from IELTS.org, the British
 * Council and IDP. Online via the server; offline fallback is the
 * bundled copy of the same 5 links. Links open the provider's own
 * site — PrepSathi never mirrors or re-hosts their files.
 */

import React, {useState} from 'react';
import {Linking} from 'react-native';
import {
  AppButton,
  Body,
  Caption,
  Card,
  EmptyState,
  Screen,
  Title,
} from '@/components/ui';
import {useResources} from '@/api/queries';
import {OFFICIAL_RESOURCES} from './officialResources';

export function ResourcesScreen() {
  const resources = useResources();
  const [error, setError] = useState('');
  const links = resources.data ?? OFFICIAL_RESOURCES;

  async function open(url: string) {
    setError('');
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        setError('That link could not be opened on this device.');
        return;
      }
      await Linking.openURL(url);
    } catch {
      setError('That link could not be opened on this device.');
    }
  }

  return (
    <Screen>
      <Title>Official resources</Title>
      <Body>
        Free material from the IELTS partners — sample questions,
        familiarisation tests and how band scores work. These links open
        the providers&apos; own websites; PrepSathi never mirrors or
        re-hosts their files.
      </Body>
      {resources.isError ? (
        <Caption>Offline — showing the saved list of official links.</Caption>
      ) : null}
      {error ? <Body>{error}</Body> : null}
      {links.length === 0 ? (
        <EmptyState message="No resources available right now." />
      ) : (
        links.map(link => (
          <Card key={link.url}>
            <Body>{link.title}</Body>
            <Caption>{link.provider}</Caption>
            <Body>{link.description}</Body>
            <AppButton
              title="Open"
              variant="secondary"
              onPress={() => void open(link.url)}
              accessibilityLabel={`Open ${link.title}`}
            />
          </Card>
        ))
      )}
    </Screen>
  );
}
