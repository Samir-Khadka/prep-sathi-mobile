/**
 * The five official free-resource links, copied verbatim from the web
 * backend (backend/app/routers/resources.py). This is the offline
 * fallback for ResourcesScreen — the same links the server returns,
 * so the screen shows identical content with or without a connection.
 * PrepSathi links out to the partners' own sites; it never mirrors or
 * re-hosts their files.
 */

import type {ResourceLink} from '@/api/types';

export const OFFICIAL_RESOURCES: ResourceLink[] = [
  {
    title: 'IELTS.org — free sample questions',
    url: 'https://ielts.org',
    description:
      'Sample tasks for all four skills, Academic and General Training, ' +
      'with answer keys, listening transcripts and writing responses with ' +
      'examiner comments. The format reference — check the real thing here.',
    provider: 'IELTS partners',
  },
  {
    title: 'British Council — IELTS Ready (free)',
    url: 'https://takeielts.britishcouncil.org/take-ielts/prepare/ielts-ready',
    description:
      'A 25-minute Express Mock and a 50-minute Mini Mock with ' +
      'personalised feedback, plus full practice tests, short courses and ' +
      'live webinars. Free with sign-up.',
    provider: 'British Council',
  },
  {
    title: 'British Council — familiarisation test',
    url: 'https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests/ielts-familiarisation-test',
    description:
      'The official sample of the complete test on the real computer-test ' +
      'screens — all four skills, Academic and General Training, with free ' +
      'Listening and Reading results. Start here before your first full mock.',
    provider: 'British Council',
  },
  {
    title: 'IDP — familiarisation tests',
    url: 'https://ielts.idp.com/about/ielts-familiarisation-tests',
    description:
      'Practise highlighting, navigation, scrolling and answer editing on ' +
      'the computer test screens, without time pressure.',
    provider: 'IDP',
  },
  {
    title: 'IDP — band scores explained',
    url: 'https://ielts.idp.com/srilanka/results/scores',
    description:
      'How the 0–9 band scale works, what each band means, and how the ' +
      'overall band is calculated from the four section bands.',
    provider: 'IDP',
  },
];
