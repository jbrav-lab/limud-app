# Plan: server-side tracking of results with Supabase

**Phase 1 scope and product rules:** [family-view-design.md](family-view-design.md) (roles, deleting a child, parent-made tests with review and release, encrypted names). Where the two documents differ, the design document wins.

**Status: nothing is deployed.** No Supabase project has been created, and no keys or URLs are in the code. Step 1 (data v3) is prototyped on branch `claude/data-v3-prototype-df2387`; step 2 (database schema and security, §9) is built and tested on branch `claude/sync-step2`. Neither is merged. Build it in this order, on a branch, against a *local* Supabase (`supabase start`). Turn on a hosted project only after you decide to.

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
> **Built in step 2 with changes** (see §9 and `supabase/migrations/`): `family_members` has a family-only `member_id` and an HMAC of the sign-in id instead of `user_id`; names and labels are encrypted (`name_enc`, `label_enc`); devices have their own anonymous sign-in. The sketch below is the original plan.

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
- RLS: SQL tests against the local stack (`supabase test db`, pgTAP). **Built in step 2 as vitest tests in PGlite** (§9), because Docker isn't installed yet.
- Sync end-to-end: two browser contexts in Playwright against local Supabase, one offline, then both online, checking that stars add up and tests appear once.

## 9. Step 2: database schema and security (built 2026-11-16)
On branch `claude/sync-step2`, not merged or deployed. No Supabase project exists yet.

### What is in `supabase/migrations/`
| File | Contents |
|---|---|
| `…0100_foundation.sql` | `pgcrypto` in `extensions`; an internal `private` schema; Vault key lookup that fails closed; HMAC-SHA256; name encryption; rounding to the hour; one-time codes |
| `…0200_tables.sql` | All tables (below), with `check` rules on sizes, formats and rounded parent times |
| `…0300_rls.sql` | Scope helpers, integrity triggers (never zero parents, one primary user, grow-only counters, topic-progress merge, server-set test owner and time, the 7-year activity clock), RLS on every table, the policies |
| `…0400_api.sql` | The API: invites, families, children, device pairing, tests |
| `…0500_deletion_retention.sql` | Deletion requests and approvals, parent removal, restore, erase, and `private.run_retention()` |
| `…0600_grants.sql` | Takes back Supabase's default grants; grants only what the policies are for. `anon` gets nothing |

