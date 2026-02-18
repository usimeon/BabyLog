// @ts-nocheck

type Json = Record<string, unknown>;

export type Suggestion = {
  id: string;
  title: string;
  detail: string;
  source: 'ai';
};

const safeDetail = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, 220) || fallback;
};

const safeTitle = (value: unknown, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, 60) || fallback;
};

export const sanitizeSuggestions = (raw: unknown): Suggestion[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 4)
    .map((item, index) => {
      const obj = typeof item === 'object' && item !== null ? (item as Json) : {};
      return {
        id: `ai-${index + 1}`,
        title: safeTitle(obj.title, `Insight ${index + 1}`),
        detail: safeDetail(obj.detail, 'Informational only. Not medical advice.'),
        source: 'ai' as const,
      };
    })
    .filter((x) => x.title.length > 0 && x.detail.length > 0);
};

const tryParseAiOutput = (content: string): Suggestion[] => {
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned) as Json;
    const suggestions = sanitizeSuggestions(parsed.suggestions);
    return suggestions;
  } catch {
    return [];
  }
};

const capText = (value: string, max = 5000) => (value.length <= max ? value : value.slice(0, max));

const getAgeContext = (birthdateIso: string | null, date: string) => {
  if (!birthdateIso) return null;
  const birth = new Date(birthdateIso);
  if (Number.isNaN(birth.getTime())) return null;

  const target = new Date(`${date}T12:00:00.000Z`);
  const ageDays = Math.floor((target.getTime() - birth.getTime()) / (24 * 60 * 60 * 1000));
  if (!Number.isFinite(ageDays) || ageDays < 0) return null;

  const ageWeeks = Math.floor(ageDays / 7);
  const ageMonthsApprox = Math.floor(ageDays / 30.4375);
  const phase =
    ageDays <= 56
      ? 'newborn'
      : ageDays <= 365
        ? 'infant'
        : ageDays <= 1095
          ? 'toddler'
          : 'child';

  return {
    ageDays,
    ageWeeks,
    ageMonthsApprox,
    phase,
  };
};

