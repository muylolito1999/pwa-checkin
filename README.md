# NYE Party 2026 - Check-In System

A production-ready Progressive Web Application for managing event check-ins. Offline-first, mobile-optimized, with real-time sync and statistics.

## Features

- **Guest Management** - Import guests from CSV, search by name/ticket code
- **One-Click Check-In** - Big, touch-friendly buttons for fast check-ins
- **Real-Time Statistics** - Live arrival charts, peak time detection
- **PWA Support** - Install as app, works offline
- **Offline-First Sync** - Local-first with background sync to Supabase
- **Dark Mode** - System preference or manual toggle

## Tech Stack

- **Framework**: Next.js 15 (App Router) + TypeScript
- **UI**: TailwindCSS + shadcn/ui + next-themes
- **Backend**: Supabase (Postgres)
- **Offline Storage**: Dexie.js (IndexedDB)
- **Service Worker**: Serwist
- **Charts**: Recharts

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

> **Note**: The app works in offline-only mode without Supabase configuration.

### 3. Set Up Database (Optional)

If using Supabase, run the migration:

```bash
# Using Supabase CLI
supabase db push

# Or manually run the SQL in Supabase Dashboard
# File: supabase/migrations/001_initial_schema.sql
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Build for Production

```bash
npm run build
npm start
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | No* | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No* | Supabase anonymous key |
| `NEXT_PUBLIC_APP_URL` | No | Production app URL |

*App works offline-only without Supabase

## Usage

### Login

1. Enter Event ID (from Supabase or create local)
2. Enter Access Code (if configured)
3. Click "Sign In" or "Create Local Event"

### Import Guests

1. Go to Import tab
2. Drag & drop CSV or click to browse
3. Preview and validate data
4. Click "Import"

**CSV Format:**
```csv
last_name,first_name,group,phone,notes,ticket_code
Rossi,Mario,VIP,3331234567,Plus one,TKT001
```

Required columns: `first_name`, `last_name`

### Check-In Guests

1. Go to Guests tab
2. Search by name or ticket code
3. Click green "CHECK IN" button
4. Click red "CHECK OUT" to reverse

### View Statistics

1. Go to Stats tab
2. View real-time counters
3. See arrival histogram and timeline
4. Monitor recent activity

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/       # Login page
│   ├── (dashboard)/        # Protected routes
│   │   ├── guests/         # Guest list
│   │   ├── import/         # CSV import
│   │   ├── stats/          # Statistics
│   │   └── settings/       # App settings
│   └── sw.ts               # Service worker
├── components/
│   ├── ui/                 # shadcn/ui components
│   ├── layout/             # Header, install banner
│   ├── guests/             # Guest table, check-in button
│   ├── import/             # CSV dropzone, preview
│   └── stats/              # Charts, counters
├── hooks/                  # React hooks
├── lib/
│   ├── db/                 # Dexie database
│   ├── supabase/           # Supabase client
│   ├── sync/               # Sync engine
│   └── csv/                # CSV parser
├── types/                  # TypeScript types
└── schemas/                # Zod schemas
```

## Offline Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   UI Layer  │────▶│  Dexie.js   │────▶│   Outbox    │
│   (React)   │     │ (IndexedDB) │     │   Queue     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                          ┌────────────────────┘
                          ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Service   │◀────│    Sync     │────▶│  Supabase   │
│   Worker    │     │   Engine    │     │  (Postgres) │
└─────────────┘     └─────────────┘     └─────────────┘
```

- **Write Path**: UI → Dexie → Outbox Queue
- **Sync Path**: Outbox → Supabase (push) → Dexie (pull)
- **Read Path**: Dexie → UI (reactive via useLiveQuery)

## License

MIT
