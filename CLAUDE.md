# Project notes for Claude

Hebrew (RTL) grade-5 math learning app for the user's kids. React + TypeScript + Vite PWA. See README.md.

## Deploy
- Live at https://jbrav-lab.github.io/limud-app/ (GitHub Pages, public repo jbrav-lab/limud-app). Pushing to `main` deploys via `.github/workflows/deploy.yml` (npm ci → test → build → Pages).
- Commit as the repo's configured noreply author (never the user's real email). `git`/`gh` were installed with winget; in a fresh shell refresh PATH from the Machine+User environment first.
- Never change the site address (repo name or a custom domain) without warning the user: progress lives in the phone's browser storage for that address, so a new address starts every child from zero (backup/restore in the parent area moves it).

## Content rules
- **Word problems (story questions): every fraction appears in Hebrew words AND as a number**, e.g. "מאיה נתנה חצי (1/2) מן התפוחים שלה". Use `frBoth(n, d)` (or `frBoth(n, d, true)` for mixed numbers) from `src/engine/math.ts`. Whole numbers stay as digits. Word-problem prompts are marked with `wordProblem: true` on the question, and `topics.test.ts` checks the rule.

## Design system link
The app's look comes from the Claude Design System **"לומדים חשבון"**:
https://claude.ai/artifact/Qvrx5Ub9qf1yNzunq1ma7G

- `design/tokens.json` mirrors the system's `project/tokens.json`. `npm run design:tokens` generates `src/design-tokens.css` (never edit that by hand) and `design/bundle.css` (= `src/styles.css` + the Google Fonts import, the system's `project/components/bundle.css`).
- **Pull design → code** (when the user changed the design): read the artifact's `project/README.md` and `project/tokens.json` (and any component README/preview that changed). Copy tokens.json into `design/tokens.json` (drop the `meta` key or keep it), run `npm run design:tokens`, then update `src/styles.css` / components for changed component guidelines or previews. Check in the browser.
- **Push code → design** (after changing styles or tokens in code): run `npm run design:tokens`, then publish the changed files (`project/tokens.json`, `project/components/bundle.css`, component READMEs/previews) to the artifact, following its type instructions (index `project/design-system.json` last, with an updated `lastChange`).
- Every colour, radius and the font in `src/styles.css` and `src/components/Visual.tsx` should be a `var(--token)` from the system; don't add new hard-coded colours.
- **Themes:** 4 color themes (`analytical` default, `endurance`, `darkfocus`, `detail`), from the user's palettes. Each child picks one in their profile (`Profile.theme`, picker in `ProfileForm`, applied by `applyTheme` in `src/themes.ts` via `data-theme`). Theme ids and swatches are read from `design/tokens.json`; Hebrew names live in `src/themes.ts`.
- `npm run design:tokens` fails if any theme breaks a contrast rule. Use text-on-accent `--on-accent`, and accent-as-text `--accent-text`, never raw `--accent` for text.
