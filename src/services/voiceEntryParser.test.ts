import { describe, expect, it } from 'vitest';
import { parseVoiceEntry } from './voiceEntryParser';

describe('voiceEntryParser', () => {
  it('parses bottle feed phrase', () => {
    const parsed = parseVoiceEntry('Bottle feed 4 oz 20 minutes');
    expect(parsed?.type).toBe('feed');
    if (parsed?.type !== 'feed') return;
    expect(parsed.feedType).toBe('bottle');
    expect(parsed.durationMinutes).toBe(20);
    expect(parsed.amountMl).toBeGreaterThan(110);
  });

  it('parses medication phrase with spacing', () => {
    const parsed = parseVoiceEntry('Medication Tylenol 2.5 ml every 4h');
    expect(parsed?.type).toBe('medication');
    if (parsed?.type !== 'medication') return;
    expect(parsed.medicationName).toContain('tylenol');
    expect(parsed.doseValue).toBe(2.5);
    expect(parsed.minIntervalHours).toBe(4);
  });

  it('parses milestone phrase', () => {
    const parsed = parseVoiceEntry('Milestone first steps today');
    expect(parsed?.type).toBe('milestone');
    if (parsed?.type !== 'milestone') return;
    expect(parsed.title.toLowerCase()).toContain('first steps');
  });
});
