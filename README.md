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
- Today dashboard with:
  - last feed time
  - next reminder time
  - total amount today
  - average interval (last 24h)

### Measurements
- Add/edit/delete measurements
- Fields: timestamp, weight, length, head circumference, notes
- List + weight chart

### Care logs
- Temperature tracking (timestamp, temperature C, notes)
- Poop/Pee tracking (timestamp, pee yes/no, poop yes/no, poop size small/medium/large, notes)
- `Care` tab provides add + history + delete

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
- Weight chart over time
- Chart export to PNG using view capture

### Exports
- `exportChartImage(chartId, dateRange)`
- `exportPdf(dateRange)`
- `exportExcel(dateRange)`

Excel sheets:
- `FeedEvents`
- `Measurements`
- `DailySummary`

### Sync behavior
- Offline-first writes to SQLite
- Background sync on app launch + app foreground
- LWW conflict handling (`updated_at`)
- RLS in Supabase ensures users only access their own data
- Sync status banner shows in Today/Settings with last successful sync time

### QA helper
- `Settings -> QA Tools -> Seed Demo Data` creates sample feeds/measurements quickly
- `Settings -> QA Tools -> Clear Local Tracking Data` resets local history

## Notes
- Canonical storage units:
  - feed amount: `amount_ml`
  - weight: `weight_kg`
- UI unit conversion supports ml/oz and kg/lb.

## Supabase env troubleshooting
- Ensure the file is exactly `/Users/simeon/Documents/MY APPS/Shyla/.env`
- Variable names must start with `EXPO_PUBLIC_`
- Do not wrap values in quotes
- Restart Expo with cache clear after changes
