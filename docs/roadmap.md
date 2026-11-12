# Roadmap

The current app is a **trial run**. Progress lives only on each child's phone (browser storage), with manual backup/restore in the parent area.

## Planned for the final version (not started)
Waiting on a paid GitHub account, so the project and data can be kept private.

1. **Migrate scores.** Move each child's progress (practice stats, test results, stars, mistakes) between devices and app versions without manual backup files.
2. **Parent tracking from the parent's own device.** The parent UI shows each child's progress and test scores remotely, not only on the child's phone.

## Design notes for when we build it
- **A paid GitHub plan makes the *code* private, but it doesn't store or sync any data.** GitHub Pages only serves files; it has no database or logins. Even from a private repo, a Pages site is reachable by anyone with the address on regular paid plans. Private access control needs GitHub Enterprise Cloud.
- So syncing needs a small **data backend with sign-in**, for example Supabase, Firebase, or a tiny API. A family account and per-child records would be private to the parent, and the phone would sync when online and keep working offline.
- **Already in place to build on:**
  - The whole state is one versioned JSON document (`AppData`, `version: 1`, in `src/engine/store.ts`).
  - Backup export/import already moves it between devices by hand.
  - Test results are stored as records (`ExamRecord`) with dates and scores.
- When this starts: add stable record ids and `updatedAt` timestamps for merging, a migration from `version: 1`, and sign-in in the parent area.
