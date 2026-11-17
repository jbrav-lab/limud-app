# Project notes for Claude

Hebrew (RTL) learning app suite for the user's kids (grades 2 and 5; grades 4 and 5 built: grade 4 math, science and Hebrew language; grade 5 math, science, Hebrew language and English). React + TypeScript + Vite PWA. See README.md.

## Curriculum suite (one app, many subjects)
- Hierarchy: Grade → Subject pack → Unit → Topic. Registry: `src/curricula/index.ts` (`PACKS` info + lazy `LOADERS`). Each pack lives in `src/curricula/g<grade>/<subject>/pack.ts` and exports local ids; the registry namespaces them (`g5.math.fractions`). Store and route ids are always namespaced.
- **Add a subject:** create the pack folder + `pack.ts`, add it to `PACKS` and `LOADERS`, and add a curriculum mapping doc in `docs/`. `src/curricula/curricula.test.ts` checks every pack automatically.
- Profiles have a `grade`. A grade with one subject goes straight into it; otherwise the child sees the subject screen (`src/screens/Subjects.tsx`). Screens that need topics render inside `<WithPacks>`.
- Stored data is version 3. `migrate()` in `src/engine/store.ts` upgrades version-1 data (un-namespaced math ids) and version-2 data in place, and keeps untouched copies under `limud-app-backup-before-v2` / `limud-app-backup-before-v3`. Version 3: UUID profile ids (old ids are remapped, including the session `pid`), ids on exams and mistakes, `updatedAt`, a local `deviceId`, and stars/sessions/daily counts per device in `byDevice`. Screens read totals and the streak through `childProgress()`, which sums devices; never store totals. Merging devices: `src/engine/merge.ts`. Never change the storage key `limud-app-v1`. Any future data change needs a new version, a migration step, a test in `src/engine/store.test.ts`, and a fixture `src/engine/fixtures/data-v<N>.json` (`upgrade.test.ts` fails without it). Bump `DATA_VERSION` in `store.ts`: older app copies then refuse to write newer data. The upgrade must stay safe to run on any mix of old and new shapes.
- Suite plan and next steps: `docs/roadmap.md`.

## Deploy
- Live at https://jbrav-lab.github.io/limud-app/ (GitHub Pages, public repo jbrav-lab/limud-app). Pushing to `main` deploys via `.github/workflows/deploy.yml` (npm ci → test → build → Pages).
- **Moving to Cloudflare** (owner, 2026-11-17; security file §17.3 P0-1): new address https://limud-app.lomdim.workers.dev/ (`NEW_ORIGIN` in `src/engine/move.ts`; the "we've moved" handoff). Cloudflare builds `main` itself (build command runs audit, tests, build and `check:dist`). The build writes `dist/_headers` (HTTP security headers, generated from `CSP` and `HEADERS` in `vite.config.ts`; `check:dist` fails if they are missing or weaker). Both hosts serve `main` until every phone has moved; then GitHub Pages keeps only a pointer to the new address.
- Commit as the repo's configured noreply author (never the user's real email). `git`/`gh` were installed with winget; in a fresh shell refresh PATH from the Machine+User environment first.
- Never change the site address (repo name or a custom domain) without warning the user: progress lives in the phone's browser storage for that address, so a new address starts every child from zero (backup/restore in the parent area moves it).

## Question banks (science and future language subjects)
- Authored questions live as data in the pack files, built with `bankTopic` from `src/engine/bank.ts`. Item shapes: choice `{q, a, d}`, true/false `{tf, t}`, multiple selection `{q, multi, d}`, ordering `{q, order}`, matching `{q, match}`, number `{q, num}`, typed word `{q, text: [accepted…]}` (compared without case, niqqud or end punctuation; Hebrew roots via `rootAnswers()`); each has a level `l` (1–3), an explanation `why`, and an optional `hint`.
- `curricula.test.ts` requires at least 3 items per level per topic, checks every item is reachable, and self-checks each answer type. Every bank item is a word problem, so the fraction/decimal rule below applies.
- English (`g5.english`, `dir: 'ltr'`): prompts and options in English, lessons and explanations in Hebrew. LTR content gets `dirClass(topicId)` (`.dir-auto`: each line takes its direction from its text). Write times as `7:30`, not `7.30` (the decimal rule).
- Write standard Hebrew (full spelling), use the plural imperative (בחרו, סדרו, התאימו), and check facts against the curriculum doc for that pack.

