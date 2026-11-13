# Plan: server-side tracking of results with Supabase

**Status: plan only. Nothing is deployed.** No Supabase project has been created, and no keys or URLs are in the code. Build it in this order, on a branch, against a *local* Supabase (`supabase start`). Turn on a hosted project only after you decide to.

Goal: covers roadmap items 1 (move scores between devices and versions), 2 (parent tracking from the parent's own phone) and 6 (parent notified when a test is done). The app must keep working **offline and without an account**, exactly as today.

## 1. Principles
1. **Offline first.** `localStorage` stays the source the UI reads from. Sync runs in the background: it pushes local changes when online and pulls changes from other devices. Turning sync off (or the server being down) changes nothing for the child.
2. **Opt-in, by the parent.** Sync starts only after a parent signs in inside the PIN-protected parent area. Children never sign in and never see a login screen.
3. **Minimal personal data.** Store a first name (or nickname), avatar, grade and theme. No child email, birthday, photo or location.
4. **Merge, don't overwrite.** Two phones may record progress for the same child offline. Their data must combine correctly, never "last phone wins" for things that only grow (stars, answers, tests).
5. **Public repo safe.** The Supabase *anon* key is designed to be public, but keep both URL and key in GitHub Actions secrets → Vite env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). Security comes from Row Level Security (RLS), not from hiding the key. The `service_role` key is never in the client or the repo.

