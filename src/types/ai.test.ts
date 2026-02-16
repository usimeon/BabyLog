import { describe, expect, it } from 'vitest';
import { isAiDailyInsightsResponse } from './ai';

describe('ai response validator', () => {
  it('accepts valid payload', () => {
    const payload = {
      date: '2026-02-16',
      cached: true,
      suggestions: [
        { id: 'ai-1', title: 'Feed consistency', detail: 'Good trend', source: 'ai' },
        { id: 'rule-1', title: 'Diaper rhythm', detail: 'Stable', source: 'rule' },
      ],
    };
    expect(isAiDailyInsightsResponse(payload)).toBe(true);
  });

  it('rejects invalid payload shape', () => {
    const payload = {
      date: 123,
      cached: 'yes',
      suggestions: [{ title: 'No id' }],
    };
    expect(isAiDailyInsightsResponse(payload)).toBe(false);
  });
});
