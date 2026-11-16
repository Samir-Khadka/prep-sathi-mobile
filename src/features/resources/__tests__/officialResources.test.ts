import {OFFICIAL_RESOURCES} from '../officialResources';

describe('official resources fallback', () => {
  it('lists the same five official links as the backend', () => {
    expect(OFFICIAL_RESOURCES).toHaveLength(5);
    expect(OFFICIAL_RESOURCES.map(r => r.url)).toEqual([
      'https://ielts.org',
      'https://takeielts.britishcouncil.org/take-ielts/prepare/ielts-ready',
      'https://takeielts.britishcouncil.org/prepare/ielts-free-practice-mock-tests/ielts-familiarisation-test',
      'https://ielts.idp.com/about/ielts-familiarisation-tests',
      'https://ielts.idp.com/srilanka/results/scores',
    ]);
    for (const link of OFFICIAL_RESOURCES) {
      expect(link.title.length).toBeGreaterThan(5);
      expect(link.description.length).toBeGreaterThan(20);
      expect(link.provider.length).toBeGreaterThan(0);
    }
  });
});
