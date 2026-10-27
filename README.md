# PROM HALLOWEEN - Check-In

Offline-first Progressive Web App for checking guests in at PROM HALLOWEEN (and any later event). Every device keeps its own copy of the guest list in IndexedDB, works without a connection, and syncs in the background with Supabase. Multiple devices can check guests in at the same time.

## Features

- **Guest management**: import guests from CSV, add or remove them by hand, search by name, phone or ticket code
- **One-tap check-in / check-out** with large touch targets
- **Live statistics**: arrivals per time slot, cumulative timeline, peak window, recent activity
- **Installable PWA** that keeps working offline (update prompt instead of silent takeover)
- **Background sync** on every page: push queue with retry and backoff, incremental paginated pulls, never drops a change
- **Real security**: anonymous device sign-in + event membership enforced by row level security; access codes stored hashed
- **Event-agnostic**: the event name, date and access code live in the database, so a new event is a data change, not a code change
- Dark mode (system or manual)

## Tech stack

| Area | Choice |
|---|---|
| Framework | Next.js 16.4 (App Router, Turbopack) + React 19.3 + TypeScript 6 |
| UI | Tailwind CSS 4, shadcn/ui, lucide-react, sonner, next-themes |
| Local data | Dexie 4 (IndexedDB) + `useLiveQuery` |
| Backend | Supabase (Postgres, Auth with anonymous sign-ins, RLS) |
| Service worker | Serwist 9 via `@serwist/turbopack` |
| Charts / tables | Recharts 3, TanStack Table 9 |
| Runtime | Node.js 24 (`.nvmrc`, `engines`) |

## Quick start

### 1. Requirements

Node.js 24. With nvm:

```bash
nvm install   # reads .nvmrc
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API). Both are safe to expose: access is governed by Supabase Auth and row level security.

Without these variables the app runs in **local-only mode**: a single device, no sync, no login.

### 3. Set up Supabase

1. **Authentication → Sign In / Providers**: enable **Anonymous sign-ins**.
2. Run the migrations in order in the SQL editor (or `supabase db push`):
   - `supabase/migrations/001_initial_schema.sql`
   - `002_migrate_to_nye2026.sql`
   - `003_cascade_and_delete_rpc.sql`
   - `004_server_timestamps.sql`
   - `005_auth_and_rls.sql`
   - `006_prom_halloween_event.sql` (renames the seeded event; edit the date if needed)
3. Create your event (the access code is stored hashed):

   ```sql
   INSERT INTO events (name, date, access_code_hash)
   VALUES ('My Event', '2026-12-31', extensions.crypt('your-access-code', extensions.gen_salt('bf')))
   RETURNING id;
   ```

   Share the returned `id` (the Event ID) and the access code with the check-in staff.

> Free-tier Supabase projects pause after a week of inactivity. Restore the project in the dashboard before the event.

### 4. Run

```bash
npm run dev          # http://localhost:3000 (service worker disabled in dev)
npm run build        # production build (Turbopack); bundles the service worker
npm start
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
```

## Usage

1. **Sign in** on each device with the Event ID and access code. The device signs in anonymously to Supabase and becomes a member of the event. Afterwards it can reload and keep working offline.
2. **Import** guests from CSV (Import tab). Required columns: `first_name`, `last_name`. Optional: `group`, `phone`, `notes`, `ticket_code`. Common Italian/English header aliases are recognized (`nome`, `cognome`, `telefono`, …). Re-importing updates existing guests by name.
3. **Check in** from the Guests tab. Tap *Check in* / *Check out*; the row shows the time and the number of entries.
4. **Stats** shows live counters, the arrivals histogram and the latest activity for the data on this device (synced every 30 s).
5. **Settings** shows sync status (pending and stuck changes with *Retry* / *Discard*), theme, *Clear local data* and *Delete all server data* (typed confirmation).

### Next event

No code change is needed. Insert a new `events` row (see step 3 above) and sign the devices in with the new Event ID. To start from a clean slate, use *Delete all server data* for the old event and *Clear local data* on each device.

> If the server still holds guests created by a version of the app older than this one (random guest ids), wipe them before the event: *Delete all server data* once, *Clear local data* on every device, then re-import the CSV. Guest ids are now deterministic per event and name, so devices that import the same list agree on them.

## How sync works

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   UI Layer  │────▶│  Dexie.js   │────▶│   Outbox    │
│   (React)   │     │ (IndexedDB) │     │   Queue     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                          ┌────────────────────┘
                          ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Service   │     │    Sync     │────▶│  Supabase   │
│   Worker    │     │   Engine    │◀────│  (Postgres) │
└─────────────┘     └─────────────┘     └─────────────┘
```