export const generateDailyInsights = async ({
  admin,
  userId,
  babyId,
  date,
  openAiApiKey,
  openAiModel,
}: {
  admin: any;
  userId: string;
  babyId: string;
  date: string;
  openAiApiKey: string;
  openAiModel: string;
}) => {
  const { data: baby } = await admin
    .from('babies')
    .select('id,name,birthdate')
    .eq('id', babyId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!baby) return { date, suggestions: [], cached: false, missing: true };

  const { data: cachedRow } = await admin
    .from('daily_ai_insights')
    .select('payload_json')
    .eq('user_id', userId)
    .eq('baby_id', babyId)
    .eq('date', date)
    .maybeSingle();

  if (cachedRow?.payload_json) {
    const payload = cachedRow.payload_json as Json;
    const suggestions = sanitizeSuggestions(payload.suggestions);
    return { date, suggestions, cached: true, missing: false };
  }

  const dayEndIso = `${date}T23:59:59.999Z`;
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const lookbackStart = new Date(dayStart.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const [feedsRes, diapersRes, tempsRes, medsRes, milestonesRes] = await Promise.all([
    admin
      .from('feed_events')
      .select('timestamp,amount_ml,type')
      .eq('user_id', userId)
      .eq('baby_id', babyId)
      .is('deleted_at', null)
      .gte('timestamp', lookbackStart)
      .lte('timestamp', dayEndIso)
      .order('timestamp', { ascending: false })
      .limit(400),
    admin
      .from('diaper_logs')
      .select('timestamp,had_poop,had_pee')
      .eq('user_id', userId)
      .eq('baby_id', babyId)
      .is('deleted_at', null)
      .gte('timestamp', lookbackStart)
      .lte('timestamp', dayEndIso)
      .order('timestamp', { ascending: false })
      .limit(400),
    admin
      .from('temperature_logs')
      .select('timestamp,temperature_c')
      .eq('user_id', userId)
      .eq('baby_id', babyId)
      .is('deleted_at', null)
      .gte('timestamp', lookbackStart)
      .lte('timestamp', dayEndIso)
      .order('timestamp', { ascending: false })
      .limit(200),
    admin
      .from('medication_logs')
      .select('timestamp,medication_name,min_interval_hours')
      .eq('user_id', userId)
      .eq('baby_id', babyId)
      .is('deleted_at', null)
      .gte('timestamp', lookbackStart)
      .lte('timestamp', dayEndIso)
      .order('timestamp', { ascending: false })
      .limit(200),
    admin
      .from('milestones')
      .select('timestamp,title')
      .eq('user_id', userId)
      .eq('baby_id', babyId)
      .is('deleted_at', null)
      .gte('timestamp', lookbackStart)
      .lte('timestamp', dayEndIso)
      .order('timestamp', { ascending: false })
      .limit(20),
  ]);

  const feeds = feedsRes.data ?? [];
  const diapers = diapersRes.data ?? [];
  const temps = tempsRes.data ?? [];
  const meds = medsRes.data ?? [];
  const milestones = milestonesRes.data ?? [];

  const feedDayMap = new Map<string, { count: number; totalMl: number }>();
  for (const row of feeds) {
    const day = String(row.timestamp).slice(0, 10);
    const existing = feedDayMap.get(day) ?? { count: 0, totalMl: 0 };
    existing.count += 1;
    existing.totalMl += Number(row.amount_ml ?? 0);
    feedDayMap.set(day, existing);
  }

  const diaperDayMap = new Map<string, number>();
  for (const row of diapers) {
    const day = String(row.timestamp).slice(0, 10);
    diaperDayMap.set(day, (diaperDayMap.get(day) ?? 0) + 1);
  }

  const highTempCount = temps.filter((x) => Number(x.temperature_c ?? 0) >= 38).length;
  const latestTemp = temps[0] ? Number(temps[0].temperature_c ?? 0) : null;
  const ageContext = getAgeContext(typeof baby.birthdate === 'string' ? baby.birthdate : null, date);

  const compactPayload = {
    date,
    baby: {
      name: baby.name ?? null,
      birthdate: baby.birthdate ?? null,
      ageDays: ageContext?.ageDays ?? null,
      ageWeeks: ageContext?.ageWeeks ?? null,
      ageMonthsApprox: ageContext?.ageMonthsApprox ?? null,
      phase: ageContext?.phase ?? null,
    },
    feedCountsByDay: Array.from(feedDayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([day, val]) => ({ day, count: val.count, totalMl: Number(val.totalMl.toFixed(1)) })),
    diaperCountsByDay: Array.from(diaperDayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([day, count]) => ({ day, count })),
    temperature: {
      highTempCount,
      latestC: latestTemp,
    },
    medications: meds.slice(0, 6).map((x) => ({
      timestamp: x.timestamp,
      name: x.medication_name,
      minIntervalHours: x.min_interval_hours,
    })),
    milestones: milestones.slice(0, 4).map((x) => ({ timestamp: x.timestamp, title: x.title })),
  };

  let aiSuggestions: Suggestion[] = [];

  if (openAiApiKey) {
    const prompt = capText(JSON.stringify(compactPayload));
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${openAiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: openAiModel,
          temperature: 0.2,
          max_tokens: 220,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You generate 3-4 concise baby-care suggestions from aggregates only. Informational only, not medical advice. Never diagnose. Consider age context when present and tune routine/milestone expectations accordingly. If fever pattern appears, suggest contacting pediatric care. Return strict JSON: {"suggestions":[{"title":"...","detail":"..."}]}',
            },
            {
              role: 'user',
              content: `Analyze this daily baby aggregate payload and return actionable suggestions:\n${prompt}`,
            },
          ],
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as Json;
        const content =
          ((data.choices as Array<{ message?: { content?: string } }> | undefined)?.[0]?.message?.content ?? '').trim();
        if (content) aiSuggestions = tryParseAiOutput(content);
      }
    } catch {
      // Graceful fallback to deterministic suggestions in the app.
    }
  }

  const payloadJson = { suggestions: aiSuggestions };
  await admin.from('daily_ai_insights').upsert(
    {
      id: crypto.randomUUID(),
      user_id: userId,
      baby_id: babyId,
      date,
      payload_json: payloadJson,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,baby_id,date' },
  );

  return { date, suggestions: aiSuggestions, cached: false, missing: false };
};
