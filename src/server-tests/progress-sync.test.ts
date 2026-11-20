// Stage 4 upload (src/sync/progress.ts): the SQL the API generates for each upload, run as the paired
// device, twice (an upload is repeated freely), then read back by a parent. No new tables or grants.
import { beforeAll, describe, expect, it } from 'vitest';
import { BOOT_TIMEOUT, denied, uuid } from './db';
import { buildWorld, type World } from './fixtures';
import { toRows } from '../sync/progress';
import { today } from '../engine/store';

let w: World;
beforeAll(async () => {
  w = await buildWorld();
}, BOOT_TIMEOUT);

/** What the API runs for supabase-js `upsert(rows, { onConflict })` (and `ignoreDuplicates: true`). */
function upsertSql(table: string, rows: Record<string, unknown>[], conflict: string, ignore = false) {
  const cols = Object.keys(rows[0]);
  const params: unknown[] = [];
  const values = rows.map((r) => `(${cols.map((c) => (params.push(r[c]), `$${params.length}`)).join(', ')})`).join(', ');
  const action = ignore ? 'do nothing' : `do update set ${cols.map((c) => `${c} = excluded.${c}`).join(', ')}`;
  return { sql: `insert into public.${table} (${cols.join(', ')}) values ${values} on conflict (${conflict}) ${action}`, params };
}

describe('progress upload from a paired device (Stage 4)', () => {
  it('uploads its own child, repeats safely, never lowers anything, and parents read it', async () => {
    const { db, A } = w;
    const now = Date.now();
    const day = today(new Date(now - 3 * 86_400_000)); // a day the fixture has no activity on
    const rows = toRows(
      {
        byDevice: { [A.deviceId]: { stars: 40, sessions: 9, daily: { [day]: 17 } } },
        topics: {
          'g5.math.fractions': { level: 2, runCorrect: 2, runWrong: 0, attempts: 25, firstTry: 18, secondTry: 3, byLevel: [10, 8, 0], lastAt: now, updatedAt: now },
        },
        mistakes: [{ id: uuid(), at: now, topicId: 'g5.math.fractions', prompt: 'כמה זה חצי (1/2) ועוד רבע (1/4)?', given: '2/6', correct: '3/4' }],
        exams: [{ id: uuid(), at: now, topicIds: ['g5.math.fractions'], packId: 'g5.math', difficulty: 'medium', questions: 10, correct: 9, score: 90 }],
      },
      A.child1,
      A.id,
      A.deviceId,
      now,
    );
    const steps = [
      upsertSql('child_device_totals', [rows.totals], 'child_id, device_id'),
      upsertSql('daily_activity', rows.daily, 'child_id, device_id, day'),
      upsertSql('topic_progress', rows.topics, 'child_id, topic_id'),
      upsertSql('exam_results', rows.exams, 'id', true),
      upsertSql('mistakes', rows.mistakes, 'id', true),
    ];
    for (let i = 0; i < 2; i++) for (const s of steps) await db.as(A.device, s.sql, s.params);

    const [t] = await db.as(A.primary, `select stars, sessions from public.child_device_totals where child_id = $1 and device_id = $2`, [A.child1, A.deviceId]);
    expect(t).toEqual({ stars: 40, sessions: 9 });
    expect(await db.as(A.parent, `select answered from public.daily_activity where child_id = $1 and day = $2`, [A.child1, day])).toEqual([{ answered: 17 }]);
    expect(await db.as(A.parent, `select attempts, level from public.topic_progress where child_id = $1 and topic_id = 'g5.math.fractions'`, [A.child1])).toEqual([{ attempts: 25, level: 2 }]);
    expect(await db.as(A.parent, `select score from public.exam_results where id = $1`, [rows.exams[0].id])).toEqual([{ score: 90 }]);
    expect(await db.as(A.parent, `select given from public.mistakes where id = $1`, [rows.mistakes[0].id])).toEqual([{ given: '2/6' }]);

    // An older copy uploaded later (for example from a restored backup) lowers nothing.
    const old = upsertSql('child_device_totals', [{ ...rows.totals, stars: 5, sessions: 1 }], 'child_id, device_id');
    await db.as(A.device, old.sql, old.params);
    expect(await db.as(A.primary, `select stars from public.child_device_totals where child_id = $1 and device_id = $2`, [A.child1, A.deviceId])).toEqual([{ stars: 40 }]);

    // The other family sees none of it.
    expect(await db.as(w.B.primary, `select 1 from public.daily_activity where child_id = $1`, [A.child1])).toEqual([]);
  });

  it('refuses a child the device is not paired with, and another family', async () => {
    const { db, A, B } = w;
    const r = toRows({ byDevice: { [A.deviceId]: { stars: 1, sessions: 1, daily: { [today()]: 1 } } }, topics: {}, mistakes: [] }, A.child2, A.id, A.deviceId);
    const s = upsertSql('daily_activity', r.daily, 'child_id, device_id, day');
    await denied(db.as(A.device, s.sql, s.params));
    const r2 = toRows({ byDevice: { [A.deviceId]: { stars: 1, sessions: 1, daily: {} } }, topics: {}, mistakes: [] }, B.child1, B.id, A.deviceId);
    const s2 = upsertSql('child_device_totals', [r2.totals], 'child_id, device_id');
    await denied(db.as(A.device, s2.sql, s2.params));
  });
});
