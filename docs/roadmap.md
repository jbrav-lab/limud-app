# Roadmap

## The suite: one app, many curricula
Decided 2026-11-12: one app (not one app per subject) for grades 2 and 5 and subjects such as math, Hebrew, English and מורשת. The structure is shared: profiles, lessons, practice, tests, rewards, parent area, themes and the design system. Content comes in per-subject packs.

- **Done:**
  - curriculum registry with lazy-loaded packs (`src/curricula/`), with grade-5 math as the first pack;
  - namespaced ids, with a data migration from version 1 → 2 that keeps all progress;
  - a grade on every profile;
  - a subject screen;
  - subject-aware test prep and parent report.
- **Done (2026-11-13):** grade 5 science & technology (`g5.science`): 14 topics in 5 units from the תשפ"ז content specification (`docs/curriculum-g5-science.md`), each with a lesson and an authored question bank. New answer types: multiple selection, ordering, matching. Question-bank engine: `src/engine/bank.ts`.
- **Done (2026-11-13):** the first language packs.
  - grade 5 Hebrew language (`g5.hebrew`, שפה ולשון): 12 topics in 3 units, from the required achievements for grades 5–6 (`docs/curriculum-g5-hebrew.md`);
  - grade 5 English (`g5.english`): 13 topics in 3 units, from the English Curriculum 2020: Foundation level, Band I and the grade 5 grammar table (`docs/curriculum-g5-english.md`);
  - a new answer type, **typed word** (`text`), with accepted variants, compared without case, niqqud or end punctuation;
  - per-pack text direction: English content reads left to right (`dirClass`, `.dir-auto`);
  - reading passages are written into the prompt of each question.
- **Done (2026-11-13):** a child can change their own avatar from the top bar (tap the avatar). New avatars: dog 🐶 and owl 🦉.
- **Curriculum downloaded, packs not built yet:** grade 4 math (`docs/curriculum-g4-math.md`), science (`docs/curriculum-g4-science.md`) and Hebrew language (`docs/curriculum-g4-hebrew.md`). Building them also means adding grade 4 to `GRADES` in `src/curricula/index.ts`.
- **Next:**
  1. **More answer types:** fill-the-gap inside a sentence, and one shared reading passage shown above several questions (today each question repeats its passage). Audio (listening) questions for English.
  2. **Grade 2 adaptations.** A grade profile in the design system: larger type and tap targets, read-aloud (text-to-speech) on by default, shorter sessions. Grade 2 follows the *new* Ministry curriculum.
  3. **More packs.** Each is mainly content: a curriculum mapping doc, topics and question banks.

The current app is a **trial run**. Progress lives only on each child's phone (browser storage), with manual backup/restore in the parent area.

## Planned for the final version (not started)
Waiting on a paid GitHub account, so the project and data can be kept private.

**Server-side tracking plan (Supabase): [docs/sync-supabase-plan.md](sync-supabase-plan.md).** Plan only, not deployed. It covers items 1, 2 and 6 below: parent sign-in, a family with linked devices, an offline-first sync with merge rules, Row Level Security, and the build order.

1. **Migrate scores.** Move each child's progress (practice stats, test results, stars, mistakes) between devices and app versions without manual backup files.
2. **Parent tracking from the parent's own device.** The parent UI shows each child's progress and test scores remotely, not only on the child's phone.

## Planned features (not started)
3. **Parent-defined tests.** In the parent area, a parent builds a test for a child: topics, difficulty and number of questions. The child sees it waiting on the home screen. This reuses the test-prep engine (`src/engine/exam.ts`, `ExamConfig`).
4. **"I don't know this" (לא יודע/ת את זה) in tests.** The child marks a question as unknown instead of guessing. It scores 0 like a blank, but is listed for later learning: practice it again and show it to the parent.
5. **"I don't understand the question" (לא מבין/ה את השאלה) in tests.** The child asks for help with the wording. They get a tip (rephrasing or a hint) without being given the answer, and the parent sees which questions were unclear.

6. **Parent notified when a test is completed.** When a child finishes a test, the parent gets an in-app notification on their own device: the child's name, score, verbal grade, topics and date, with a link to that test's review. Unseen results stay highlighted until opened. This depends on the sync backend (items 1–2), because the parent area must run on the parent's device. Optionally add a phone push notification on top.

## Planned fixes
- **Hebrew review.** Go over all Hebrew text (prompts, lessons, hints, solutions, buttons) for standard spelling and grammar, and fix translation errors.
- **Mixed number → fraction greater than 1** (מעבר ממספר מעורב לשבר גדול מ-1): the answer should not show the whole-number (שלם) box. The answer is a single fraction. Cause: `AnswerInput` shows the whole box whenever the answer is greater than 1 (`answer.num > answer.den`); it should only show it when the question asks for a mixed number (`form: 'mixed'` or `allowWhole`).

## Design notes for when we build it
- **A paid GitHub plan makes the *code* private, but it doesn't store or sync any data.** GitHub Pages only serves files; it has no database or logins. Even from a private repo, a Pages site is reachable by anyone with the address on regular paid plans. Private access control needs GitHub Enterprise Cloud.
- So syncing needs a small **data backend with sign-in**, for example Supabase, Firebase, or a tiny API. A family account and per-child records would be private to the parent, and the phone would sync when online and keep working offline.
- **Already in place to build on:**
  - The whole state is one versioned JSON document (`AppData`, now `version: 2`, in `src/engine/store.ts`).
  - Backup export/import already moves it between devices by hand.
  - Test results are stored as records (`ExamRecord`) with dates and scores.
- When this starts: follow [docs/sync-supabase-plan.md](sync-supabase-plan.md). It begins with data version 3: stable record ids, `updatedAt` timestamps and per-device counters for merging.
