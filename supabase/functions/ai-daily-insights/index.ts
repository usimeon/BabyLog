// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { generateDailyInsights } from '../_shared/ai-daily-insights-core.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

const parseBearer = (authHeader: string | null) => {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const openAiApiKey = Deno.env.get('OPENAI_API_KEY') ?? '';
  const openAiModel = Deno.env.get('OPENAI_MODEL') ?? 'gpt-4o-mini';

  if (!supabaseUrl || !serviceRoleKey) {
    return json({ date: todayDate(), suggestions: [], cached: false });
  }

  const token = parseBearer(req.headers.get('authorization'));
  if (!token) return json({ error: 'Unauthorized' }, 401);

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(token);

  if (userError || !user) return json({ error: 'Unauthorized' }, 401);

  let body: { babyId?: string; date?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const babyId = (body.babyId ?? '').trim();
  if (!babyId) return json({ error: 'babyId is required' }, 400);

  const date = parseDate(body.date);
  const response = await generateDailyInsights({
    admin,
    userId: user.id,
    babyId,
    date,
    openAiApiKey,
    openAiModel,
  });

  if (response.missing) return json({ error: 'Baby not found' }, 404);
  return json({ date: response.date, suggestions: response.suggestions, cached: response.cached });
});