## 2. Accounts and families
- **Supabase Auth**, sign-in by email magic link (and optionally Google). No passwords to manage.
- One **family** per household. The first parent who signs in creates it. A second parent joins by an invite code shown in the parent area.
- A **device** (a child's phone) is linked to the family when a parent signs in on it once in the parent area. The session refresh token stays on the device, so sync keeps working; the PIN still guards the parent area. "Unlink this device" signs out.
- The parent's own phone signs in the same way and opens the parent area remotely: it lists the family's children from the server.

## 3. Data model (Postgres)
All rows carry `family_id`. Ids are UUIDs generated **on the client**, so a record created offline keeps its id when it reaches the server (no duplicates on retry).

```sql
create table families (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

create table family_members (            -- parents
  family_id uuid references families on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text not null default 'parent',
  primary key (family_id, user_id)
);

create table devices (
  id uuid primary key,                   -- generated once per phone, stored locally
  family_id uuid not null references families on delete cascade,
  label text,                            -- "הטלפון של נועה"
  last_seen_at timestamptz
);

create table children (                  -- today's Profile
  id uuid primary key,                   -- existing profile ids are migrated to UUIDs (see §5)
  family_id uuid not null references families on delete cascade,
  name text not null, avatar text not null, grade int not null, theme text,
  updated_at timestamptz not null,       -- last-writer-wins for these fields
  deleted_at timestamptz                 -- tombstone, so a deletion reaches every device
);

-- Things that only grow: one row per child per device, summed when read (a "grow-only counter").
create table child_device_totals (
  child_id uuid references children on delete cascade,
  device_id uuid references devices on delete cascade,
  family_id uuid not null,
  stars int not null default 0,
  sessions int not null default 0,
  updated_at timestamptz not null,
  primary key (child_id, device_id)
);

create table daily_activity (            -- questions answered per day; the streak is computed from the union of days
  child_id uuid references children on delete cascade,
  device_id uuid references devices on delete cascade,
  family_id uuid not null,
  day date not null,
  answered int not null,
  primary key (child_id, device_id, day)
);

create table topic_progress (            -- per topic (namespaced id, e.g. "g5.math.fraction-meaning")
  child_id uuid references children on delete cascade,
  topic_id text not null,
  family_id uuid not null,
  level int not null, run_correct int not null, run_wrong int not null,
  attempts int not null, first_try int not null, second_try int not null,
  by_level int[] not null,               -- [l1, l2, l3]
  last_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (child_id, topic_id)
);

create table exam_results (              -- today's ExamRecord; immutable once written
  id uuid primary key,
  child_id uuid references children on delete cascade,
  family_id uuid not null,
  pack_id text not null, topic_ids text[] not null,
  difficulty text not null, questions int not null, correct int not null, score int not null,
  taken_at timestamptz not null,
  seen_by_parent_at timestamptz          -- for the "new result" highlight (roadmap item 6)
);

create table mistakes (                  -- immutable; keep the newest 200 per child (trimmed by a scheduled job)
  id uuid primary key,
  child_id uuid references children on delete cascade,
  family_id uuid not null,
  topic_id text not null, prompt text not null, expression text,
  given text not null, correct text not null,
  at timestamptz not null
);
```

**Row Level Security** on every table:
```sql
alter table children enable row level security;
create policy "family members only" on children
  using (family_id in (select family_id from family_members where user_id = auth.uid()))
  with check (family_id in (select family_id from family_members where user_id = auth.uid()));
-- same policy on every table with family_id; families/family_members get their own narrower policies,
-- and joining a family goes through a security-definer function that checks the invite code.
```

## 4. Merge rules
| Data | Rule |
|---|---|
| Profile fields (name, avatar, grade, theme) | Last writer wins by `updated_at`. A child changing their avatar on the phone and a parent renaming them elsewhere both survive (field-level `updated_at` if needed). |
| Stars, sessions | Per-device counter rows; the child's total is the **sum** across devices. A device only ever writes its own row. |
| Daily answers / streak | Per-device per-day rows; the streak is computed from the **union** of active days. |
| Topic progress | Counters (`attempts`, `first_try`, `by_level`…) take the **max** per field; `level`, `run_*` come from the row with the newest `last_at`. Children rarely practise the same topic on two phones at once, so this is close enough and never loses mastery. |
| Exam results, mistakes | **Union by id.** Never edited, never conflict. |
| Deletes (child, reset progress) | Tombstones (`deleted_at`, or a `reset_at` on the child that hides older rows), so they reach every device. |

The merge functions are pure TypeScript (`src/engine/merge.ts`) and get unit tests like `store.test.ts`.

## 5. Changes in the app
1. **Data version 3** (`migrate()` in `src/engine/store.ts`, with a test in `store.test.ts`, keeping the storage key `limud-app-v1` and a pre-v3 backup copy):
   - profile ids → UUIDs (keep a map old→new for routes and the session `pid`);
   - `id` (UUID) on every `ExamRecord` and `Mistake`;
   - `updatedAt` on profiles and topic progress;
   - a local `deviceId`, and stars/sessions/daily kept per device (`byDevice`) so they can be summed;
   - a `sync` block: `{ familyId?, lastPulledAt?, outbox: [] }`.
2. **`src/engine/sync.ts`**: an outbox of pending upserts written next to every `actions.*` change; `push()` sends the outbox in batches (upsert by primary key); `pull()` fetches rows with `updated_at > lastPulledAt` and merges them into the store. Runs on app start, on `online`, on `visibilitychange` and every few minutes while open. It retries quietly; errors never reach the child.
3. **`@supabase/supabase-js`** is loaded lazily (dynamic `import()`), only when sync is turned on, so the app's first load stays small and offline install is unaffected.
4. **Parent area → "סנכרון וגיבוי בענן"**: sign in, create or join a family, link or unlink this device, see the last sync time. The manual backup and restore stays.
5. **Parent on their own phone:** after sign-in the parent screen reads children from the server (same components as today, fed from the synced store).
6. **Notifications (roadmap item 6):** the parent's app subscribes to Supabase Realtime inserts on `exam_results` for the family and shows a badge for rows with `seen_by_parent_at is null`. Phone push (Web Push through an Edge Function) is optional and comes later.

## 6. Hosting decisions to make before going live
- **Region:** an EU region (Frankfurt) is closest to Israel.
- **Plan:** the free plan pauses a project after about a week with no activity and has no backups. For family data, prefer the Pro plan (backups), or keep free plus a weekly export. Decide before real data goes in.
- **Privacy:** children's data → write a short privacy note in the parent area: what is stored, where, and how to delete it ("מחיקת כל הנתונים מהענן" button that deletes the family, cascading).
- **Site address:** unchanged (GitHub Pages). Sync is what finally lets a child move devices or addresses without losing progress.

## 7. Build order (each step shippable on its own)
1. Data v3 migration + per-device counters + merge functions, with tests. No server yet. (Also makes backup/restore merge instead of overwrite.)
2. Local Supabase (`supabase init`, `supabase start`), migrations in `supabase/migrations/`, RLS policies, and RLS tests (two families must not see each other's rows).
3. Auth + family + device linking in the parent area, behind a build flag that is off when the env vars are missing.
4. Push/pull for exam results and mistakes (immutable, easiest), then profiles, then counters and topic progress.
5. Parent view on the parent's own device.
6. Realtime "new test result" notifications.
7. Only then: create the hosted project, add the two secrets to GitHub Actions, and turn the flag on.

## 8. Testing
- Pure merge functions: vitest (two devices' data in, merged data out; idempotent; order-independent).
- Migration v2 → v3: `store.test.ts`.
- RLS: SQL tests against the local stack (`supabase test db`, pgTAP).
- Sync end-to-end: two browser contexts in Playwright against local Supabase, one offline, then both online, checking that stars add up and tests appear once.
