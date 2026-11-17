# Going live with sync: the plan

Approved by the owner on 2026-11-16: go live on the owner's **existing hosted Supabase project**, with no Docker and no staging project. This plan replaces "local stack first" in [sync-supabase-plan.md](sync-supabase-plan.md) §7 and §9. The security record stays [security-privacy.md](security-privacy.md).

Each stage has a **gate** (what must be true before the next stage) and a **way back**.

## Ground rules
- **Test on `localhost`, against the live database, with a fake test family.** Test families have throwaway emails (`…@example.invalid`) and made-up names starting with `TEST-`. The children's phones see nothing until a stage says **ship**.
- **Migrations are frozen once pushed.** After the first `supabase db push`, no migration file is edited; every change is a new file.
- **A `pg_dump` before every database change once real data exists.** The free tier has no backups.
- **Kill switch:** sync is on only when the build has the project URL. Remove it and redeploy, and the phones are local-only again (their data stays on the phone).
- **Secrets stay out of chat.** The owner types the database password into the CLI and runs the key snippet in the SQL editor themself. Claude never sees the password, the keys or the connection string.

## Stage 0: decisions (owner, 2026-11-16)
- **Google sign-in only, for now.** No email provider and no magic links: the built-in mailer is limited, and another provider would be one more processor.
  - Found while building: Supabase needs **"Allow new users to sign up" on** for Google's first sign-in and for anonymous child devices. So "public sign-ups off" can't be a dashboard switch. Invite-only is enforced instead by a **"before user created" auth hook** (`public.auth_before_user_created`): a Google account is created only if its email has a pending invite.
- **No CAPTCHA,** because it would be a third-party script. Rate limits only; an anonymous device can do nothing without a parent's one-time code.
- **Free-tier pausing:** a daily keep-alive request from GitHub Actions (`.github/workflows/keep-alive.yml`). It also fails, and GitHub emails the owner, if the nightly job didn't run in the last 26 hours or an erasure was late (`erased_late`).
- **Only the admin can invite a primary user.** A primary user cannot.
- **A parent in two families has the same fingerprint in both:** accepted, recorded as a known risk (security file §11).
- **Pre-flight** (checked in [the Stage 1 runbook](go-live-runbook-stage1.md), step 1):
  - the project's `public` schema is empty;
  - the region is noted (EU, Frankfurt, is preferred);
  - the provider's data-processing agreement (DPA) is requested;
  - `pg_dump` is available (below).

All but the last are in the migration `…0700_go_live_decisions.sql` and tested in `src/server-tests/decisions.test.ts`.

