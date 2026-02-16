import { AiDailyInsightsResponse, AiSuggestion } from '../types/ai';
import { RoutineSuggestion } from './routineSuggestions';

const textKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const semanticKey = (suggestion: Pick<AiSuggestion, 'id' | 'title' | 'detail'>) => {
  const haystack = `${suggestion.id} ${suggestion.title} ${suggestion.detail}`.toLowerCase();
  if (haystack.includes('temp') || haystack.includes('fever')) return 'temperature';
  if (haystack.includes('feed') || haystack.includes('bottle') || haystack.includes('formula')) return 'feeding';
  if (haystack.includes('diaper') || haystack.includes('pee') || haystack.includes('poop')) return 'diaper';
  if (haystack.includes('med') || haystack.includes('dose')) return 'medication';
  if (haystack.includes('milestone') || haystack.includes('growth') || haystack.includes('weight')) return 'growth';
  return textKey(suggestion.title).slice(0, 40) || textKey(suggestion.id);
};

const toRuleSuggestion = (item: RoutineSuggestion): AiSuggestion => ({
  id: item.id,
  title: item.title,
  detail: item.detail,
  source: 'rule',
});

export const mergeDailySuggestions = (
  ruleSuggestions: RoutineSuggestion[],
  aiInsights: AiDailyInsightsResponse | null,
  max = 4,
): AiSuggestion[] => {
  const rules = ruleSuggestions.map(toRuleSuggestion);
  if (!aiInsights?.suggestions?.length) {
    return rules.slice(0, max);
  }

  const ai = aiInsights.suggestions.map((item, index) => ({
    ...item,
    id: item.id || `ai-${index + 1}`,
    source: 'ai' as const,
  }));

  const combined = [...ai, ...rules];
  const deduped: AiSuggestion[] = [];
  const seen = new Set<string>();

  for (const suggestion of combined) {
    const key = semanticKey(suggestion);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(suggestion);
    if (deduped.length >= max) break;
  }

  return deduped;
};
