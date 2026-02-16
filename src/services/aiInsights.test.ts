import { describe, expect, it } from 'vitest';
import { mergeDailySuggestions } from './suggestionMerge';

describe('mergeDailySuggestions', () => {
  it('falls back to rule suggestions when AI is unavailable', () => {
    const rules = [
      { id: 'feed-window', title: 'Likely next feed window', detail: 'Around 9:00' },
      { id: 'diaper-rate', title: 'Diaper rhythm', detail: '5/day' },
    ];

    const merged = mergeDailySuggestions(rules, null, 4);
    expect(merged).toHaveLength(2);
    expect(merged[0].source).toBe('rule');
  });

  it('dedupes semantically similar AI and rule suggestions', () => {
    const rules = [{ id: 'temp-trend', title: 'Temperature trend watch', detail: 'Monitor fever' }];
    const ai = {
      date: '2026-02-16',
      cached: false,
      suggestions: [
        { id: 'ai-temp', title: 'Temperature check', detail: 'Watch for fever spikes', source: 'ai' as const },
      ],
    };

    const merged = mergeDailySuggestions(rules, ai, 4);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('ai');
  });

  it('caps output length', () => {
    const rules = [
      { id: 'r1', title: 'A', detail: 'a' },
      { id: 'r2', title: 'B', detail: 'b' },
      { id: 'r3', title: 'C', detail: 'c' },
      { id: 'r4', title: 'D', detail: 'd' },
    ];
    const ai = {
      date: '2026-02-16',
      cached: false,
      suggestions: [{ id: 'ai-1', title: 'Medication timing', detail: 'Plan next dose', source: 'ai' as const }],
    };

    const merged = mergeDailySuggestions(rules, ai, 4);
    expect(merged.length).toBeLessThanOrEqual(4);
  });
});
