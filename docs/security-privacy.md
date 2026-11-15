# Security and privacy file

A living record of how the app protects children's data: what is in place today, what is designed for the Family View (server sync), and the evidence for each claim.
Benchmarks: **OWASP Top 10:2025**, the **OWASP API Security Top 10** (the sync server is an API), and **privacy by design and by default**.

| | |
|---|---|
| Owner | Project owner (controller) |
| Last reviewed | 2026-11-15 |
| Review | Before each phase goes live, after any security-relevant change, and at least once a year |
| Status legend | ✅ **in place** (with evidence) · 🟡 **designed** (Family View, not built) · ⬜ **open decision** |

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
| Child nickname | Device | Server, **encrypted** (Vault) | Show whose progress it is | That family's parents and linked devices | **7 years** after the family's last activity, or **48 hours** after a confirmed deletion request, whichever comes first |
| Avatar (emoji), grade, color theme | Device | Server | Display; choosing the grade's content | Same | Same |
| Practice progress, stars, streak, daily counts | Device | Server | Learning, adaptive difficulty, parent oversight | Same | Same |
| Mistakes (question, child's answer, correct answer) | Device (newest 200) | Server (newest 200) | Practice and parent review | Same | Rolling 200 |
| Test results and answers | Device | Server | Parent review and release | Same | Same |
| Parent PIN | Device, plain text (a child gate, §8) | Server: per parent, slow salted hash | Quick re-unlock of the parent area | Nobody can read it back | Until changed or the parent leaves |
| Parent email | — | Supabase sign-in only | Sign-in | Supabase sign-in system; **not linkable to a family** (§9.3) | Until the parent's account is deleted |
| Family name | — | Server, encrypted | Display to the family | That family | Until the family is deleted |
| Consent record (notice version, date) | — | Server, by family-only member id | Proof of consent | Owner (without names) | While the family exists, then anonymized |
| Security audit log | — | Server, member ids and rounded times only | Accountability, abuse detection | Owner | **7 years** from the entry; holds no names, emails or family ids |
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
| Storage limitation | §3 retention column: **7 years**, or **48 hours** after a confirmed deletion request, whichever comes first (decided 2026-11-15). A nightly job erases a whole family, with all its children and their history, 7 years after the family's last activity. |
| Data-subject rights | §10. |
| Child-appropriate design | No ads, no purchases, no social features, no messaging. Streaks: no changes for now (decided 2026-11-15). The existing 🔥 day counter and two streak badges stay as they are; revisit before any wider rollout, since some child-design codes treat loss-pressure mechanics as a nudge. |

---

## 5. Threat model (STRIDE) and abuse cases

| Threat | Example | Controls | Status |
|---|---|---|---|
| **Spoofing** | Someone signs in as a parent | Invite-only sign-in, email link or Google, no passwords. MFA deferred (§12) | 🟡 |
| | A child opens the parent area on their own phone | Today: 4-digit PIN (a child gate). Family View: server data needs the parent's own sign-in; per-parent PIN only re-unlocks (§8) | ✅ / 🟡 |
| **Tampering** | A child edits a parent-made test score, or reads its answers | Tests are scored **on the server**; the child's device never holds the answer key before release (§12) | 🟡 |
| | A malicious backup file | Strict sanitizer, size limit, forbidden keys | ✅ |
| | A compromised dependency or build action | Lockfile, `npm ci`, audit gate, SHA-pinned actions, Dependabot, SBOM | ✅ |
| **Repudiation** | A parent denies deleting a child or overriding an answer | Audit log by member id; overrides keep the app's original mark | 🟡 |
| **Information disclosure** | Database leak | Names encrypted; no email-to-family link; no IPs | 🟡 |
| | One family reads another's data | Row Level Security with deny by default; cross-family tests | 🟡 |
| | Third-party scripts or trackers | None; enforced by CSP and `check-dist` | ✅ |
| | Lost or shared phone | Device data isn't encrypted (accepted risk §11); per-device revocation from the parent area | 🟡 |
| **Denial of service** | Brute-forcing pairing codes or PINs | Single-use, short-lived codes of 8+ characters; attempt limits and back-off | 🟡 |
| **Elevation of privilege** | A parent acts as admin, or a child device acts as a parent | Separate roles; the admin has no data access; devices are scoped to their children; security-definer functions with fixed `search_path` | 🟡 |

**Abuse cases the design must handle**
1. **Estranged parent** wants to delete a child alone, or lock the other parent out. → Every parent must approve a deletion; removing a parent waits 7 days; soft delete, restorable for 48 hours; a family always has at least one parent.
2. **Tech-savvy child** inflates scores. → §12.
3. **Lost phone.** → A parent revokes that device; it is wiped at the next sync, and its sign-in token stops working.
4. **Leaked database dump.** → §9.3.
5. **Compromised admin account.** → The admin role has no access to family data, so a compromise doesn't expose children's progress.

---

## 6. OWASP Top 10:2025 control matrix
| Category | Controls | Status |
|---|---|---|
| **A01 Broken Access Control** | RLS on every table, deny by default; a test that fails if any table lacks RLS; cross-family tests (API1, object-level access); child devices limited to their children; service-role key never in the client; deletion rules enforced in database functions | 🟡 |
| **A02 Security Misconfiguration** | Today: CSP and referrer policy, no inline scripts or source maps (✅). Family View: the Supabase baseline (§13), and a static host that sends real security headers before sync goes live | ✅ / 🟡 |
| **A03 Software Supply Chain Failures** | Lockfile and `npm ci`; `npm audit --audit-level=high` blocks deploys; SHA-pinned actions; Dependabot; SBOM per build; 3 runtime dependencies | ✅ |
| **A04 Cryptographic Failures** | HTTPS only (`upgrade-insecure-requests`); Family View: names encrypted with Vault, HMAC for unlinking, PINs as slow salted hashes, key-management note (§9) | ✅ / 🟡 |
| **A05 Injection** | React escaping, no raw HTML; backup sanitizer; Family View: parameterized queries, server functions with fixed `search_path`, schema validation of every write | ✅ / 🟡 |
| **A06 Insecure Design** | Threat model (§5), abuse cases, unlinkability by design, rules on the server | ✅ document / 🟡 build |
| **A07 Authentication Failures** | Invite-only, no passwords (MFA deferred, §12), session lifetimes and refresh-token rotation, "sign out everywhere", per-device revocation, generic error messages (no account enumeration) | 🟡 |
| **A08 Software or Data Integrity Failures** | Tests and checks before every deploy; Family View: versioned database migrations in the repo, server-set ownership and time fields, overrides kept with the original mark | ✅ / 🟡 |
| **A09 Security Logging and Alerting Failures** | Audit log in the database without personal data (member ids, rounded times); alert on repeated failed pairing or PIN attempts | 🟡 |
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
| Family and children's names, device labels | 🟡 Column encryption with a key in **Supabase Vault** (master key held outside the database) |
| Parent sign-in id → family | 🟡 HMAC with a separate Vault key (§9.3) |
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
| **A. A parent who can sign in** | Self-service in the app: delete a child (every parent must approve), delete the family, delete their own account, export everything. Leaving as the last parent deletes the family, with a warning and the 48-hour restore window. |
| **B. A parent asks by email or letter instead** | The owner starts a **verified request** (an admin function that takes only the email address). The system sends a one-time link to that address. When the person clicks it, the server resolves the family through the HMAC and carries out the request **under the same rules as in-app**: export, or delete with the other parents' approval. The owner sees only "verified / completed / waiting for other parents", never which family. |
| **C. The requester lost access to their email** | They give the **family reference code** (a random code shown in the parent area; stored only as an HMAC), and another parent in the family confirms in the app. If they are the only parent and have neither email nor code, the request can't be verified, and acting on it would risk deleting a stranger's data. They are told so. The unverified request stays on file for the owner to decide, and the **7-year limit** (§3) guarantees erasure within a bounded time anyway. |
| **D. A guardian who isn't a parent in the app** (for example, a parent who was never invited) | Their legal right is checked outside the app first (owner's decision). To locate the data, they need the family reference code, or one of the child's linked devices: the device can show a one-time "deletion request" code that goes to the family's parents for approval. Without either, the data can't be found; the request stays on file for the owner to decide, and the 7-year limit still applies. |
| **E. The child's own device** | Local data: delete in the parent area, or clear site data. Server data: deleting a child sends a deletion marker (tombstone) to every linked device, and revoked devices are wiped at their next sync. |
| **F. Proof of compliance** | Each completed request leaves an **anonymized record**: date, request type, channel, outcome. No member id, family id, name or email. Kept 7 years as accountability evidence. |
| **G. Timing and backups** | Erasure completes **within 48 hours** of the confirmed request (after every required approval). The free tier has no server backups, so erasure is complete. With paid backups, erased data drops out when the backup retention window ends; the notice must state that window. |

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
2. **Retention: 7 years, or 48 hours after a confirmed deletion request, whichever comes first.**
   - The clock is the **family's last activity**: while a family is active, nothing ages out. 7 years after the last activity, the whole family is erased, with all its children and their history. Audit-log entries (which hold no personal data) are kept 7 years from the entry.
   - A confirmed deletion request (in the app, or verified from outside) is completed within 48 hours. This is also the restore window after an in-app deletion.
   - Mistakes stay limited to the newest 200 per child.
   - The anonymized proof-of-deletion records (§10 F) are kept 7 years.
3. **Streaks:** no changes for now.
4. **MFA:** not in phase 1.

---

## 13. Supabase configuration baseline (🟡, check before go-live)
- Public sign-ups **off** (invite only); unused sign-in providers off; email-enumeration protection on; email link and Google only.
- MFA on the owner's Supabase account: recommended (MFA inside the app is deferred, §12).
- Every table in exposed schemas has RLS **enabled**, plus a test that fails otherwise. The Supabase security advisor shows no errors.
- Only the API schema is exposed; internal schemas are not.
- Security-definer functions set `search_path` and validate every input.
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
  - every new table gets RLS and a cross-family test;
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
