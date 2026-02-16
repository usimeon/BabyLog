#!/usr/bin/env bash
set -euo pipefail

if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ] || [ -z "${SUPABASE_JWT:-}" ] || [ -z "${BABY_ID:-}" ]; then
  echo "Required env: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_JWT, BABY_ID"
  exit 1
fi

curl -sS "${SUPABASE_URL}/functions/v1/ai-daily-insights" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_JWT}" \
  -H "Content-Type: application/json" \
  -d "{\"babyId\":\"${BABY_ID}\"}" | sed 's/.*/AI daily insights response: &/'
