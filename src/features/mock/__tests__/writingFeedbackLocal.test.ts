import {loadLocalWritingFeedback} from '../writingFeedbackLocal';
import {getWritingPrompt} from '@/content/index';

const SAMPLE_TEXT =
  'The chart shows how many people visited the museum in each month of ' +
  'the year. Overall, visitor numbers rose sharply in the spring, reached ' +
  'a peak in the summer, and then fell again in the autumn. In January, ' +
  'about ten thousand people visited the museum. This figure grew slowly ' +
  'in February and March, and by April it had reached twenty thousand. ' +
  'The number continued to rise in May and June, and in July it reached ' +
  'its highest point, at almost forty thousand visitors. However, the ' +
  'number fell in August and September, and by October it was back to ' +
  'around twenty thousand. In November and December, visitor numbers ' +
  'were lower still, at about twelve thousand. There are several possible ' +
  'reasons for this pattern. First, many families travel during the ' +
  'school holidays in the summer, and the museum is a popular place to ' +
  'visit on a rainy day. Second, the museum held a special exhibition ' +
  'in July, which brought in many extra visitors from other towns. ' +
  'Finally, the cold weather in the winter months may put some people ' +
  'off travelling. In conclusion, the museum is busiest in the summer ' +
  'and quietest in the winter, and the summer exhibition clearly helped ' +
  'to lift the numbers even higher than usual.';

describe('loadLocalWritingFeedback', () => {
  it('resolves against the landed src/lib/feedback.ts port', async () => {
    const prompt = getWritingPrompt('WA-T1-01');
    expect(prompt).toBeDefined();
    const feedback = await loadLocalWritingFeedback(
      prompt!,
      SAMPLE_TEXT,
    );
    expect(feedback).not.toBeNull();
    expect(feedback!.band_low).toBeGreaterThanOrEqual(4);
    expect(feedback!.band_high).toBeLessThanOrEqual(8);
    expect(feedback!.band_low).toBeLessThanOrEqual(feedback!.band_high);
    expect(feedback!.word_count).toBeGreaterThan(150);
    expect(feedback!.meets_minimum).toBe(true);
    expect(Object.keys(feedback!.criteria).sort()).toEqual([
      'coherence',
      'grammar',
      'lexical',
      'task_achievement',
    ]);
    expect(feedback!.limits.length).toBeGreaterThan(20);
  });
});
