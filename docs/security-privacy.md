# Security and privacy file

A living record of how the app protects children's data: what is in place today, what is designed for the Family View (server sync), and the evidence for each claim.
Benchmarks: **OWASP Top 10:2025**, the **OWASP API Security Top 10** (the sync server is an API), and **privacy by design and by default**.

| | |
|---|---|
| Owner | Project owner (controller) |
| Last reviewed | 2026-11-16 |
| Review | Before each phase goes live, after any security-relevant change, and at least once a year |
| Status legend | ✅ **in place** (with evidence) · 🧪 **built, tested**: in the database migrations (`supabase/migrations/`) with automated tests, on branch `claude/sync-step2`, **not live** · 🟡 **designed** (Family View, not built) · ⬜ **open decision** |

Related documents: [family-view-design.md](family-view-design.md) (phase 1 product rules), [sync-supabase-plan.md](sync-supabase-plan.md) (technical plan).

---

## 1. Evidence index
Every ✅ claim in this file maps to something that can be run or read.

| Control | Evidence | Runs automatically |
|---|---|---|
| No third-party requests, no trackers, no analytics | `scripts/check-dist.mjs` (scans every built file for outside addresses) | CI, every deploy |
| Strict Content-Security-Policy and referrer policy | `vite.config.ts` (`CSP`), checked by `scripts/check-dist.mjs` | CI, every deploy |
| No inline scripts, source maps, private files or outside URLs in the offline cache | `scripts/check-dist.mjs` | CI, every deploy |
| No known high or critical vulnerabilities in dependencies, except owner-accepted advisories with a reason and an expiry date | [`scripts/audit.mjs`](../scripts/audit.mjs) in `.github/workflows/deploy.yml` and the Cloudflare build (`npm run verify`) | Every deploy; an exception blocks again after it expires |
| Software bill of materials | `npm sbom` → `sbom` artifact on each run (kept 90 days) | CI, every deploy |
| Pinned, least-privilege build pipeline | `.github/workflows/deploy.yml` (actions pinned to commit SHAs, `permissions: {}` by default, per-job grants, no stored git credentials) | Read the file |
| Dependency and action updates | `.github/dependabot.yml`; Dependabot alerts and security updates on | Weekly, and on new advisories |
| Repository protections | Branch protection on `main`, secret scanning with push protection, private vulnerability reporting (§14) | Enforced by GitHub |
| Backup files carry no PIN; restore accepts only a known, size-limited shape; a version-3 file is merged in (nothing added since is lost; deleted children and resets in the file are respected) | `src/engine/backup.ts`, `restoreInto()` in `src/engine/store.ts`; tests in `src/engine/backup.test.ts`, `src/engine/restore.test.ts`, `src/engine/merge.test.ts` ("tombstones") | CI, every deploy |
| Data migrations keep all progress | `src/engine/store.test.ts` | CI, every deploy |
| Every question generator produces valid, non-negative, self-checking answers | `src/curricula/curricula.test.ts` (400 runs per generator and level in CI; `GEN_RUNS=20000 npx vitest run -t "topic generators"` as a soak test) | CI (400 runs) |
| No raw HTML rendering (no `dangerouslySetInnerHTML`, `innerHTML` or `eval`) | Code search; the text renderer `src/components/MathText.tsx` builds React elements only | Manual check (§13) |

