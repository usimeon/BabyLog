import { supabase } from '../supabase/client';
import { AiDailyInsightsResponse, isAiDailyInsightsResponse } from '../types/ai';
export { mergeDailySuggestions } from './suggestionMerge';

const todayDate = () => new Date().toISOString().slice(0, 10);

export const getAiDailyInsights = async (babyId: string, date = todayDate()): Promise<AiDailyInsightsResponse | null> => {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke('ai-daily-insights', {
      body: { babyId, date },
    });
    if (error) return null;
    if (!isAiDailyInsightsResponse(data)) return null;
    return data;
  } catch {
    return null;
  }
};
