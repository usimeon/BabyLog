# BabyLog (Expo + React Native + TypeScript)

BabyLog is an iOS-focused baby tracking app with:
- Offline-first local data storage via SQLite
- Optional Supabase auth + cloud sync
- Feed and measurement logging
- Reminder notifications
- Charts
- Export to PNG/PDF/XLSX

## Stack
- Expo SDK 54
- React Native + TypeScript
- `expo-sqlite`
- `expo-notifications`
- `expo-print`
- `expo-file-system`
- `expo-sharing`
- `react-native-svg`
- Supabase (`@supabase/supabase-js`)

## Project structure

```
src/
  app/
  components/
  context/
  db/
  screens/
  services/
  supabase/
  types/
  utils/
supabase/
  schema.sql
```

## 1) Prerequisites (macOS M3)
- Xcode + iOS Simulator installed
- Node.js 20+
- npm 10+

## 2) Install dependencies

```bash
npm install
```

## 3) Configure Supabase (optional, for cloud sync)

1. Create a project in Supabase.
2. In SQL Editor, run `/supabase/schema.sql`.
3. In Authentication settings, enable Email/Password.
4. Copy your project URL + anon key.
5. Create `.env` in repo root:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID=YOUR_GOOGLE_DRIVE_OAUTH_CLIENT_ID
EXPO_PUBLIC_DROPBOX_APP_KEY=YOUR_DROPBOX_APP_KEY
EXPO_PUBLIC_OAUTH_REDIRECT_SCHEME=com.example.babylog
```

Legacy fallback also supported:

```bash
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

If you update `.env`, restart Expo with cache clear:

```bash
npm run ios -- --clear
```

If these env vars are missing, app still works fully local/offline.

## 3.1) Terminal-based auto schema updates (recommended)

This repo is configured for Supabase CLI migrations. Use these commands:

```bash
npm run db:login
SUPABASE_PROJECT_REF=your_project_ref npm run db:setup
```

After that, future schema updates are one command:

```bash
npm run db:push
```

Key files:
- `supabase/config.toml`
- `supabase/migrations/20260216010000_init_babylog.sql`
- `supabase/migrations/20260216103000_daily_ai_insights.sql`

## 3.2) Backend AI daily insights (optional)

AI suggestions are generated on backend only through Supabase Edge Function.
No provider API key is stored in the mobile app bundle.

### Deploy SQL + function

```bash
npm run db:push
supabase functions deploy ai-daily-insights
```

### Set edge function secrets

```bash
supabase secrets set OPENAI_API_KEY=your_key_here
supabase secrets set OPENAI_MODEL=gpt-4o-mini
```

### Optional smoke test

```bash
npm run ai:smoke
```

