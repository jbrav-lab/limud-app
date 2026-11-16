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
| No known high or critical vulnerabilities in dependencies | `npm audit --audit-level=high` in `.github/workflows/deploy.yml` | CI, every deploy |
| Software bill of materials | `npm sbom` → `sbom` artifact on each run (kept 90 days) | CI, every deploy |
| Pinned, least-privilege build pipeline | `.github/workflows/deploy.yml` (actions pinned to commit SHAs, `permissions: {}` by default, per-job grants, no stored git credentials) | Read the file |
| Dependency and action updates | `.github/dependabot.yml`; Dependabot alerts and security updates on | Weekly, and on new advisories |
| Repository protections | Branch protection on `main`, secret scanning with push protection, private vulnerability reporting (§14) | Enforced by GitHub |
| Backup files carry no PIN; restore accepts only a known, size-limited shape | `src/engine/backup.ts`, tests in `src/engine/backup.test.ts` | CI, every deploy |
| Data migrations keep all progress | `src/engine/store.test.ts` | CI, every deploy |
| Every question generator produces valid, non-negative, self-checking answers | `src/curricula/curricula.test.ts` (400 runs per generator and level in CI; `GEN_RUNS=20000 npx vitest run -t "topic generators"` as a soak test) | CI (400 runs) |
| No raw HTML rendering (no `dangerouslySetInnerHTML`, `innerHTML` or `eval`) | Code search; the text renderer `src/components/MathText.tsx` builds React elements only | Manual check (§13) |

