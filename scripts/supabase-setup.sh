#!/usr/bin/env bash
set -euo pipefail

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required (install Node.js + npm)."
  exit 1
fi

if [ -z "${SUPABASE_PROJECT_REF:-}" ]; then
  echo "SUPABASE_PROJECT_REF is required."
  echo "Example: SUPABASE_PROJECT_REF=abcd1234 npm run db:setup"
  exit 1
fi

echo "Linking Supabase project: ${SUPABASE_PROJECT_REF}"
npx supabase link --project-ref "${SUPABASE_PROJECT_REF}"

echo "Applying migrations with supabase db push"
npx supabase db push

echo "Done."