## Stage 0b: the beta (owner, 2026-11-17)
- **Users: three families,** all in the owner's own family, each a willing beta tester. The core need is **parent oversight through tests**: without it the app is not useful enough for a parent to follow what the children learn.
- **In the beta:** Stage 2 in full; Stage 3 (Google sign-in, admin invites of each family's primary parent, device pairing, a short Hebrew note on what is stored and where, with consent); Stage 4 for **test results and mistakes only**; Stages 5–6 for **tests** (a parent creates a test, the child takes it, the server scores it, the parent sees results and mistakes, the answer key is released) and the **per-parent PIN** (a child on a shared phone must not reach answer keys).
- **Deferred until after the beta:**
  - syncing profiles, counters and topic progress (each phone keeps its own);
  - in-app notifications, answer overrides;
  - "delete my account", leaving a family, and externally verified deletion requests: during the beta a family asks the owner, who deletes it with the existing database functions;
  - the full privacy notice; moving off GitHub Pages (accepted for the beta, security file §11).
- **A classroom beta is considered, not decided:** up to **6 classes** (classes, not grades), at most about 170 children and their parents, as one beta before the stricter measures. Its preconditions are in the security file §12.12.

## Stage 1: database live
Exact commands and clicks: **[go-live-runbook-stage1.md](go-live-runbook-stage1.md)**.
- `supabase link`, then `supabase db push`.
- The owner runs the setup snippet: the two Vault keys, and the daily job at 20:30 UTC.
  - **Changed while building:** the admin id moves to Stage 3. The admin row needs the owner's sign-in id, which only exists after the owner's first Google sign-in, and there is no app sign-in until Stage 3.
- Dashboard settings:
  - anonymous sign-in on;
  - sign-ups allowed, but the auth hook on (see Stage 0) and the email provider off;
  - only `public` exposed in the API;
  - redirect URLs for the Pages site and `localhost`.
- Run the §9 re-check list against the live database with test families: `node scripts/live-check.mjs`. Everything it creates is rolled back.
- Delete the test families through the real deletion flow (`node scripts/live-test-family.mjs create`, then `delete`), and confirm two nights later that they were erased (`status`).
- **Gate:** every §9 item passes and is recorded in `docs/security-privacy.md`. Two items need a real sign-in (the JWT claims, and the hook refusing an uninvited Google account); they move to the Stage 3 gate.
- **Way back:** drop what the migrations created (the runbook has the statement) and clear the CLI's migration history.

## Stage 2: ship data v3 to the phones, sync off
- First fix the step 1 leftovers (**done 2026-11-17** on `claude/sync-step2`):
  - restore merges instead of replacing (a version-3 file; an older file still replaces, because its child ids are new);
  - tombstones: `deleted` (child id → time) and `resetAt` on a child; a merge drops deleted children and keeps only what happened after the newest reset;
  - the device keeps the newest 60 mistakes and 50 tests, in merges too (the server keeps 200 mistakes).
- Merge to `main` (this ships).
- **Gate:** the owner's phone upgrades cleanly, and backup export and restore work.
- **Way back:** the `limud-app-backup-before-v3` copy on each phone.

## Stage 3: sign-in, family and device pairing
- Built behind the flag: off when the build has no project URL.
- Adds:
  - the Supabase client library;
  - the project URL in the CSP `connect-src` and in the `check-dist` allow-list;
  - the privacy note, with consent at sign-up.
- Google sign-in set up (Google Cloud OAuth client, then the Google provider in Supabase). Then the owner's first invite and admin row (`private.owner_invite_primary`, first sign-in, `private.add_admin`).
- Re-check with a real sign-in:
  - the JWT carries `email` and `is_anonymous`;
  - an uninvited Google account is refused by the hook.

## Stage 4: the sync itself
- Order: exam results and mistakes, then profiles, then counters and topic progress.
- Tombstones for deletes.
- Tests: two devices, offline edits, conflicts.

## Stage 5: parent view and in-app notifications

## Stage 6: parent-made tests, PIN and deletion requests
- Server scoring, answer key on release, answer overrides.
- Per-parent PIN.
- "Delete my account", leaving a family, and externally verified deletion requests (security file §10). Without an email provider, the requester proves the address by signing in with Google; the auth hook will need to let such a requester in.

## Stage 7: go live
- The owner fills in the incident runbook's notification rules first (security file §15).
- The owner's family first, for one week, with each phone backed up before pairing.
- A leak test on a real dump with real data present (`pg_dump --data-only`, then the checks of `leak.test.ts`).
- Then the other two beta families (Stage 0b).

**Gate for each of Stages 3–6:**
- the tests pass;
- the test family is deleted;
- the security file is updated;
- the stage is merged with the flag off.

## Hosting move (owner, 2026-11-17)
The site moves from GitHub Pages (`jbrav-lab.github.io`, an origin shared with the owner's other Pages site) to Cloudflare, before Stage 3 (security file §17.3 P0-1).
- Cloudflare builds `main` with the same gates as CI (audit, tests, build, `check:dist`); preview deployments are off. No Cloudflare key is stored in GitHub or on the PC.
- `dist/_headers` sends the security headers (built; checked by `check:dist`). `Cross-Origin-Opener-Policy` is added after the move, because it would cut the handoff below.
- **Moving the phones:** the last GitHub Pages release shows a "we've moved" button that opens the new address and hands the progress over directly (postMessage to the exact new origin only; the new site merges it like a backup restore). A backup file works too. Then GitHub Pages serves only a link to the new address.
- After the move: Supabase Site URL and redirect URLs point to the new address; the GitHub Pages address is removed from them.

## Tooling (no Docker)
- **Supabase CLI** `supabase@3.2.0` (owner's choice, 2026-11-17), a dev dependency (`npx supabase …`; on this PC `npx.cmd`, because PowerShell blocks `npx.ps1`). In CLI 3, database commands target the local stack by default: always pass `--remote` (`db push --remote`, `db query --remote --read-only`). `link` no longer asks for the database password.
  - **Work without Docker** (they connect straight to the hosted database): `login`, `link`, `db push` (and `--dry-run`), `migration list`, `db lint`, `inspect db …`. Checked 2026-11-16: each went as far as connecting.
  - **Need Docker, not used:** `start`, `db reset`, `db dump` (the CLI runs `pg_dump` in a container; it failed with "docker: command not found"), `db diff`, `db pull`, `test db`.
  - Never run `supabase config push`: it would overwrite the dashboard's auth settings with `supabase/config.toml`, which describes a local stack.
- **`pg_dump`, the same major version as the project** (the live check prints it). The lightest route on Windows is the EDB installer with only the command-line tools (no server). For Postgres 17:
  ```powershell
  winget install --exact --id PostgreSQL.PostgreSQL.17 --override "--mode unattended --unattendedmodeui none --disable-components server,pgAdmin,stackbuilder"
  ```
  Then add `C:\Program Files\PostgreSQL\17\bin` to PATH, and check with `pg_dump --version`. Not installed yet; the `--override` flags are the EDB installer's and are untested here. If the installer insists on a server, the zip of binaries from EDB ("PostgreSQL binaries", unzip, use `bin\pg_dump.exe`) is the fallback.
- **`scripts/live-check.mjs`:** the §9 list against the live database. It checks:
  - every migration applied;
  - RLS on every table;
  - privileges with `has_table_privilege` and `has_function_privilege`, compared one by one with the migrations applied in PGlite;
  - `search_path` on every security definer function;
  - Vault readable by the functions but not by `authenticated` or `anon`;
  - the cron job, the `Asia/Jerusalem` time zone and the auth hook's grants;
  - exposed schemas, over the API;
  - cross-family isolation, the invite flow and a leak scan, with two test families.

  It runs in one transaction that is always rolled back. It refuses to run if any non-test family exists, unless `--allow-real-data`. The connection string comes only from `LIVE_DB_URL` in the shell, and the server certificate is verified (`LIVE_DB_CA`). Its own tests: `src/server-tests/live-check.test.ts`.
- **`scripts/live-test-family.mjs`:** `create`, `delete`, `status`, for the real deletion run.
- **Keep-alive workflow** `.github/workflows/keep-alive.yml`: daily at 06:17 UTC. It uses no third-party actions and has `permissions: {}`, and it runs only once it is on `main`. It needs two settings, under Settings → Secrets and variables → Actions:
  - the **variable** `SUPABASE_URL` (`https://<project-ref>.supabase.co`);
  - the **secret** `SUPABASE_ANON_KEY` (the public anon key).

  Without them it skips quietly. GitHub turns scheduled workflows off after 60 days without a commit, so watch for that email.
- **CI:** `npm ci` now also downloads the Supabase CLI binary (the package's install script). If that ever breaks a deploy, move the CLI out of `devDependencies` and use `npx supabase@3.2.0` instead.