**Sync server (step 2, 🧪 built, tested on branch `claude/sync-step2`, not live).** The migrations run in PGlite inside `npm test`, on a small shim for the Supabase-only pieces ([sync-supabase-plan.md §9](sync-supabase-plan.md#9-step-2-database-schema-and-security-built-2026-11-16) lists what must be re-checked on real Supabase). CI runs them once the branch is merged into `main`; until then, `npm test` runs them locally.

| Control | Evidence | Runs automatically |
|---|---|---|
| Row Level Security on every table, deny by default; a test fails if any table lacks RLS or a cross-family test | `supabase/migrations/20261116000300_rls.sql`; [`src/server-tests/access.test.ts`](../src/server-tests/access.test.ts) ("schema guarantees") | `npm test` (CI after merge) |
| Not signed in (`anon`): no privilege on any table or function; sign-in fingerprints never selectable | `20261116000600_grants.sql`; `access.test.ts` ("schema guarantees", "not signed in") | `npm test` |
| Every `security definer` function sets `search_path` (and validates its inputs) | All migrations; `access.test.ts` ("every security definer function sets search_path") | `npm test` |
| Family A can never read or change family B's rows (every table, every role) | `access.test.ts` ("family A can never read family B", with a before/after snapshot of B) | `npm test` |
| The access-control matrix (§7), each cell | `access.test.ts` ("access-control matrix (§7)"), and `deletion.test.ts` for the delete rows | `npm test` |
| Deletion rules: every parent approves; 7-day expiry; 7-day parent removal that blocks deletion; soft delete restorable until the daily run on D+2 (Israel date), which erases it, before the 00:00 D+3 deadline; never zero parents; one primary user | `20261116000500_deletion_retention.sql`; [`src/server-tests/deletion.test.ts`](../src/server-tests/deletion.test.ts) ("the day rule for erasing": 00:01 and 23:59 requests, every hour of D+1 and D+2, both daylight-saving changes, the 20:30 UTC schedule for 2026–2030) | `npm test` |
| Retention: erase 7 years after last activity; audit entries and proofs kept 7 years; consent anonymized; newest 200 mistakes | `private.run_retention()`; `deletion.test.ts` ("retention", "deleting the family") | `npm test` (the job itself is not scheduled yet) |
| Leak test: a dump without the Vault keys holds no sign-in id, email, unkeyed hash, plain-text name or IP; accepted invites leave no trace; no query joins an email to a child | [`src/server-tests/leak.test.ts`](../src/server-tests/leak.test.ts) | `npm test` |
| Parent action times rounded to the hour | Table `check` rules in `20261116000200_tables.sql`; `leak.test.ts`, `deletion.test.ts` | `npm test` |

---

## 2. System overview

### Today (live)
- A static web app (PWA) served by **GitHub Pages** from a public repository. It has **no server, no accounts and no data collection**.
- All data stays in the browser storage of the device (`localStorage`, key `limud-app-v1`): profiles, progress, mistakes and test results.
- Data leaves the device only when a parent exports a backup file themself.
- **GitHub** (as host) receives standard web-request data (IP address, user agent) for page loads. The project owner does not receive or keep it. The privacy notice should say so.

### Family View (designed, not built)
Supabase (Postgres, sign-in, Row Level Security, Vault) as the sync server, EU region. Phones stay the main copy and sync when online. Details: [family-view-design.md](family-view-design.md).

---

## 3. Data inventory (record of processing)

| Data | Today: where | Family View: where | Purpose | Who can see it | Kept for |
|---|---|---|---|---|---|
| Child nickname | Device | Server, **encrypted** (Vault; 🧪 `children.name_enc`) | Show whose progress it is | That family's parents and linked devices | **7 years** after the family's last activity, or within **48 hours of the end of the day** (Israel time) a deletion request was confirmed, whichever comes first |
| Avatar (emoji), grade, color theme | Device | Server | Display; choosing the grade's content | Same | Same |
| Practice progress, stars, streak, daily counts | Device | Server | Learning, adaptive difficulty, parent oversight | Same | Same |
| Per-device counters (data v3: stars, sessions and answers per day, kept per `deviceId` under each child's `byDevice`; a streak carried over from v2 as `streakSeed`). Totals and the streak are computed from them, not stored | Device; in backup files | Server | Summing counts from several phones without counting twice | Same | Same |
| Record ids and change times (data v3: UUID profile ids, an `id` on every test result and mistake, `updatedAt` on profiles and topic progress) | Device; in backup files | Server | Merging data from several devices | Same | Same |
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
| Family name | — | Server, encrypted (🧪 `families.name_enc`) | Display to the family | That family | Until the family is deleted |
| Consent record (notice version, date) | — | Server, by family-only member id (🧪 `consent_records`) | Proof of consent | Owner (without names) | While the family exists, then anonymized |
| Security audit log | — | Server, member ids and rounded times only (🧪 `audit_log`) | Accountability, abuse detection | Owner | **7 years** from the entry; holds no names, emails or family ids |
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
| **Spoofing** | Someone signs in as a parent | Invite-only sign-in, email link or Google, no passwords. MFA deferred (§12) | 🟡 |
| | A child opens the parent area on their own phone | Today: 4-digit PIN (a child gate). Family View: server data needs the parent's own sign-in; per-parent PIN only re-unlocks (§8) | ✅ / 🟡 |
| **Tampering** | A child edits a parent-made test score, or reads its answers | Tests are scored **on the server**; the child's device never holds the answer key before release (§12) | 🧪 the key is kept apart and the device never reads it, score and note are hidden until release (`access.test.ts`) / 🟡 server scoring |
| | A malicious backup file | Strict sanitizer, size limit, forbidden keys | ✅ |
| | A compromised dependency or build action | Lockfile, `npm ci`, audit gate, SHA-pinned actions, Dependabot, SBOM | ✅ |
| **Repudiation** | A parent denies deleting a child or overriding an answer | Audit log by member id; overrides keep the app's original mark | 🧪 audit log / 🟡 overrides |
| **Information disclosure** | Database leak | Names encrypted; no email-to-family link; no IPs | 🧪 `leak.test.ts` |
| | One family reads another's data | Row Level Security with deny by default; cross-family tests | 🧪 `access.test.ts` |
| | Third-party scripts or trackers | None; enforced by CSP and `check-dist` | ✅ |
| | Lost or shared phone | Device data isn't encrypted (accepted risk §11); per-device revocation from the parent area | 🟡 |
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
| **A02 Security Misconfiguration** | Today: CSP and referrer policy, no inline scripts or source maps (✅). Family View: the Supabase baseline (§13), and a static host that sends real security headers before sync goes live | ✅ / 🟡 |
| **A03 Software Supply Chain Failures** | Lockfile and `npm ci`; `npm audit --audit-level=high` blocks deploys; SHA-pinned actions; Dependabot; SBOM per build; 3 runtime dependencies | ✅ |
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
| Invite a primary user | ✅ | ✅ | — | — |
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
- "Invite a primary user" for a primary user is built as the matrix says: any primary user can invite another primary user, who then creates **their own** family. Revisit if that's broader than meant.
- A child device signs in **anonymously** (no email) and joins with a one-time code from a parent. It sees and writes only the children a parent assigned to it, and only under its own device id. Parents can't write practice progress.
- The admin is a separate list (`app_admins`, by HMAC). Being admin gives no access to any family's rows or names.

---

## 8. Authentication and the parent PIN
**Today:** one 4-digit PIN per device, stored in plain text in the browser. It is a **child gate, not a security control**: all the data it guards is already on that device. It is never exported in backups, and restoring a backup never changes it (✅ `backup.test.ts`).

**Family View (🟡):**
- **Real access is always the parent's own sign-in.** The PIN never replaces it.
- **Each parent sets their own PIN** for their own account. There is **no shared, family or master PIN**, and **the admin has no PIN and no way to set, read or reset anyone's PIN**.
- The PIN only re-unlocks the parent area on a device where that parent is already signed in. At least 6 digits.
- Stored only as a **slow, salted hash** (Argon2id or PBKDF2), tied to the family-only member id. It is checked on the server, with an attempt limit (for example 5), after which a full sign-in is required.
- On a device with no connection, a locally cached hash can unlock only the data already on that device.
- **Forgotten PIN:** the parent signs in again (email link or Google) and sets a new one. There is no recovery path that bypasses the parent's own sign-in.
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
| **B. A parent asks by email or letter instead** | The owner starts a **verified request** (an admin function that takes only the email address). The system sends a one-time link to that address. When the person clicks it, the server resolves the family through the HMAC and carries out the request **under the same rules as in-app**: export, or delete with the other parents' approval. The owner sees only "verified / completed / waiting for other parents", never which family. |
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
| 4-digit device PIN today | A child gate over data already on the device | Family View launch (replaced by per-parent PINs) |
| GitHub Pages can't send HTTP security headers (no HSTS control, no `frame-ancestors`, no Permissions-Policy) | No server data yet; the meta CSP covers scripts and connections | **Before Family View goes live:** move to a host that sends headers (Cloudflare Pages or Netlify) |
| Low and moderate advisories in build-only tools (`workbox-build` → `deepmerge`, `@rollup/plugin-node-resolve`) | Build-time only, process only this project's own files, no fix released upstream; high and critical are blocked by the CI gate | Each Dependabot update |
| Practice answers are checked on the device, so a child could tamper with practice stars | Practice needs instant feedback; tests (what a parent reviews) are scored on the server | Never for tests; practice stays as is |
| No MFA in the app (phase 1) | Invite-only sign-in by email link or Google; two families | Before any wider rollout |
| Supabase free tier: no backups; project pauses after inactivity | Phones hold full copies; nothing is lost when paused | Before relying on the server as the only copy |

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

---

## 13. Supabase configuration baseline (🟡, check before go-live)
- Public sign-ups **off** (invite only); unused sign-in providers off; email-enumeration protection on; email link and Google only.
- MFA on the owner's Supabase account: recommended (MFA inside the app is deferred, §12).
- Every table in exposed schemas has RLS **enabled**, plus a test that fails otherwise (🧪 in PGlite). The Supabase security advisor shows no errors (🟡 check on the real project).
- Only the API schema is exposed; internal schemas are not (internal functions live in `private`; 🟡 check the API settings).
- Security-definer functions set `search_path` and validate every input (🧪 tested).
- The two Vault keys exist before first use, and the maintenance job (`private.run_retention()`) runs once a day at 20:30 UTC through `pg_cron` (🟡).
- Short sign-in token lifetime with refresh-token rotation.
- The CSP `connect-src` lists **only** the project's own Supabase URL. `check-dist` will be updated to allow exactly that host.
- EU region (Frankfurt); the provider's data-processing agreement and sub-processor list on file.

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
2. **Assess:** what data, how many families, whether the leak includes Vault keys (decides whether names and the email link are exposed).
3. **Notify:** the families concerned, and the regulator where the law requires it, within the legal deadlines. ⬜ Owner to record the applicable Israeli notification rules and deadlines here.
4. **Recover:** fix, rotate, restore from phones (they hold full copies), and verify with the leak test and the access-control tests.
5. **Learn:** update this file, the threat model and the tests.

## 16. Data-protection impact assessment (summary)
- **Processing:** learning progress of minors, in two families, for education and parent oversight.
- **Necessity:** syncing is needed to move between devices and to let parents review from their own phones. The data collected is the minimum for that.
- **Main risks:** children's learning results exposed, and parents linked to children.
- **Mitigations:** §§4–10.
- **Residual risk:** low at the current scale, provided the 🟡 items and the §11 go-live condition are done first.
- **Review before:** the Family View launch, and before any class rollout. A class rollout needs a new assessment (schools, teachers, aggregates).
