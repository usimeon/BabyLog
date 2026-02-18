// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateDailyInsights } from '../_shared/ai-daily-insights-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const todayDate = () => new Date().toISOString().slice(0, 10);

const parseDate = (input?: string) => {
  if (!input) return todayDate();
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : todayDate();
};

const parseMaxBabies = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.max(1, Math.min(200, Math.floor(n)));
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const expectedSecret = Deno.env.get('AI_CRON_SECRET') ?? '';
  if (!expectedSecret) return json({ error: 'AI_CRON_SECRET is missing' }, 500);

  const incomingSecret = req.headers.get('x-cron-secret') ?? '';
  if (incomingSecret !== expectedSecret) return json({ error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const openAiApiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  const openAiModel = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

  if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Supabase env is missing' }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey);

  let body: { date?: string; maxBabies?: number } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const date = parseDate(body.date);
  const maxBabies = parseMaxBabies(body.maxBabies);

  const { data: babies, error: babyErr } = await admin
    .from('babies')
    .select('id,user_id,updated_at')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(maxBabies);

  if (babyErr) return json({ error: babyErr.message }, 500);

  let generated = 0;
  let cached = 0;
  let failed = 0;

  for (const baby of babies ?? []) {
    try {
      const result = await generateDailyInsights({
        admin,
        userId: baby.user_id,
        babyId: baby.id,
        date,
        openAiApiKey,
        openAiModel,
      });
      if (result.cached) {
        cached += 1;
      } else {
        generated += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return json({
    ok: true,
    date,
    processed: (babies ?? []).length,
    generated,
    cached,
    failed,
  });
});