## Content rules
- **Word problems (story questions): every fraction appears in Hebrew words AND as a number**, e.g. "מאיה נתנה חצי (1/2) מן התפוחים שלה". Use `frBoth(n, d)` (or `frBoth(n, d, true)` for mixed numbers) from `src/engine/math.ts`. Whole numbers stay as digits. Word-problem prompts are marked with `wordProblem: true` on the question, and `topics.test.ts` checks the rule.

## Security and privacy
The record is `docs/security-privacy.md` (evidence index, data inventory, OWASP matrix). Keep it true when code changes:
- Sync database (step 2): migrations in `supabase/migrations/` (never edit an applied one; add a new file). Tests in `src/server-tests/` run them in PGlite on a test-only shim (`shims/supabase-shim.sql`; keep it out of the migrations). A new table needs RLS, grants in a migration, and an entry in the `TABLES` list of `access.test.ts`. Every `security definer` function sets `search_path = ''` and validates its inputs. Parent action times are rounded to the hour. Details: `docs/sync-supabase-plan.md` §9.
- No third-party scripts, fonts or requests, and no raw HTML (`dangerouslySetInnerHTML`, `innerHTML`, `eval`). `npm run check:dist` (also in CI) fails on outside addresses, inline scripts, source maps or a weakened CSP. The CSP lives in `vite.config.ts`; when sync is added, only the project's own Supabase URL goes into `connect-src`.
- Every new stored field goes into the data inventory (§3). No gender data or gendered roles. No personal data in logs.
- Backups: `src/engine/backup.ts`. Export never includes the PIN; restore goes through the sanitizer. A new stored field must be added to the sanitizer and its test, or it will be dropped on restore.
- Install scripts are off (`.npmrc` `ignore-scripts=true`). After `npm ci` on a PC, the Supabase CLI needs `npm rebuild supabase --ignore-scripts=false` once.
- CI (`.github/workflows/deploy.yml`): actions pinned to commit SHAs with the tag in a comment; `permissions: {}` at the top, grants per job; `npm audit --audit-level=high` blocks deploys. Node 22 (vitest 5 needs it).
- Rare generator bugs: `GEN_RUNS=20000 npx vitest run -t "topic generators"` before adding or changing a math generator.

## Design system link
The app's look comes from the Claude Design System **"לומדים חשבון"**:
https://claude.ai/artifact/Qvrx5Ub9qf1yNzunq1ma7G

- `design/tokens.json` mirrors the system's `project/tokens.json`. `npm run design:tokens` generates `src/design-tokens.css` (never edit that by hand) and `design/bundle.css` (= `src/styles.css` + the Google Fonts import, the system's `project/components/bundle.css`).
- **Pull design → code** (when the user changed the design): read the artifact's `project/README.md` and `project/tokens.json` (and any component README/preview that changed). Copy tokens.json into `design/tokens.json` (drop the `meta` key or keep it), run `npm run design:tokens`, then update `src/styles.css` / components for changed component guidelines or previews. Check in the browser.
- **Push code → design** (after changing styles or tokens in code): run `npm run design:tokens`, then publish the changed files (`project/tokens.json`, `project/components/bundle.css`, component READMEs/previews) to the artifact, following its type instructions (index `project/design-system.json` last, with an updated `lastChange`).
- Every colour, radius and the font in `src/styles.css` and `src/components/Visual.tsx` should be a `var(--token)` from the system; don't add new hard-coded colours.
- **Themes:** 4 color themes (`analytical` default, `endurance`, `darkfocus`, `detail`), from the user's palettes. Each child picks one in their profile (`Profile.theme`, picker in `ProfileForm`, applied by `applyTheme` in `src/themes.ts` via `data-theme`). Theme ids and swatches are read from `design/tokens.json`; Hebrew names live in `src/themes.ts`.
- `npm run design:tokens` fails if any theme breaks a contrast rule. Use text-on-accent `--on-accent`, and accent-as-text `--accent-text`, never raw `--accent` for text.
