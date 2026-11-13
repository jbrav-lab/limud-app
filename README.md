# לומדים – Learning app

A Hebrew (RTL) learning app for kids that follows the Israeli Ministry of Education (ממלכתי) curriculum.
Grade 5 subjects: math ([map](docs/curriculum-grade5.md)), science & technology ([map](docs/curriculum-g5-science.md)), Hebrew language ([map](docs/curriculum-g5-hebrew.md)) and English ([map](docs/curriculum-g5-english.md)). Grade 4 curricula are mapped in `docs/curriculum-g4-*.md`. Plans: [docs/roadmap.md](docs/roadmap.md).

Built as a web app (React + TypeScript + Vite) that works offline (PWA). It can be wrapped as an Android APK with Capacitor later.

## What's inside
- **19 topics** in 5 units (fractions, decimals, natural-number operations, data/average, geometry and area), each with a short visual lesson and an endless exercise generator at 3 difficulty levels.
- **Adaptive difficulty:** 3 first-try correct answers in a row → next level; 2 misses in a row → easier level.
- **Feedback:** a hint after the first wrong answer and a step-by-step solution after the second. Equivalent answers are accepted (2/4 = 1/2) unless the question asks to reduce or to write a mixed number.
- **Game elements:** stars, daily streak, badges, 0–3 mastery stars per topic, confetti at the end of a session.
- **Test prep (הכנה למבחן):** the child picks topics, a difficulty (easy / medium / hard / adapted to their level) and 5–25 questions, then takes a simulated test with no hints. It's graded out of 100 with the Israeli verbal grade, plus a per-topic breakdown and a review of every question with its solution (`src/engine/exam.ts`, `src/screens/Exam*.tsx`).
- **Profiles** for several kids on one device, each with their own color theme.
- **Parent area** (4-digit PIN): accuracy per topic, weak topics, 7-day activity, recent mistakes with the child's answer, and backup/restore.

Progress is stored in the device's browser storage (`localStorage`). Use the parent area's backup button now and then.

## Commands
```bash
npm install
npm run dev        # dev server (also reachable from the phone on the same Wi-Fi)
npm test           # runs every exercise generator 400× per level and checks the answers
npm run build      # production build into dist/
```
`http://localhost:5173/?gallery` (dev only) shows every diagram type, for checking visuals.

## Live app
**https://jbrav-lab.github.io/limud-app/**: published from https://github.com/jbrav-lab/limud-app by `.github/workflows/deploy.yml` on every push to `main`. The workflow runs the tests first, so a failing test blocks the deploy. Installed phones pick up the new version the next time the app is opened while online.

## Getting it onto the phone
1. **Quick try (same Wi-Fi):** run `npm run dev`, then open `http://<PC-IP>:5173` in Chrome on the phone. This works, but it needs the PC running and doesn't work offline.
2. **Installable offline app:** put `dist/` on any free HTTPS host (GitHub Pages, Netlify, Cloudflare Pages). In Chrome on the phone, use ⋮ → "Install app". The app then works fully offline.
3. **Real APK:** install Android Studio, then add Capacitor (`@capacitor/android`) and build an APK from `dist/`.

## Design
The look is defined in a Claude Design System: https://claude.ai/artifact/Qvrx5Ub9qf1yNzunq1ma7G (colors, type, spacing, component previews, brand rules).
`design/tokens.json` is its local mirror. `npm run design:tokens` regenerates `src/design-tokens.css`, which every screen uses.
To change the look, edit it in the design system and ask Claude to pull it into the code (see CLAUDE.md).

## Adding content
Subjects are packs in `src/curricula/g<grade>/<subject>/` (see CLAUDE.md). Math topics have a `generate(level)` function; other subjects use authored question banks (`src/engine/bank.ts`).
Text markup: `{3/4}` is a fraction, `{2 3/4}` a mixed number, `[[...]]` left-to-right math inside Hebrew text, and `**bold**`.
A new grade or subject is a new pack registered in `src/curricula/index.ts`.