**Tables:** `families`, `family_members`, `app_admins`, `devices`, `children`, `device_children`, `device_pairings`, `child_device_totals`, `daily_activity`, `topic_progress`, `exam_results`, `mistakes`, `tests` (owner scope `family`), `test_answer_keys`, `test_assignments`, `invites`, `deletion_requests`, `audit_log`, `deletion_proofs`, `consent_records`, `ref_schools`, `ref_grades`. Data inventory: [security-privacy.md §3](security-privacy.md#3-data-inventory-record-of-processing).

**Roles:** admin (`app_admins`), primary user and parent (`family_members.role`), and the child device (`devices`, scoped to `device_children`).

**Decisions made while building** (check them):
- **A child's phone signs in anonymously** (Supabase anonymous sign-in, no email) and redeems a one-time code from a parent (`create_device_pairing` → `redeem_device_pairing`). This follows the design document; §2 above said a parent signs in on the phone. Its sign-in id is stored only as an HMAC, like a parent's.
- **Writes that touch names go through functions** (`upsert_child`, `create_family`, `rename_device`…), because only the server holds the name key. Progress rows are written directly (upsert), filtered by RLS.
- **The server merges as it stores:** stars, sessions and daily answers never go down; topic counters take the max, and the level comes from the newer `last_at` (§4).
- **Parent removal** is a `deletion_requests` row of kind `remove_member` with `execute_after` 7 days later. The maintenance job carries it out and cancels other pending deletions in that family. A parent with a pending removal can't receive the primary role.
- **Times:** parent actions are rounded down to the hour, enforced by table `check` rules. "Expires after 7 days" counts from the rounded hour. Israel's offset is a whole number of hours, so rounding never moves a deletion to another Israel date.
- **Maintenance job:** `private.run_retention()` handles parent removals, expired requests, invites and codes, erasing soft deletes and families after 7 years, audit and proof clean-up, and trims mistakes to 200. It runs **once a day** (owner's decision 2026-11-16: hourly costs too much for an app this size).
- **The day rule for erasing:** a deletion must be erased within 48 hours of the end of the day it was confirmed, Israel time. Confirmed on day D (Israel date), it stays restorable until the run on D+2, which erases it (`private.erase_due`: Israel date of the soft delete ≤ today − 2); the deadline is 00:00 on D+3 (`private.erasure_deadline`). The rule compares dates, not elapsed hours, so any run on D+2 meets the deadline; a restore after the deadline is refused even if a run was missed, and the next run reports it as `erased_late`. Restore window: at least about 46½ hours (confirmed at 23:59, run at 22:30 in winter), up to about 72 hours.
- **Schedule:** `pg_cron` runs in UTC. Run it at **20:30 UTC**, which is 22:30 in Israel in winter and 23:30 in summer, so the run on D+2 always comes before 00:00 on D+3 (any minute from 20:00 to 20:59 UTC works; a test checks every day from 2026 to 2030). Not 21:00 UTC or later: in summer that is already midnight. Not scheduled yet: see the checklist below.
- **Parent-made tests:** the tables and the release flow are in place. The device reads questions only, never the key, and sees the score and note only after release. **Server scoring and answer overrides come in a later step.**
- **One HMAC per parent, not per family:** a parent in two families has the same fingerprint in both, so a dump shows that two families share a parent (not who).

**Owner setup before first use** (in the SQL editor, once):
```sql
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limud_hmac_key');
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'limud_name_key');
select private.add_admin('<the owner''s auth.users id>');
select cron.schedule('limud-maintenance', '30 20 * * *', 'select private.run_retention()');  -- daily 20:30 UTC; needs pg_cron
```

### How it is tested (no Docker: PGlite)
Docker isn't installed, so the migrations run in **PGlite** (`@electric-sql/pglite` 0.5.16: Postgres 18.6 in WebAssembly, with `pgcrypto`) from vitest, as part of `npm test`. CI will run them on every deploy once the branch is merged. A run takes about 2 seconds.
- `src/server-tests/shims/supabase-shim.sql`: **test-only stand-ins** (never run on a real project), loaded before the migrations, which run unchanged:
  - the roles `anon`, `authenticated` and `service_role`, and Supabase's default grants on `public` (so the tests prove the migrations take them back);
  - an `auth` schema: `auth.users` (id, email, `is_anonymous`, `last_sign_in_at`) and `auth.uid()`, `auth.jwt()`, `auth.role()` with Supabase's own bodies, reading `request.jwt.claims`;
  - a `vault` schema: `vault.secrets` in **plain text**, the `vault.decrypted_secrets` view, and `vault.create_secret()`.
- `src/server-tests/db.ts` boots PGlite, loads the shim and then the migrations (in file-name order, like the CLI), creates the keys, and runs each query as a caller (it sets the JWT claims and `set role authenticated`).
- `access.test.ts` covers schema guarantees, `anon`, cross-family isolation for every table and role, and the §7 matrix. `deletion.test.ts` covers the deletion rules and retention, and `leak.test.ts` is the leak test. A refusal must come with a refusal error code, so a broken test query fails instead of passing. Each suite was checked by breaking the code on purpose (a wide-open policy; an `auth.uid()` written to the audit log), and the tests failed.

### Re-check on real Supabase (local stack first, then the hosted project)
1. **Run the same migrations with the CLI** (`supabase db reset`), and port the three test files to pgTAP (`supabase test db`), or point the vitest harness at the local stack's Postgres.
2. **Vault:** the real `vault.decrypted_secrets` decrypts with a master key held outside the database. Check that `private.vault_key()` (security definer, owned by `postgres`) can read it, that `authenticated` can't, and that a `pg_dump` holds the secrets only encrypted.
3. **Default privileges and ownership:** on Supabase, migrations run as `postgres`, and some default grants come from `supabase_admin`. Check with `has_table_privilege` and `has_function_privilege` that `anon` has nothing and `authenticated` has only what `…0600_grants.sql` grants.
4. **`auth.jwt()` claims:** check that real JWTs carry `email` and `is_anonymous`, and that the email is the confirmed address (or read it from `auth.users` instead).
5. **Anonymous sign-in** must be on for child devices, with its abuse protection (CAPTCHA or rate limits), while public email sign-ups stay off.
6. **Exposed schemas:** only `public` in the API settings; `private`, `vault` and `auth` not exposed. Run the security advisor.
7. **`pg_cron`:** enable it, schedule `private.run_retention()` once a day at 20:30 UTC (`30 20 * * *`), check that it runs as `postgres` and that the database has the `Asia/Jerusalem` time zone, and alert when the job fails or reports `erased_late` above 0.
8. **Leak test on a real dump:** `supabase db dump --data-only` without Vault access, then the same checks as `leak.test.ts`.
9. **Performance:** the RLS helpers are `stable` functions called once per query; check the query plans with real row counts.
10. **Request logs** (API, auth and email logs) are outside the database and keep IP addresses. The leak test doesn't cover them (design document, "Not covered").

### Left for later steps
- Scoring tests on the server, and sending the answer key on release.
- Answer overrides.
- Per-parent PINs (security file §8).
- Verified deletion requests from outside the app (security file §10 B–D).
- "Delete my account", and leaving a family.
- The sync client (steps 3–4).
