#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const parseArgs = (argv) => {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      options[key] = 'true';
      continue;
    }
    options[key] = next;
    i += 1;
  }
  return options;
};

const toBoolean = (value, fallback = false) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return fallback;
};

const nowIso = () => new Date().toISOString();

const withResult = async (label, fn) => {
  try {
    const value = await fn();
    return { ok: true, label, value };
  } catch (error) {
    return { ok: false, label, error };
  }
};

const printResult = (result) => {
  if (result.ok) {
    console.log(`[ok] ${result.label}`);
    return;
  }
  const message = result.error?.message ?? String(result.error ?? 'Unknown error');
  console.error(`[fail] ${result.label}: ${message}`);
};

const requiredEnv = (keys) => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return '';
};

const loadDotEnv = () => {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    if (!key || process.env[key] != null) continue;

    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
};

loadDotEnv();

const args = parseArgs(process.argv.slice(2));
const supabaseUrl =
  args['supabase-url'] ??
  requiredEnv(['EXPO_PUBLIC_SUPABASE_URL']);
const supabaseAnonKey =
  args['supabase-key'] ??
  requiredEnv([
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'EXPO_PUBLIC_SUPABASE_KEY',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  ]);
const email = (args.email ?? process.env.BABYLOG_TEST_EMAIL ?? '').trim();
const password = (args.password ?? process.env.BABYLOG_TEST_PASSWORD ?? '').trim();
const resetUserData = toBoolean(args.reset ?? process.env.BABYLOG_CHECK_RESET, false);
const expectNoProfilesAtStart = toBoolean(
  args['expect-no-profile'] ?? process.env.BABYLOG_EXPECT_NO_PROFILE,
  true,
);
const cleanupOnly = toBoolean(
  args['cleanup-only'] ?? process.env.BABYLOG_CHECK_CLEANUP_ONLY,
  false,
);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or pass --supabase-url/--supabase-key).',
  );
  process.exit(1);
}

if (!email || !password) {
  console.error('Missing credentials. Provide --email and --password (or BABYLOG_TEST_EMAIL/BABYLOG_TEST_PASSWORD).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
});

const deleteByUser = async (table, userId) => {
  const { error } = await supabase.from(table).delete().eq('user_id', userId);
  if (error) throw error;
};

const run = async () => {
  console.log(`Running onboarding flow check for ${email}`);

  const signInResult = await withResult('sign in', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('No user returned from auth.');
    return data.user;
  });
  printResult(signInResult);
  if (!signInResult.ok) {
    process.exit(1);
  }

  const userId = signInResult.value.id;
  console.log(`Authenticated user id: ${userId}`);

  if (resetUserData) {
    console.log('Resetting user data...');
    const tables = [
      'daily_ai_insights',
      'feed_events',
      'measurements',
      'temperature_logs',
      'diaper_logs',
      'medication_logs',
      'milestones',
      'babies',
    ];
    for (const table of tables) {
      const result = await withResult(`delete ${table}`, () => deleteByUser(table, userId));
      printResult(result);
      if (!result.ok) {
        process.exit(1);
      }
    }
  }

  const initialBabiesResult = await withResult('read existing babies', async () => {
    const { data, error } = await supabase
      .from('babies')
      .select('id,name,birthdate,created_at')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  });
  printResult(initialBabiesResult);
  if (!initialBabiesResult.ok) {
    process.exit(1);
  }

  const initialBabies = initialBabiesResult.value;
  console.log(`Initial baby count: ${initialBabies.length}`);
  if (expectNoProfilesAtStart && initialBabies.length > 0) {
    console.error(
      `Expected 0 profiles at start, found ${initialBabies.length}. Re-run with --reset true (or disable expectation).`,
    );
    process.exit(1);
  }

  if (cleanupOnly) {
    console.log('Cleanup-only mode complete. No profile was inserted.');
    return;
  }

  const seed = `${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const babyId = `baby_${seed}`;
  const measurementId = `measure_${seed}`;
  const createdAt = nowIso();
  const onboardingBirthdate = '2026-01-21T12:00:00.000Z';

  const createBabyResult = await withResult('insert onboarding baby profile', async () => {
    const payload = {
      id: babyId,
      user_id: userId,
      name: `Automation Baby ${seed}`,
      birthdate: onboardingBirthdate,
      photo_uri: null,
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null,
    };
    const { error } = await supabase.from('babies').insert(payload);
    if (error) throw error;
  });
  printResult(createBabyResult);
  if (!createBabyResult.ok) {
    process.exit(1);
  }

  const createMeasurementResult = await withResult('insert onboarding measurement', async () => {
    const payload = {
      id: measurementId,
      user_id: userId,
      baby_id: babyId,
      timestamp: onboardingBirthdate,
      weight_kg: 3.2,
      length_cm: 50,
      head_circumference_cm: 34,
      notes: 'Initial onboarding measurement',
      created_at: createdAt,
      updated_at: createdAt,
      deleted_at: null,
    };
    const { error } = await supabase.from('measurements').insert(payload);
    if (error) throw error;
  });
  printResult(createMeasurementResult);
  if (!createMeasurementResult.ok) {
    process.exit(1);
  }

  const verifyResult = await withResult('verify profile + first profile selection', async () => {
    const [{ data: babies, error: babyError }, { data: measurements, error: measureError }] = await Promise.all([
      supabase
        .from('babies')
        .select('id,name,birthdate,created_at')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true }),
      supabase
        .from('measurements')
        .select('id,baby_id,notes,timestamp,weight_kg,created_at')
        .eq('user_id', userId)
        .eq('baby_id', babyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
    ]);

    if (babyError) throw babyError;
    if (measureError) throw measureError;

    const allBabies = babies ?? [];
    const allMeasurements = measurements ?? [];
    const firstProfile = allBabies[0] ?? null;

    if (!allBabies.find((item) => item.id === babyId)) {
      throw new Error('Created baby profile not found in Supabase.');
    }
    if (!allMeasurements.find((item) => item.id === measurementId)) {
      throw new Error('Created onboarding measurement not found in Supabase.');
    }

    return {
      totalBabies: allBabies.length,
      totalMeasurementsForCreatedBaby: allMeasurements.length,
      firstProfileId: firstProfile?.id ?? null,
      firstProfileName: firstProfile?.name ?? null,
    };
  });
  printResult(verifyResult);
  if (!verifyResult.ok) {
    process.exit(1);
  }

  const summary = verifyResult.value;
  console.log('--- Summary ---');
  console.log(`babies.total=${summary.totalBabies}`);
  console.log(`measurements.for_created_baby=${summary.totalMeasurementsForCreatedBaby}`);
  console.log(`first_profile.id=${summary.firstProfileId}`);
  console.log(`first_profile.name=${summary.firstProfileName}`);
  console.log('Onboarding backend check passed.');
};

run().catch((error) => {
  console.error(error?.message ?? String(error));
  process.exit(1);
});
