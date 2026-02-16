import http from 'node:http';

const PORT = Number(process.env.AI_SERVER_PORT || 8787);

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const json = (res, status, data) => {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
  });
  res.end(JSON.stringify(data));
};

const buildBullets = (payload) => {
  const bullets = [];
  const s24 = payload?.stats24h ?? {};
  const s7 = payload?.stats7d ?? {};
  const latest = payload?.latest ?? {};

  bullets.push(
    `In the last 24h: ${s24.feeds ?? 0} feeds, ${s24.diapers ?? 0} diaper logs, ${s24.temperatures ?? 0} temperature checks.`,
  );

  if ((s24.bottleFormulaMl ?? 0) > 0) {
    bullets.push(`Bottle/formula volume in last 24h: ${Number(s24.bottleFormulaMl).toFixed(1)} ml.`);
  }

  bullets.push(
    `In the last 7 days: ${s7.feeds ?? 0} feeds, ${s7.diapers ?? 0} diaper logs, ${s7.measurements ?? 0} growth logs.`,
  );

  if (latest?.temperatureC !== undefined && Number(latest.temperatureC) >= 38) {
    bullets.push(
      `Latest recorded temperature is ${Number(latest.temperatureC).toFixed(1)} C; consider clinical guidance if concerns persist.`,
    );
  }

  if ((s24.feeds ?? 0) === 0) {
    bullets.push('No feed entries in the last 24h. Consider checking whether tracking is up to date.');
  }

  return bullets.slice(0, 5);
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization',
    });
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/ai-summary') {
    json(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};
    const payload = body?.payload ?? {};

    const bullets = buildBullets(payload);
    json(res, 200, { bullets });
  } catch (error) {
    json(res, 400, { error: 'Invalid request body' });
  }
});

server.listen(PORT, () => {
  console.log(`AI summary server listening on http://localhost:${PORT}/ai-summary`);
});