**Sync server (step 2, 🧪 built, tested on branch `claude/sync-step2`, not live).** The migrations run in PGlite inside `npm test`, on a small shim for the Supabase-only pieces ([sync-supabase-plan.md §9](sync-supabase-plan.md#9-step-2-database-schema-and-security-built-2026-11-16) lists what must be re-checked on real Supabase). CI runs them once the branch is merged into `main`; until then, `npm test` runs them locally.

| Control | Evidence | Runs automatically |
|---|---|---|
| Row Level Security on every table, deny by default; a test fails if any table lacks RLS or a cross-family test | `supabase/migrations/20261116000300_rls.sql`; [`src/server-tests/access.test.ts`](../src/server-tests/access.test.ts) ("schema guarantees") | `npm test` (CI after merge) |
| Not signed in (`anon`): no privilege on any table, and no function except `keep_alive()` (a yes/no); sign-in fingerprints never selectable | `20261116000600_grants.sql`; `access.test.ts` ("schema guarantees", "not signed in") | `npm test` |
| Every `security definer` function sets `search_path` (and validates its inputs) | All migrations; `access.test.ts` ("every security definer function sets search_path") | `npm test` |
| Family A can never read or change family B's rows (every table, every role) | `access.test.ts` ("family A can never read family B", with a before/after snapshot of B) | `npm test` |
| The access-control matrix (§7), each cell | `access.test.ts` ("access-control matrix (§7)"), and `deletion.test.ts` for the delete rows | `npm test` |
| Deletion rules: every parent approves; 7-day expiry; 7-day parent removal that blocks deletion; soft delete restorable until the daily run on D+2 (Israel date), which erases it, before the 00:00 D+3 deadline; never zero parents; one primary user | `20261116000500_deletion_retention.sql`; [`src/server-tests/deletion.test.ts`](../src/server-tests/deletion.test.ts) ("the day rule for erasing": 00:01 and 23:59 requests, every hour of D+1 and D+2, both daylight-saving changes, the 20:30 UTC schedule for 2026–2030) | `npm test` |
| Retention: erase 7 years after last activity; audit entries and proofs kept 7 years; consent anonymized; newest 200 mistakes | `private.run_retention()`; `deletion.test.ts` ("retention", "deleting the family") | `npm test`; on the live project the daily job is scheduled (live check, 2026-11-17) |
| Leak test: a dump without the Vault keys holds no sign-in id, email, unkeyed hash, plain-text name or IP; accepted invites leave no trace; no query joins an email to a child | [`src/server-tests/leak.test.ts`](../src/server-tests/leak.test.ts) | `npm test` |
| Parent action times rounded to the hour | Table `check` rules in `20261116000200_tables.sql`; `leak.test.ts`, `deletion.test.ts` | `npm test` |
| Go-live decisions: admin-only primary invites; Google-only invite-only sign-in (auth hook); the daily job log and the keep-alive answer (`anon` runs only `keep_alive()`) | `20261116000700_go_live_decisions.sql`; [`src/server-tests/decisions.test.ts`](../src/server-tests/decisions.test.ts); `.github/workflows/keep-alive.yml` | `npm test`; the workflow runs once on `main` |
| Upgrades never lose progress: stored data from every released version (and data that older app code wrote into newer data) keeps every child's totals through the upgrade, a backup and a restore; a new data version needs its own fixture | `src/engine/fixtures/`, [`src/engine/upgrade.test.ts`](../src/engine/upgrade.test.ts) | `npm test` |
| An older copy of the app never overwrites newer data (it shows a reload request); a second tab takes the other tab's saves first | `DATA_VERSION`, `isNewerData()` and the storage listener in `src/engine/store.ts`; `src/screens/NewerData.tsx`; `store.test.ts` ("never writes over data saved by a newer version", "another tab") | `npm test` |
| The live database matches the migrations: privileges (`has_table_privilege`, `has_function_privilege` against the migrations in PGlite), RLS, Vault, cron, time zone, exposed schemas, cross-family isolation and a leak scan with test families (rolled back) | [`scripts/live-check.mjs`](../scripts/live-check.mjs); its own tests in [`src/server-tests/live-check.test.ts`](../src/server-tests/live-check.test.ts) | By hand, per [runbook](go-live-runbook-stage1.md). **Run 2026-11-17 on the live project: 18 passed, 0 failed**, rolled back (details in §13) |
| Supabase security advisor on the live project: no errors | `supabase db advisors --remote --type security` (CLI 3.2.0) | **2026-11-17: 0 errors**; the warnings are by design (§13); re-run after every migration |
| The real deletion flow on the live project: two test families, deleted through the API by both parents, erased by the nightly run | [`scripts/live-test-family.mjs`](../scripts/live-test-family.mjs) (`create`, `delete`, `status`) | Created and soft-deleted 2026-11-17 (day D); 🟡 `status` on 2026-11-20 (D+3) must show 0 test families and 0 late erasures |

---

## 2. System overview

### Today (live)
- A static web app (PWA) served by **GitHub Pages** from a public repository. It has **no server, no accounts and no data collection**.
- All data stays in the browser storage of the device (`localStorage`, key `limud-app-v1`): profiles, progress, mistakes and test results.
- Data leaves the device only when a parent exports a backup file themself.
- **GitHub** (as host) receives standard web-request data (IP address, user agent) for page loads. The project owner does not receive or keep it. The privacy notice should say so.

### Family View (designed, not built)
Supabase (Postgres, sign-in, Row Level Security, Vault) as the sync server, in Supabase's Sydney region (ap-southeast-2; §12.10). Phones stay the main copy and sync when online. Details: [family-view-design.md](family-view-design.md).

---

## 3. Data inventory (record of processing)

| Data | Today: where | Family View: where | Purpose | Who can see it | Kept for |
|---|---|---|---|---|---|
| Child nickname | Device | Server, **encrypted** (Vault; 🧪 `children.name_enc`) | Show whose progress it is | That family's parents and linked devices | **7 years** after the family's last activity, or within **48 hours of the end of the day** (Israel time) a deletion request was confirmed, whichever comes first |
| Avatar (emoji), grade, color theme | Device | Server | Display; choosing the grade's content | Same | Same |
| Practice progress, stars, streak, daily counts | Device | Server | Learning, adaptive difficulty, parent oversight | Same | Same |
| Per-device counters (data v3: stars, sessions and answers per day, kept per `deviceId` under each child's `byDevice`; a streak carried over from v2 as `streakSeed`). Totals and the streak are computed from them, not stored | Device; in backup files | Server | Summing counts from several phones without counting twice | Same | Same |
| Record ids and change times (data v3: UUID profile ids, an `id` on every test result and mistake, `updatedAt` on profiles and topic progress) | Device; in backup files | Server | Merging data from several devices | Same | Same |
| Deletion markers (data v3: `deleted`, the ids of deleted children with the time; `resetAt` on a child whose progress was reset) | Device; in backup files | Server (`deleted_at` / `reset_at`) | A deletion or reset reaches every device and a merge or restore never brings the data back | Same | `deleted`: as long as the device keeps the app's data; a random id and a time, nothing about the child |
| Device id (`deviceId`, a random UUID made once per browser) | Device only (not in backup files) | Server, as the key of that device's counter rows | Telling one phone's counters from another's | Same | Same as the family's data. Random; says nothing about the phone or the child |
| Class enrollment (`enrollment`: school, grade, class, year) | Device, **always empty** (reserved, no screen) | — | A possible future class rollout, only with school approval | — | — |
| Sync state (`sync`: last pull time and a change outbox) | Device only, **unused** (empty until sync is built; not in backup files) | — | Offline-first sync later | — | — |
| Mistakes (question, child's answer, correct answer) | Device (newest 60) | Server (newest 200) | Practice and parent review | Same | Rolling: 60 on the device, 200 on the server |
| Test results and answers | Device | Server | Parent review and release | Same | Same |
| Parent-made tests: frozen questions, answer key (kept apart), each child's answers, score, a parent's short note, who released it (member id) | — | Server (🧪 `tests`, `test_answer_keys`, `test_assignments`) | Tests set by a parent | That family's parents; the child's device sees questions, and the score and note only after release, never the key | Same as the family's data |
| Device link: an HMAC of the phone's anonymous sign-in id, an encrypted label, which children it may practise as | — | Server (🧪 `devices`, `device_children`) | Letting a child's phone sync only its own children | That family's parents; the device itself | Same as the family's data; a revoked device keeps its rows but loses access |
| Device pairing code | — | Server, HMAC only (🧪 `device_pairings`) | Joining a child's phone with a one-time code | Nobody (server functions only) | 15 minutes, or until used |
| Invite: an HMAC of the lower-cased email | — | Server, HMAC only (🧪 `invites`) | Inviting a parent or a primary user | The family's parents see that an invite is pending, not the address | Deleted when accepted, or 7 days after it was sent |
| Deletion and parent-removal requests: kind, target, approving member ids, rounded times | — | Server (🧪 `deletion_requests`) | Every-parent approval, the 7-day removal wait | That family's parents | Until carried out, cancelled or expired (7 days) |
| Proof of deletion: date, request type, channel, outcome | — | Server (🧪 `deletion_proofs`); no ids of any kind | Accountability (§10 F) | Owner | 7 years |
| Admin list: an HMAC of the admin's sign-in id | — | Server (🧪 `app_admins`) | Admin rights (reference lists, invites) | Nobody (server functions only) | Until changed |
| Reference lists (schools, grades) | — | Server (🧪 `ref_schools`, `ref_grades`), **empty** in phase 1 | A future class rollout | Signed-in parents read; the admin manages | Until the admin removes them |
| Parent PIN | Device, plain text (a child gate, §8) | Server: per parent, slow salted hash | Quick re-unlock of the parent area | Nobody can read it back | Until changed or the parent leaves |
| Parent email | — | Supabase sign-in only | Sign-in | Supabase sign-in system; **not linkable to a family** (§9.3) | Until the parent's account is deleted |
| Google profile (name, picture URL, Google account id), which Google sends at sign-in | — | Supabase sign-in only (`auth.users` metadata, `auth.identities`); never copied into app tables | Not used by the app; Supabase stores it with every Google sign-in | Supabase sign-in system and the owner; **not linkable to a family** (§9.3) | Until the parent's account is deleted |
| Daily job log: run time (rounded to the hour), count of late erasures | — | Server (🧪 `private.retention_runs`); no ids | The keep-alive check and the `erased_late` alert (§12.7) | Owner; `keep_alive()` answers only yes/no | 90 days |
| Family name | — | Server, encrypted (🧪 `families.name_enc`) | Display to the family | That family | Until the family is deleted |
| Consent record (notice version, date) | — | Server, by family-only member id (🧪 `consent_records`) | Proof of consent | Owner (without names) | While the family exists, then anonymized |
| Security audit log | — | Server, member ids and rounded times only (🧪 `audit_log`) | Accountability, abuse detection | Owner | **7 years** from the entry; holds no names, emails or family ids |
| Cloudflare request and error data: IP address, user agent and the page address in Cloudflare's logs, and Network Error Logging reports the browser sends to Cloudflare (`a.nel.cloudflare.com`) when a request fails | Cloudflare, as the host of https://limud-app.lomdim.workers.dev/ | Same | Delivering the app; Cloudflare's own reliability monitoring | Cloudflare (host); the owner doesn't receive it | Cloudflare's retention. NEL can't be turned off on `workers.dev` (a custom domain could); the privacy notice should name Cloudflare |
| Address handoff (one time): this device's progress passed from the old address's page to the new address's page in the same browser (`postMessage`, exact origins only; no PIN) | Device only; never a server or a URL | — | Moving to the new address | — | Not kept: merged like a backup restore |
| Backup file | Wherever the parent saves it | — | Moving data by hand | The parent | The parent's choice |

**Never collected:** real or full names (a nickname is enough), gender, date of birth, photos, location, contacts, school (until a class rollout with school approval), IP addresses in app tables, analytics, or advertising identifiers.

---

## 4. Privacy by design and by default
| Principle | How |
|---|---|
| Minimization | The inventory above. A nickname and emoji are enough. No free-text fields about the child beyond the nickname and a parent's test note. |
| Privacy by default | Nothing is shared outside the family. Sharing for a future class rollout is a consent flag that is **off**, with no UI. Test results are hidden from the child until an adult releases them (§9.1). |
| No sensitive data by accident | No gender or gendered roles anywhere (UI text: "הורה", "מבוגר"). No profile photos. |
| Unlinkability | A leaked database can't link an email to a family or child (§9.3). |
| Transparency | 🟡 A Hebrew privacy notice for parents and a short, child-level explanation, shown before the first sync. |
| Storage limitation | §3 retention column: **7 years**, or within **48 hours of the end of the day** (Israel time) a deletion request was confirmed, whichever comes first (decided 2026-11-15; day rule 2026-11-16). A scheduled job erases a whole family, with all its children and their history, 7 years after the family's last activity (🧪 `private.run_retention()`, meant to run once a day at 20:30 UTC; not scheduled yet). |
| Data-subject rights | §10. |
| Child-appropriate design | No ads, no purchases, no social features, no messaging. Streaks: no changes for now (decided 2026-11-15). The existing 🔥 day counter and two streak badges stay as they are; revisit before any wider rollout, since some child-design codes treat loss-pressure mechanics as a nudge. |

---

## 5. Threat model (STRIDE) and abuse cases

| Threat | Example | Controls | Status |
|---|---|---|---|
| **Spoofing** | Someone signs in as a parent | Invite-only sign-in with Google only (an auth hook refuses accounts without an invite; 🧪 `decisions.test.ts`), no passwords, no email links. MFA deferred (§12) | 🟡 |
| | A child opens the parent area on their own phone | Today: a 4–6 digit PIN (a child gate). Family View: server data needs the parent's own sign-in; per-parent PIN only re-unlocks (§8) | ✅ / 🟡 |
| **Tampering** | A child edits a parent-made test score, or reads its answers | Tests are scored **on the server**; the child's device never holds the answer key before release (§12) | 🧪 the key is kept apart and the device never reads it, score and note are hidden until release (`access.test.ts`) / 🟡 server scoring |
| | A malicious backup file | Strict sanitizer, size limit, forbidden keys | ✅ |
| | A compromised dependency or build action | Lockfile, `npm ci`, audit gate, SHA-pinned actions, Dependabot, SBOM | ✅ |
| **Repudiation** | A parent denies deleting a child or overriding an answer | Audit log by member id; overrides keep the app's original mark | 🧪 audit log / 🟡 overrides |
| **Information disclosure** | Database leak | Names encrypted; no email-to-family link; no IPs | 🧪 `leak.test.ts` |
| | One family reads another's data | Row Level Security with deny by default; cross-family tests | 🧪 `access.test.ts` |
| | Third-party scripts or trackers | None; enforced by CSP and `check-dist` | ✅ |
| | Lost or shared phone | Device data isn't encrypted (accepted risk §11); "report lost": revoke the device, sign out parent sessions, audit entry; per-parent PIN checked on the server with an attempt limit; recent Google sign-in for destructive actions ([family-view-design.md](family-view-design.md#devices-shared-moved-lost-owner-2026-11-17)) | 🟡 Stages 3, 6 |
| | A whole-phone restore clones a device's identity | The server's grow-only counters detect it; the copy re-pairs with a new device id | 🟡 Stage 4 |
| | Safari clears storage of an app not on the home screen | Persistent-storage request; a parent-area warning on iPhone/iPad | ✅ |
| **Denial of service** | Brute-forcing pairing codes or PINs | Single-use, short-lived codes of 8+ characters; attempt limits and back-off | 🧪 pairing codes: 10 characters (about 49 bits), single use, 15 minutes, stored as HMAC; after 30 failed attempts in an hour, all pairing waits for the next hour / 🟡 per-device back-off, PINs |
| **Elevation of privilege** | A parent acts as admin, or a child device acts as a parent | Separate roles; the admin has no data access; devices are scoped to their children; security-definer functions with fixed `search_path` | 🧪 `access.test.ts` |

**Abuse cases the design must handle**
1. **Estranged parent** wants to delete a child alone, or lock the other parent out. → Every parent must approve a deletion; removing a parent waits 7 days; soft delete, restorable until the nightly cleanup two days later; a family always has at least one parent.
2. **Tech-savvy child** inflates scores. → §12.
3. **Lost phone.** → A parent revokes that device; it is wiped at the next sync, and its sign-in token stops working.
4. **Leaked database dump.** → §9.3.
5. **Compromised admin account.** → The admin role has no access to family data, so a compromise doesn't expose children's progress.

---

## 6. OWASP Top 10:2025 control matrix
| Category | Controls | Status |
|---|---|---|
| **A01 Broken Access Control** | RLS on every table, deny by default; a test that fails if any table lacks RLS; cross-family tests (API1, object-level access); child devices limited to their children; service-role key never in the client; deletion rules enforced in database functions | 🧪 `access.test.ts`, `deletion.test.ts` / 🟡 service-role key handling (no client yet) |
| **A02 Security Misconfiguration** | Today: CSP and referrer policy, no inline scripts or source maps (✅). On the Cloudflare host: real HTTP headers from `dist/_headers` (CSP with `frame-ancestors 'none'`, HSTS, `nosniff`, `X-Frame-Options: DENY`, Permissions-Policy, CORP), checked by `check:dist` (✅ built). Family View: the Supabase baseline (§13), and a static host that sends real security headers before sync goes live | ✅ / 🟡 |
| **A03 Software Supply Chain Failures** | Lockfile and `npm ci` without install scripts; the audit gate (`scripts/audit.mjs`) blocks deploys; SHA-pinned actions; Dependabot; SBOM per build; 3 runtime dependencies | ✅ |
| **A04 Cryptographic Failures** | HTTPS only (`upgrade-insecure-requests`); Family View: names encrypted with Vault, HMAC for unlinking, PINs as slow salted hashes, key-management note (§9) | ✅ / 🧪 names and HMAC (`leak.test.ts`) / 🟡 PINs |
| **A05 Injection** | React escaping, no raw HTML; backup sanitizer; Family View: parameterized queries, server functions with fixed `search_path`, schema validation of every write | ✅ / 🧪 fixed `search_path`, inputs validated in every function, table `check` rules (`access.test.ts`) / 🟡 the sync client |
| **A06 Insecure Design** | Threat model (§5), abuse cases, unlinkability by design, rules on the server | ✅ document / 🟡 build |
| **A07 Authentication Failures** | Invite-only, no passwords (MFA deferred, §12), session lifetimes and refresh-token rotation, "sign out everywhere", per-device revocation, generic error messages (no account enumeration) | 🟡 |
| **A08 Software or Data Integrity Failures** | Tests and checks before every deploy; Family View: versioned database migrations in the repo, server-set ownership and time fields, overrides kept with the original mark | ✅ / 🧪 migrations in `supabase/migrations/`, server-set test owner and times, grow-only counters / 🟡 overrides |
| **A09 Security Logging and Alerting Failures** | Audit log in the database without personal data (member ids, rounded times); alert on repeated failed pairing or PIN attempts | 🧪 audit log, failed pairings counted / 🟡 alerts |
| **A10 Mishandling of Exceptional Conditions** | Fail closed (an error denies); atomic sync batches; generic errors to clients; backup errors never partly applied (validated before anything is replaced) | ✅ (backup) / 🟡 |

---

## 7. Access-control matrix (Family View)
| Action | Admin | Primary user | Parent | Child device |
|---|---|---|---|---|
| Invite a primary user | ✅ | ❌ (owner decision 2026-11-16) | — | — |
| Create a family | — | ✅ | — | — |
| Invite or remove a parent; hand over the primary role | — | ✅ (removal waits 7 days) | — | — |
| Read the family's children, progress and tests | ❌ (unless also a parent in that family) | ✅ | ✅ | Only its own children |
| Create or assign tests; override answers; release results | — | ✅ | ✅ | — |
| Take a test; write practice progress | — | — | — | Only for its own children |
| Delete a child | — | ✅ every parent must approve | ✅ every parent must approve | — |
| Delete the family | — | ✅ every parent must approve | ✅ every parent must approve | — |
| Revoke a device | — | ✅ | ✅ | — |
| Manage reference lists (schools, grades) | ✅ | — | — | — |
| Read any name or email-to-family mapping | ❌ | Own family only | Own family only | Own children only |

Each cell becomes an automated test (a "can't" is tested as strictly as a "can").

🧪 **Built and tested** (step 2): every row above is a test in [`src/server-tests/access.test.ts`](../src/server-tests/access.test.ts) ("access-control matrix (§7)"); the two delete rows are in [`deletion.test.ts`](../src/server-tests/deletion.test.ts). A refusal must be a refusal error (no privilege, RLS, a rule), so a broken query in a test fails instead of passing. Notes on the build:
- "Invite a primary user": only the admin (owner decision 2026-11-16, `…0700_go_live_decisions.sql`). A primary user is refused (tested). The owner's own first invite is made in the SQL editor (`private.owner_invite_primary`), because there is no admin before the owner's first sign-in.
- Sign-in is **Google only** (§12). Supabase must allow new sign-ups for Google's first sign-in and for anonymous child devices, so invite-only is enforced by the "before user created" auth hook (`public.auth_before_user_created`): a Google account is created only if its email has a pending invite (HMAC of the lower-cased email; tested with mixed-case Google-style claims in [`decisions.test.ts`](../src/server-tests/decisions.test.ts)).
- A child device signs in **anonymously** (no email) and joins with a one-time code from a parent. It sees and writes only the children a parent assigned to it, and only under its own device id. Parents can't write practice progress.
- The admin is a separate list (`app_admins`, by HMAC). Being admin gives no access to any family's rows or names.

---

## 8. Authentication and the parent PIN
**Today:** one PIN of 4 to 6 digits per device (owner, 2026-11-19), stored in plain text in the browser. It is a **child gate, not a security control**: all the data it guards is already on that device. It is never exported in backups, and restoring a backup never changes it (✅ `backup.test.ts`).

**Family View (🟡):**
- **Real access is always the parent's own sign-in.** The PIN never replaces it.
- **Each parent sets their own PIN** for their own account. There is **no shared, family or master PIN**, and **the admin has no PIN and no way to set, read or reset anyone's PIN**.
- The PIN only re-unlocks the parent area on a device where that parent is already signed in. At least 6 digits.
- Stored only as a **slow, salted hash** (Argon2id or PBKDF2), tied to the family-only member id. It is checked on the server, with an attempt limit (for example 5), after which a full sign-in is required.
- On a device with no connection, a locally cached hash can unlock only the data already on that device.
- **Forgotten PIN:** the parent signs in again with Google and sets a new one. There is no recovery path that bypasses the parent's own sign-in.
- When sync goes live, the old device PIN is discarded and each parent sets their own.

---

## 9. Cryptography and key management

### 9.1 What is protected how
| Data | Protection |
|---|---|
| Data in transit | HTTPS only (TLS from GitHub Pages and Supabase); `upgrade-insecure-requests` in the CSP |
| Database at rest | Supabase disk encryption (provider default) |
| Family and children's names, device labels | 🧪 Column encryption (`pgp_sym_encrypt`, AES-256) with a key in **Supabase Vault** (`limud_name_key`; master key held outside the database) |
| Parent sign-in id → family | 🧪 HMAC-SHA256 with a separate Vault key (`limud_hmac_key`, §9.3). Also used for device sign-in ids, invite emails and pairing codes |
| Parent PINs | 🟡 Slow salted hash; never encrypted reversibly |
| Device storage (`localStorage`) | Not encrypted. Accepted risk, §11 |

### 9.2 Keys
| Key | Where | Who can use it | Rotation |
|---|---|---|---|
| Name-encryption key | Supabase Vault | Database functions only | Yearly or after an incident: re-encrypt with the new key in a migration |
| Membership HMAC key | Supabase Vault (separate) | Database functions only | After an incident: recompute every membership fingerprint in one transaction |
| Supabase anon key | Client build (public by design) | Everyone; useless without RLS permission | On suspicion |
| Supabase service-role key | Owner's password manager only; never in the repo, CI or client | Owner, for migrations | On suspicion |
| Owner's Supabase and GitHub accounts | MFA recommended on these platform accounts | Owner | — |

### 9.3 A database leak can't link an email to a child
See [family-view-design.md](family-view-design.md#requirement-a-database-leak-must-not-link-an-email-to-a-child): HMAC'd membership, family-only member ids for every action, invites deleted on acceptance, no IPs, parent action times rounded, and a **leak test** before every deploy. Not covered: someone holding both the dump and the key; outside knowledge while there are few families; Supabase and email-service logs.

🧪 **Built and tested** (step 2): [`src/server-tests/leak.test.ts`](../src/server-tests/leak.test.ts) runs inside `npm test`, so it gates every deploy once merged. It removes the Vault keys, dumps every public table, and checks: no sign-in id in any form (text, raw bytes, unkeyed MD5/SHA hashes, HMACs with guessable keys), no email, no plain-text name or device label, no IP address, no trace of an accepted invite; no foreign key, view or function from `public` to `auth.users`; joining `auth.users` to every column finds nothing; parent action times are on the hour. Without the key, the server refuses everything (fails closed). One limit to know: the HMAC is the same for one parent in two families, so a dump shows that two families share a parent (not who).

---

## 10. Data-subject rights, including deletion when emails can't be linked to children

**The key point:** emails are unlinkable only in a *leaked copy* of the database. The live system can still resolve a family, but **only for a requester who proves they own the email**. Even then the mapping is never shown to anyone, including the owner. This lets deletion requests be honored without breaking unlinkability.

### 10.1 Today (local app)
All data is on the family's own devices; the owner holds none.
- **Delete a child:** parent area → the child → delete. Then "clear site data", or uninstall, on that device.
- **Access and portability:** the backup export (without the PIN).
- **Hosting logs:** GitHub's own records of page loads. The notice should mention them.

### 10.2 Family View (🟡): request channels and procedures
| Case | Procedure |
|---|---|
| **A. A parent who can sign in** | Self-service in the app: delete a child (every parent must approve), delete the family, delete their own account, export everything. Leaving as the last parent deletes the family, with a warning and the restore window (until the nightly cleanup two days later). |
| **B. A parent asks by email or letter instead** | The owner starts a **verified request** (an admin function that takes only the email address). The person proves they own that address by signing in with Google at a deletion-request page (no email provider, §12.5; not built yet). Once they have, the server resolves the family through the HMAC and carries out the request **under the same rules as in-app**: export, or delete with the other parents' approval. The owner sees only "verified / completed / waiting for other parents", never which family. |
| **C. The requester lost access to their email** | They give the **family reference code** (a random code shown in the parent area; stored only as an HMAC), and another parent in the family confirms in the app. If they are the only parent and have neither email nor code, the request can't be verified, and acting on it would risk deleting a stranger's data. They are told so. The unverified request stays on file for the owner to decide, and the **7-year limit** (§3) guarantees erasure within a bounded time anyway. |
| **D. A guardian who isn't a parent in the app** (for example, a parent who was never invited) | Their legal right is checked outside the app first (owner's decision). To locate the data, they need the family reference code, or one of the child's linked devices: the device can show a one-time "deletion request" code that goes to the family's parents for approval. Without either, the data can't be found; the request stays on file for the owner to decide, and the 7-year limit still applies. |
| **E. The child's own device** | Local data: delete in the parent area, or clear site data. Server data: deleting a child sends a deletion marker (tombstone) to every linked device, and revoked devices are wiped at their next sync. |
| **F. Proof of compliance** | Each completed request leaves an **anonymized record**: date, request type, channel, outcome. No member id, family id, name or email. Kept 7 years as accountability evidence. 🧪 `deletion_proofs`, tested in `deletion.test.ts`. (Cases B–D, the verified requests from outside the app, are not built yet.) |
| **G. Timing and backups** | Erasure completes **within 48 hours of the end of the day** (Israel time) on which the request was confirmed (after every required approval). Confirmed on day D: restorable until the daily maintenance run on D+2, which erases it; the deadline is 00:00 on D+3. The rule uses Israel calendar dates, not elapsed hours, so it holds whatever hour the run takes place on D+2 (🧪 `deletion.test.ts`). The run reports `erased_late` above 0 if a missed run broke a deadline; the job log should alert on it. The free tier has no server backups, so erasure is complete. With paid backups, erased data drops out when the backup retention window ends; the notice must state that window. |

---

## 11. Accepted risks
| Risk | Why accepted | Revisit when |
|---|---|---|
| Device storage is unencrypted | Anyone holding an unlocked phone can open the app anyway; a key on the device would sit next to the data | Data becomes more sensitive, or a native app is built |
| 4–6 digit device PIN today | A child gate over data already on the device | Family View launch (replaced by per-parent PINs) |
| GitHub Pages can't send HTTP security headers (no HSTS control, no `frame-ancestors`, no Permissions-Policy), and the site shares its origin (`jbrav-lab.github.io`) with the owner's other Pages site, so each can read the other's browser storage (§17) | The meta CSP covers scripts and connections; no third-party scripts | Accepted for local-only data. **Before Stage 3** (sign-in tokens on phones; §17.3 P0-1): move to a host that sends headers (Cloudflare Pages or Netlify) |
| Low and moderate advisories in build-only tools (`workbox-build` → `deepmerge`, `@rollup/plugin-node-resolve`) | Build-time only, process only this project's own files, no fix released upstream; high and critical are blocked by the CI gate | Each Dependabot update |
| Practice answers are checked on the device, so a child could tamper with practice stars | Practice needs instant feedback; tests (what a parent reviews) are scored on the server | Never for tests; practice stays as is |
| No MFA in the app (phase 1) | Invite-only sign-in with Google (Google's own account security applies); three related beta families (§12.11) | Before any wider rollout |
| Supabase free tier: no backups; project pauses after inactivity | Phones hold full copies; nothing is lost when paused. A `pg_dump` before every database change once real data exists; a daily keep-alive request (§12.5) | Before relying on the server as the only copy |
| A parent in two families has the same sign-in fingerprint (HMAC) in both, so a database dump shows that two families share a parent (not who) | One HMAC per sign-in keeps lookups simple; the dump still holds no email, id or plain name; three related beta families (owner decision 2026-11-16; §12.11) | If many families join, or a parent can be in more than one family in practice |
| Server data stored in Australia (Sydney), outside the EU and Israel | Small, free, three related beta families; consent plus Supabase's DPA; no email, sign-in id or plain-text name is readable without the Vault keys (§9.3); owner decision 2026-11-17 (§12.10) | The app pays for its own hosting, or more families join |
| picomatch ReDoS (GHSA-fc5q-39xc-vjpf, high), in build tools only (vite, vitest, vite-plugin-pwa, workbox-build); no fixed version exists | The bug needs a crafted glob *pattern*; every pattern comes from this repository, none from a user, and picomatch doesn't ship to phones. Accepted in `scripts/audit.mjs` (owner, 2026-11-18) | **2026-12-18**, when the exception expires and blocks deploys again; earlier if a fixed version appears |
| No CAPTCHA on anonymous (child device) sign-in | A CAPTCHA is a third-party script (§14); an anonymous account can do nothing without a parent's one-time code; Supabase rate limits apply (owner decision 2026-11-16) | If anonymous sign-ups are abused (watch the auth logs) |

---

## 12. Decisions (2026-11-15)
1. **Score integrity: tests are scored on the server, and the answer key is sent on release.**
   - When a parent creates a test, the frozen questions and their answer key are stored on the server. The child's device downloads the questions **only**.
   - The child's answers are saved on the device and uploaded at the next sync. The server scores them; a test taken offline shows "נשלח ✓" until then.
   - The score, the answer key and the explanations reach the child's device **only on release**.
   - **Practice** (not tests) is still checked on the device, because it needs instant feedback. A child could tamper with practice stars; this is accepted (§11).
2. **Retention: 7 years, or within 48 hours of the end of the day a deletion request was confirmed, whichever comes first.**
   - The clock is the **family's last activity**: while a family is active, nothing ages out. 7 years after the last activity, the whole family is erased, with all its children and their history. Audit-log entries (which hold no personal data) are kept 7 years from the entry.
   - A confirmed deletion request (in the app, or verified from outside) is completed within 48 hours of the end of the day (Israel time) it was confirmed (owner's rule, 2026-11-16, so the maintenance job runs once a day, not hourly). After an in-app deletion, it can be restored until the nightly cleanup two days later: at least about 46½ hours (confirmed at 23:59, run at 22:30 in winter) and up to about 72 hours (confirmed just after midnight).
   - Mistakes stay limited to the newest 200 per child on the server (the device keeps the newest 60).
   - The anonymized proof-of-deletion records (§10 F) are kept 7 years.
3. **Streaks:** no changes for now.
4. **MFA:** not in phase 1.

**Go-live decisions (owner, 2026-11-16; [go-live-plan.md](go-live-plan.md) Stage 0):**

5. **Sign-in: Google only.** No email provider and no magic links: Supabase's built-in mailer is limited, and another email provider would be one more processor. Because Supabase needs sign-ups allowed for Google's first sign-in and for anonymous devices, invite-only is enforced by the "before user created" auth hook (§7). The external deletion requests of §10 B, which assumed a one-time email link, will verify the requester through Google sign-in instead (Stage 6).
6. **No CAPTCHA**, because it would be a third-party script. Rate limits only; an anonymous device can do nothing without a parent's one-time code (§11).
7. **Free-tier pausing: a daily keep-alive request** from GitHub Actions (`.github/workflows/keep-alive.yml`) calls `public.keep_alive()`, the only function `anon` may run. It answers one yes/no: did the daily job run in the last 26 hours, with no late erasure (`erased_late`) in the last 30 days? A "no" fails the workflow and GitHub emails the owner; this is the `erased_late` alert.
8. **Only the admin invites a primary user** (§7).
9. **A shared parent fingerprint across two families is accepted** (§11).
10. **Region: Sydney (ap-southeast-2), not the EU** (owner, 2026-11-17). The project already existed there, and moving means a new project. While the app is free and run by one family for two families, it stays in Sydney; if it grows enough to pay for itself, it moves to an EU region (a new project, the migrations re-applied, data moved with `pg_dump`, and the site's CSP updated). The transfer basis is the parents' informed consent, which the privacy notice must name (data is stored in Australia), plus Supabase's data-processing agreement (§11).
11. **Beta: three related families** (owner, 2026-11-17). All three are in the owner's own family and are willing beta testers. The beta scope (tests, results, mistakes, per-parent PIN) and what is deferred are in [go-live-plan.md](go-live-plan.md) Stage 0b. During the beta, a deletion request goes to the owner, who carries it out with the database's deletion functions; it is completed within the §12.2 time limit. The accepted risks in §11 marked "three related beta families" rest on this decision.
12. **Classroom beta: considered, not decided** (owner, 2026-11-17). The owner is willing to run **one beta in up to 6 classes** (classes, not grades): at most about **170 children and their parents**, before the stricter security measures are built.
   - **Owner's reasoning:** the server is designed so that it holds no readable email, sign-in id or plain-text name (§9.3), and a deployment of 6 classes is small scale; this holds even while the app is still on GitHub Pages.
   - **What the design actually gives:** the data is **pseudonymized, not anonymous**. Names are encrypted and sign-ins are HMACs, but the keys are in the same project (Vault), and each child's results stay linked to that child and family. Pseudonymized data about children is still personal data under Israeli privacy law and the GDPR. Nothing on the server is aggregated.
   - **Before a classroom beta starts, these must be done or re-decided:**
     - the full privacy notice and each parent's consent (§10, §16), and the data-protection impact assessment (§16) updated for about 170 children;
     - the school's agreement, and any Ministry of Education requirements for apps used in class;
     - "delete my account", leaving a family, and externally verified deletion requests (§10), because the owner can't handle requests by hand at that scale;
     - the incident runbook's notification rules (§15);
     - every accepted risk in §11 that rests on "three related beta families": no MFA, the shared parent fingerprint, the Sydney region, GitHub Pages without security headers, and the free tier without backups;
     - whether teachers see results: the design has parents only; a teacher role would be a design change.

---

## 13. Supabase configuration baseline
Project `limud` (ref `adwtnunulufninshravy`, Sydney, Postgres 17, free plan). Migrations pushed 2026-11-17 with Supabase CLI 3.2.0. The project also has Supabase's own `public.rls_auto_enable()` event trigger (it turns RLS on for new tables); it is not ours and stays.

**Live check, 2026-11-17** (`scripts/live-check.mjs`, one transaction, rolled back): 18 passed, 0 failed. Checked: Postgres 17 and the Asia/Jerusalem time zone; exactly the seven migrations applied; RLS on every public table; `anon` and `authenticated` privileges equal the migrations; every security-definer function sets `search_path`; both Vault keys readable by the functions and not by `authenticated` or `anon`; the daily job at 20:30 UTC as `postgres`; the auth hook runnable only by the auth server; two test families built through the API, with no cross-family read or change (16 tables) and no test email, sign-in id or plain name in any of the 22 public tables; admin-only primary invites; `keep_alive()` answers over the API; the `private`, `vault`, `auth` and `graphql_public` schemas are not exposed (HTTP 406).

**Security advisor, 2026-11-17:** 0 errors. Warnings, all by design: `keep_alive` runnable by `anon` (intended, §12.7); the 28 API functions runnable by `authenticated` (each checks the caller's family itself); "anonymous sign-ins" on 20 tables' policies (child devices sign in anonymously and match no rows until paired with a parent's one-time code; two are Supabase's own `cron` tables, not exposed).

**Credentials:** the database password is used only by the owner, for these checks; the app and the daily job never use it. On 2026-11-17 a connection string was typed at a visible prompt; the owner reset the password before the live check, so the exposed one no longer works.

- **Google** sign-in and **anonymous** sign-in (child devices) only; the email provider and every other provider off. "Allow new users to sign up" stays **on** (Google's first sign-in and anonymous sign-in need it); invite-only is enforced by the "before user created" hook, which must be switched on (Authentication → Hooks). Rate limits on anonymous sign-ins; no CAPTCHA (§12.6). ✅ Set 2026-11-17 (Google stays off until Stage 3); hook switched on; Site URL and redirect URLs set to the Pages address and `localhost:5173`.
- MFA on the owner's Supabase account: recommended (MFA inside the app is deferred, §12).
- Every table in exposed schemas has RLS **enabled**, plus a test that fails otherwise (🧪 in PGlite). The Supabase security advisor shows no errors (✅ 2026-11-17).
- Only the API schema is exposed; internal schemas are not (internal functions live in `private`; ✅ live check 2026-11-17: `private`, `vault`, `auth` and `graphql_public` answer HTTP 406).
- Security-definer functions set `search_path` and validate every input (🧪 tested).
- The two Vault keys exist before first use, and the maintenance job (`private.daily_maintenance()`, which runs `private.run_retention()` and logs it) runs once a day at 20:30 UTC through `pg_cron` (✅ live check 2026-11-17). `scripts/live-check.mjs` checks all of this against the live database ([runbook](go-live-runbook-stage1.md)).
- Short sign-in token lifetime with refresh-token rotation.
- The CSP `connect-src` lists **only** the project's own Supabase URL. `check-dist` will be updated to allow exactly that host.
- Region: Sydney (ap-southeast-2) by owner decision (§12.10); move to the EU if the app pays for itself. 🟡 The provider's data-processing agreement and sub-processor list on file.

## 14. Secure development
- **In place ✅:** every push to `main` runs audit → tests → build → `check-dist` → SBOM, and only then deploys. Actions are pinned. Dependabot is on.
- **Repository settings ✅ (turned on 2026-11-15; check with `gh api repos/jbrav-lab/limud-app/branches/main/protection` and the repo's Security tab):** branch protection on `main` (no force-push, no deletion, linear history, applies to admins too); secret scanning with push protection; private vulnerability reporting (see `SECURITY.md`); Dependabot alerts and security updates. Required status checks are **not** set: the deploy itself runs every gate before publishing, and requiring checks would block direct pushes to `main`.
- **Rules for code changes** (also in CLAUDE.md):
  - no third-party scripts, fonts or requests;
  - no raw HTML;
  - every new stored field goes into the §3 inventory;
  - every new table gets RLS and a cross-family test (🧪 `access.test.ts` fails if a table is missing from its list or has RLS off);
  - no personal data in logs.
- **Periodic:** an OWASP ZAP baseline scan of the live site before each phase and yearly; a review of this file.

## 15. Incident response (runbook)
1. **Contain:** revoke keys or sessions (rotate Vault keys, service-role key, anon key), pause the Supabase project if needed, and revoke affected devices.
2. **Assess:** what data, how many families, whether the leak includes Vault keys (decides whether names and the email-to-family link are exposed).
3. **Notify:** the families concerned, and the regulator where the law requires it, within the legal deadlines. ⬜ Owner to record the applicable Israeli notification rules and deadlines here.
4. **Recover:** fix, rotate, restore from phones (they hold full copies), and verify with the leak test and the access-control tests.
5. **Learn:** update this file, the threat model and the tests.

## 16. Data-protection impact assessment (summary)
- **Processing:** learning progress of minors, in three related beta families (§12.11), for education and parent oversight.
- **Necessity:** syncing is needed to move between devices and to let parents review from their own phones. The data collected is the minimum for that.
- **Main risks:** children's learning results exposed, and parents linked to children.
- **Mitigations:** §§4–10.
- **Residual risk:** low at the current scale, provided the 🟡 items and the §11 go-live condition are done first.
- **Review before:** the Family View launch, and before any class rollout. A class rollout needs a new assessment (schools, teachers, aggregates).

---

## 17. Security review and plan (2026-11-17)
After the Stage 2 work on `claude/sync-step2`. The OWASP Top 10:2025 matrix (§6) re-checked against the code, the live database and known 2026 vulnerabilities for this stack.

### 17.1 OWASP Top 10:2025, re-checked
| Category | Finding | Status |
|---|---|---|
| A01 Broken Access Control | Live check (§13): RLS on every table, privileges equal the migrations, cross-family isolation and admin-only primary invites pass on the live project. Every parent-only function refuses anonymous (device) callers. | ✅ |
| A02 Security Misconfiguration | **New: the site shares its web origin.** `jbrav-lab.github.io` also serves `bank-of-mom-and-dad`, and browser storage is per origin, not per path: either site's scripts can read the other's `localStorage`. Today that is the children's local progress; with Family View it would also be the Supabase sign-in tokens. Also still open: no HTTP security headers on GitHub Pages (no `frame-ancestors`). | 🔴 → plan P0-1 |
| A03 Supply Chain | `npm audit`: 0 advisories on the branch. Lockfile, `npm ci`, SHA-pinned actions, `permissions: {}`, SBOM. Gap: install scripts run in CI (the Supabase CLI package downloads a binary at install), and new versions are accepted as soon as published, the window the 2026 npm worms used. | 🟡 → P0-2 |
| A04 Cryptographic Failures | Vault-encrypted names, HMAC unlinkability (leak test passes); 50-bit one-time pairing codes stored as HMAC. PIN hashing not built yet. | ✅ / 🟡 Stage 6 |
| A05 Injection | No raw HTML; backup sanitizer covers the new fields; server functions have fixed `search_path` and validated input. | ✅ |
| A06 Insecure Design | Added: shared, moved and lost devices, and roles beyond the family ([family-view-design.md](family-view-design.md), [roles-design.md](roles-design.md)). Gap: **one anonymous caller can block all device pairing** for an hour (30 failed codes, counted globally). | 🟡 → P1-1 |
| A07 Authentication Failures | Google-only, invite-only (hook live). Not built yet: session lifetimes, sign-out everywhere, PIN attempt limit, recent sign-in for destructive actions. `http://localhost:5173/**` is an allowed redirect on the live project. | 🟡 → P1-2, P0-3 |
| A08 Data Integrity | New: an older app copy can't overwrite newer data; upgrades tested on fixtures of every version; tombstones; grow-only counters on the server. | ✅ |
| A09 Logging and Alerting | Audit log without personal data; the keep-alive alert for a missed or late erasure. No alert yet on failed pairings or PIN attempts. Anonymous sign-ins that never pair stay in `auth.users`. | 🟡 → P1-3 |
| A10 Exceptional Conditions | Fail closed: a newer-data screen instead of writing; backup validated before anything changes. | ✅ |

### 17.2 Known 2026 vulnerabilities, checked against this stack
| Issue | Applies? |
|---|---|
| CVE-2026-126187, React Server Components remote code execution | **No.** The app has no server components; React 19.3.1 is also the fixed version. |
| Vite dev-server file read (CVE-2026-112947, Vite 8.2.0–8.2.3) | **No.** Vite 8.3.8 (fixed). The review found `npm run dev` did expose the dev server to the local network (`--host`); since 2026-11-17 that is opt-in (`npm run dev:lan`, for testing on a phone at home). |
| `serialize-javascript`, `minimatch`, `deepmerge` advisories through `workbox-build` | **Build-time only**; `npm audit` shows none on the branch (the `deepmerge` alert on `main`, low, goes with this merge). Watch Dependabot. |
| Supabase Realtime presence RLS bypass (CVE-2026-62247) | **No.** No table is published to Realtime (checked live: 0). |
| Supabase Auth crafted OIDC token bypass (reported as CVE-2026-31813, auth < 2.185.0; not confirmed from the official advisory) | **Hosted Supabase is patched by Supabase.** Check the project's Auth version and Supabase's advisories before Stage 3 (Google is OIDC). → P0-4 |
| npm worms (Mini Shai-Hulud, May; ChainDrop, August 2026): compromised maintainers republish packages with install hooks that steal CI and developer tokens | **Exposure: CI and the owner's PC** (GitHub, Supabase CLI and npm tokens). → P0-2 |
| Exposed Supabase databases without RLS (UpGuard, September 2026) | **No.** RLS on every table, tested in CI and live. |
| SECURITY DEFINER functions callable by `anon` | **Only `keep_alive()`**, which returns one yes/no. |

### 17.3 Plan
**P0, before Stage 3** (before any sign-in token or server data is on a phone):
1. **Own origin and real headers.** *In progress 2026-11-17:* the Cloudflare project builds `main`; the headers file and its `check:dist` checks are built on the branch; the phones move with the "we've moved" handoff (go-live plan). Move the app to a host with its own origin that sends security headers (for example Cloudflare Pages, or a custom subdomain). This **changes the site address**: each phone's progress moves with a backup and restore (the restore now merges). Until then the only data on that origin is local progress, and the other site is the owner's own.
2. **Supply chain.** *Done 2026-11-17 (except 2FA, owner):* `.npmrc` `ignore-scripts=true` (CI, Cloudflare and the PC), `npm ci --ignore-scripts` in CI, Dependabot cooldown 7 days. In CI, install without running install scripts (`npm ci --ignore-scripts`, after checking the build doesn't need them); keep the Supabase CLI out of the CI install. Dependabot `cooldown` of 7 days for new versions (security fixes still come at once). 2FA on the GitHub, Supabase, Google and npm accounts; no long-lived tokens on the PC beyond the Supabase CLI login.
3. **Redirect URLs.** Remove `http://localhost:5173/**` from the live project's redirect list before the first real family (Stage 7); a second Supabase project for development would remove the need.
4. **Auth version.** Confirm the hosted Auth version is past the OIDC fix before enabling Google.

**P1, with Stages 3–6:**
1. **Pairing lockout:** count failures per caller (anonymous sign-in) with a low limit, and keep a higher global cap, so one caller can't block every family.
2. **Sessions:** short access-token lifetime, refresh-token rotation, "sign out everywhere", "report lost" (§5, devices design); per-parent PIN checked on the server with an attempt limit; a recent Google sign-in for deleting, approving, inviting and handing over the primary role.
3. **Alerts and cleanup:** the daily job deletes anonymous sign-ins that never paired within 24 hours, and flags repeated failed pairings or PIN attempts in the keep-alive answer.

**P2, ongoing:**
1. Run the Supabase security advisor and `live-check.mjs` after every migration.
2. Once a month: Supabase's GitHub security advisories, Dependabot alerts, and this table.
3. Before the classroom beta: the §12.12 preconditions and a new data-protection impact assessment.
