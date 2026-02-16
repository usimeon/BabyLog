import { listFeeds } from '../db/feedRepo';
import { listMeasurements } from '../db/measurementRepo';
import { listTemperatureLogs } from '../db/temperatureRepo';
import { listDiaperLogs } from '../db/diaperRepo';
import { getAiLastSummary, setAiLastSummary } from '../db/settingsRepo';

export type AiSummary = {
  generatedAt: string;
  source: 'remote' | 'local';
  bullets: string[];
  disclaimer: string;
};

type AiPayload = {
  generatedAt: string;
  stats24h: {
    feeds: number;
    bottleFormulaMl: number;
    diapers: number;
    temperatures: number;
  };
  stats7d: {
    feeds: number;
    measurements: number;
    diapers: number;
    temperatures: number;
  };
  latest: {
    feedAt?: string;
    temperatureC?: number;
    weightKg?: number;
  };
};

const AI_DISCLAIMER = 'Informational only. Not medical advice.';

const endpoint = (process.env.EXPO_PUBLIC_AI_SUMMARY_ENDPOINT ?? '').trim();

const buildPayload = async (babyId: string): Promise<AiPayload> => {
  const [feeds, measurements, temperatures, diapers] = await Promise.all([
    listFeeds(babyId),
    listMeasurements(babyId),
    listTemperatureLogs(babyId),
    listDiaperLogs(babyId),
  ]);

  const now = Date.now();
  const cutoff24h = now - 24 * 60 * 60 * 1000;
  const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;

  const feeds24h = feeds.filter((x) => new Date(x.timestamp).getTime() >= cutoff24h);
  const diapers24h = diapers.filter((x) => new Date(x.timestamp).getTime() >= cutoff24h);
  const temps24h = temperatures.filter((x) => new Date(x.timestamp).getTime() >= cutoff24h);

  const feeds7d = feeds.filter((x) => new Date(x.timestamp).getTime() >= cutoff7d);
  const measurements7d = measurements.filter((x) => new Date(x.timestamp).getTime() >= cutoff7d);
  const diapers7d = diapers.filter((x) => new Date(x.timestamp).getTime() >= cutoff7d);
  const temps7d = temperatures.filter((x) => new Date(x.timestamp).getTime() >= cutoff7d);

  const bottleFormulaMl24h = feeds24h
    .filter((x) => x.type === 'bottle' || x.type === 'formula')
    .reduce((sum, x) => sum + (x.amount_ml ?? 0), 0);

  return {
    generatedAt: new Date().toISOString(),
    stats24h: {
      feeds: feeds24h.length,
      bottleFormulaMl: Number(bottleFormulaMl24h.toFixed(1)),
      diapers: diapers24h.length,
      temperatures: temps24h.length,
    },
    stats7d: {
      feeds: feeds7d.length,
      measurements: measurements7d.length,
      diapers: diapers7d.length,
      temperatures: temps7d.length,
    },
    latest: {
      feedAt: feeds[0]?.timestamp,
      temperatureC: temperatures[0] ? Number(temperatures[0].temperature_c) : undefined,
      weightKg: measurements[0] ? Number(measurements[0].weight_kg) : undefined,
    },
  };
};

const localSummary = (payload: AiPayload): AiSummary => {
  const bullets: string[] = [];

  bullets.push(`Last 24h: ${payload.stats24h.feeds} feeds, ${payload.stats24h.diapers} diaper logs.`);
  bullets.push(`Bottle/formula total (24h): ${payload.stats24h.bottleFormulaMl.toFixed(1)} ml.`);

  if (payload.stats24h.temperatures === 0) {
    bullets.push('No temperature checks logged in the last 24 hours.');
  } else {
    bullets.push(`Temperature checks (24h): ${payload.stats24h.temperatures}.`);
  }

  if (payload.latest.temperatureC !== undefined && payload.latest.temperatureC >= 38) {
    bullets.push(`Latest logged temperature is elevated (${payload.latest.temperatureC.toFixed(1)} C).`);
  }

  bullets.push(`Last 7d: ${payload.stats7d.feeds} feeds, ${payload.stats7d.diapers} diapers, ${payload.stats7d.measurements} growth logs.`);

  return {
    generatedAt: payload.generatedAt,
    source: 'local',
    bullets,
    disclaimer: AI_DISCLAIMER,
  };
};

const remoteSummary = async (payload: AiPayload): Promise<AiSummary | null> => {
  if (!endpoint) return null;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      task: 'Generate concise parent-friendly baby log insights from structured stats.',
      constraints: [
        'Max 5 bullets.',
        'No diagnosis.',
        'If elevated temp appears, suggest consulting clinician if concerned.',
      ],
      payload,
    }),
  });

  if (!response.ok) return null;
  const data = (await response.json()) as { bullets?: string[] };
  if (!Array.isArray(data.bullets) || !data.bullets.length) return null;

  return {
    generatedAt: payload.generatedAt,
    source: 'remote',
    bullets: data.bullets.slice(0, 5),
    disclaimer: AI_DISCLAIMER,
  };
};

export const generateAiSummary = async (babyId: string): Promise<AiSummary> => {
  const payload = await buildPayload(babyId);
  const remote = await remoteSummary(payload).catch(() => null);
  const summary = remote ?? localSummary(payload);
  await setAiLastSummary(JSON.stringify(summary));
  return summary;
};

export const getCachedAiSummary = async (): Promise<AiSummary | null> => {
  const raw = await getAiLastSummary();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AiSummary;
    if (!parsed || !Array.isArray(parsed.bullets)) return null;
    return parsed;
  } catch {
    return null;
  }
};