- **Writes** go to Dexie and the outbox in one transaction (`src/lib/db/mutations.ts`).
- **Push** (`src/lib/sync/outbox.ts`): entries are sent in order as upserts keyed by id. A failure schedules a retry with exponential backoff; entries are never dropped. After five failures they are reported as *stuck* in Settings.
- **Pull** (`src/lib/sync/engine.ts`): rows changed since the last server timestamp seen, paginated, 60 s overlap for safety. Timestamps are set by Postgres (migration 004), never by device clocks.
- **Lifecycle**: the engine runs for the whole dashboard (`SyncProvider`): on an interval, when the device comes back online and when the tab returns to the foreground. Concurrent runs share one in-flight sync.
- **Conflicts**: last write wins by server `updated_at`; a local change that is still pending always wins locally until it is pushed.
- The service worker never caches Supabase responses.

## Security model

- Each device has an anonymous Supabase user. `join_event(event_id, code)` verifies the bcrypt-hashed access code and records the membership.
- RLS allows members to read and write only their event's guests and check-ins. The anon key alone cannot read anything; the hash column is not readable at all.
- Anonymous users accumulate; migration 005 includes a housekeeping query to delete old ones.

## Deployment (Vercel)

1. Push to GitHub and import the project in Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. Project Settings → Node.js version **24.x** (the `engines` field enforces it too).
4. Deploy. The service worker is served from `/serwist/sw.js`; nothing is written to `public/`.

## Project structure

```
src/
├── app/
│   ├── (auth)/login/        # Login (join_event RPC, offline fallback, local-only mode)
│   ├── (dashboard)/         # Protected routes + SyncProvider
│   │   ├── guests/ import/ stats/ settings/
│   │   └── loading.tsx
│   ├── serwist/[path]/      # Service worker route handler (Turbopack)
│   ├── ~offline/            # Offline fallback page
│   ├── manifest.ts          # Web app manifest
│   ├── sw.ts                # Service worker source
│   ├── error.tsx  not-found.tsx  layout.tsx
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── layout/  guests/  import/  stats/
│   └── providers/           # theme, sync, service-worker update toast
├── hooks/                   # use-guests, use-stats, use-sync, use-session, …
├── lib/
│   ├── db/                  # Dexie schema (v2) + transactional mutations
│   ├── sync/                # outbox (push) + engine (pull, lock, status)
│   ├── supabase/            # client, anonymous sign-in, error helpers
│   ├── csv/                 # CSV parsing and chunked import
│   ├── session-store.ts     # localStorage session via useSyncExternalStore
│   └── event-config.ts      # app name, version, sync interval
├── schemas/                 # zod schemas
└── types/
scripts/generate-icons.mjs   # regenerates public/icons/*.png
supabase/migrations/         # 001 … 006
```

## Troubleshooting

- **"Server function missing"** on login: migrations 003–005 have not been applied.
- **"Anonymous sign-ins are disabled"**: enable the provider in Supabase Auth settings.
- **"This device is not a member of the event"**: the device's auth session was lost (storage cleared). Sign out and sign in again with the access code.
- **Changes stuck in Settings**: read the error shown, fix the cause (usually connectivity or membership), then *Retry*. *Discard* drops the local change and accepts the server's version.

## License

MIT
