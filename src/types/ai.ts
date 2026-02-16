export type AiSuggestion = {
  id: string;
  title: string;
  detail: string;
  source: 'ai' | 'rule';
};

export type AiDailyInsightsResponse = {
  date: string;
  suggestions: AiSuggestion[];
  cached: boolean;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isAiSuggestion = (value: unknown): value is AiSuggestion => {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.detail === 'string' &&
    (value.source === 'ai' || value.source === 'rule')
  );
};

export const isAiDailyInsightsResponse = (value: unknown): value is AiDailyInsightsResponse => {
  if (!isObject(value)) return false;
  if (typeof value.date !== 'string') return false;
  if (typeof value.cached !== 'boolean') return false;
  if (!Array.isArray(value.suggestions)) return false;
  return value.suggestions.every(isAiSuggestion);
};

