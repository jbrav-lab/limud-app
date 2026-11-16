#!/usr/bin/env node
// Stage 1: the real deletion flow on the live database, with two kept test families.
// Same environment as scripts/live-check.mjs (LIVE_DB_URL, LIVE_DB_CA).
//
//   node scripts/live-test-family.mjs create   builds TEST-A and TEST-B through the API and keeps them
//   node scripts/live-test-family.mjs delete   both parents of each family request and approve the
//                                              family's deletion (soft delete, as in the app)
//   node scripts/live-test-family.mjs status   how many test families exist, and how many are soft-deleted;
//                                              once none are left, removes the test parents' sign-in rows
//
// Run `delete` on day D; the nightly job erases them on D+2 (Israel date). Run `status` on D+3.
// Only rows marked as test data are touched: TEST-… family names and @example.invalid emails.
import { testFamilyCommand } from './live-check-core.mjs';
import { connect, fail } from './live-db.mjs';

async function main() {
  const cmd = process.argv[2];
  if (!['create', 'delete', 'status'].includes(cmd)) fail('usage: node scripts/live-test-family.mjs create|delete|status');
  const { q, end } = await connect();
  try {
    await q('begin');
    for (const line of await testFamilyCommand(q, cmd)) console.log(line);
    await q('commit');
  } catch (e) {
    await q('rollback');
    await end();
    fail(e.message);
  }
  await end();
}

main().catch((e) => fail(e.message));