Required env for smoke script:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_JWT`
- `BABY_ID`

## 4) Run typecheck

```bash
npm run typecheck
```

## 5) Run tests

```bash
npm test
```

## 6) Run on iOS simulator

```bash
npm run ios
```

## Features shipped

### Feeds
- Add/edit/delete feed events
- Fields: timestamp, type, amount, duration, side, notes
- New entries are created from one unified `Add Entry` screen
- Today dashboard with:
  - last feed time
  - next reminder time
  - total amount today
  - average interval (last 24h)

### Measurements
- Add/edit/delete measurements
- Fields: timestamp, weight, length, head circumference, notes
- Managed from unified `Logs` timeline + `Add Entry` screen
- New entries are created from one unified `Add Entry` screen

### Care logs
- Temperature tracking (timestamp, temperature C, notes)
- Poop/Pee tracking (timestamp, pee yes/no, poop yes/no, poop size small/medium/large, notes)
- Medication tracking (name, dose, dose unit, optional minimum spacing)
- Milestones (title, notes, optional photo)
- Managed from unified `Logs` timeline + `Add Entry` screen

### Logs workspace
- Single timeline for feed, growth, temperature, diaper, medication, and milestone entries
- Tap any log entry to edit inline in `Add Entry`
- Long press to delete
- Star icon to pin/unpin important entries, with `pinned` filter
- Export filtered/ranged Logs view directly to PDF or Excel
- Includes:
  - Today-at-a-glance counters
  - Smart safety alerts (feed gap, high temp, diaper gap, low feeds/day, medication spacing)

### Reminders
- Settings:
  - enabled
  - interval hours
  - quiet hours start/end
  - allow during quiet hours
- On feed add/edit/delete: exactly one upcoming reminder is recalculated and scheduled
- If disabled: reminder is cancelled

### Charts
- Feed chart for last 7/30 days totals + interval trend
- Weight chart over time with percentile reference overlay (P10/P50/P90) and latest percentile estimate
- Care chart tab with temperature trend, diaper/day bars, and medication/day bars
- Chart export to PNG using view capture

### Exports
- `exportChartImage(chartId, dateRange)`
- `exportPdf(dateRange)`
- `exportExcel(dateRange)`
- `Settings -> Auto Backup` supports scheduled export backups to:
  - Share Sheet
  - Google Drive (direct upload after OAuth connect)
  - Dropbox (direct upload after OAuth connect)

Excel sheets:
- `FeedEvents`
- `Measurements`
- `TemperatureLogs`
- `DiaperLogs`
- `MedicationLogs`
- `Milestones`
- `DailySummary`

### Voice quick entry
- `Today -> Voice Quick Entry` parses dictated text into structured entries
- Works with iOS keyboard dictation microphone for quick hands-free logging

### Routine suggestions
- `Today` includes simple personalized routine suggestions from recent trends (feeds, diapers, temps, meds)
- AI daily trend analysis is merged with deterministic rules when available
- AI suggestions show `AI-assisted` label in `Today`
- If AI is unavailable/quota-limited, deterministic suggestions continue unchanged

### Free-tier AI strategy
- AI generation is cached per `(user, baby, date)` in `daily_ai_insights`
- Max one AI generation attempt per baby/day
- Compact aggregates are sent to model (not full raw history)
- Short output/token limits reduce cost

### Sync behavior
- Offline-first writes to SQLite
- Background sync on app launch + app foreground
- LWW conflict handling (`updated_at`)
- RLS in Supabase ensures users only access their own data
- Sync status banner shows in Today/Settings with last successful sync time

### QA helper
- `Settings -> QA Tools -> Seed Demo Data` creates ~6 months of sample feed/growth/temp/diaper/medication/milestone data
- `Settings -> QA Tools -> Clear Local Tracking Data` resets local history

## Notes
- Canonical storage units:
  - feed amount: `amount_ml`
  - weight: `weight_kg`
- temperature: `temperature_c`
- UI unit conversion supports ml/oz and kg/lb.
- Default units on fresh install:
  - weight: `lb`
  - temperature: `F`

## Google Drive / Dropbox setup
- Configure OAuth apps in provider consoles:
  - Google: create an `iOS` OAuth client (not Web), bundle id `com.example.babylog`, and use that client id as `EXPO_PUBLIC_GOOGLE_DRIVE_CLIENT_ID`.
  - Google callback is derived from the client id and looks like `com.googleusercontent.apps.<CLIENT_ID_PREFIX>:/oauth2redirect`.
  - Dropbox: add redirect URI `com.example.babylog://oauth2redirect` in Dropbox OAuth redirect list.
- Google OAuth consent screen:
  - set publishing status to `Testing`
  - add your Gmail account to `Test users`
- In app:
  - `Settings -> Auto Backup`
  - Choose destination
  - Tap `Connect Selected Provider`
  - Run backup

## Supabase env troubleshooting
- Ensure the file is exactly `/Users/simeon/Documents/MY APPS/Shyla/.env`
- Variable names must start with `EXPO_PUBLIC_`
- Do not wrap values in quotes
- Restart Expo with cache clear after changes
