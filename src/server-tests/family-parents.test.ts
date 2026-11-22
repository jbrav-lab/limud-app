// The family's parents list (supabase/migrations/20261122000100_family_parents.sql): every parent of a
// family sees the family's parents with their Google addresses and the day each last used the app.
// The address comes only from the caller's own sign-in token, and is stored encrypted.
import { beforeAll, describe, expect, it } from 'vitest';
import { BOOT_TIMEOUT, denied } from './db';
import { buildWorld, type World } from './fixtures';

let w: World;
beforeAll(async () => {
  w = await buildWorld();
}, BOOT_TIMEOUT);

type Row = { member_id: string; role: string; email: string | null; last_seen_on: string | null; is_me: boolean };
const list = (who: World['A']['parent'], family: string) =>
  w.db.as<Row>(who, `select member_id, role, email, last_seen_on::text, is_me from public.family_parents($1)`, [family]);

describe('family parents: addresses and last use', () => {
  it('every parent of the family sees both parents, primary first, with lower-cased addresses', async () => {
    const { A } = w;
    const [today] = await w.db.owner<{ d: string }>(`select current_date::text as d`);
    for (const who of [A.primary, A.parent]) {
      const rows = await list(who, A.id);
      expect(rows.map((r) => [r.member_id, r.role, r.email, r.last_seen_on])).toEqual([
        [A.primaryMember, 'primary', 'primary.a@example.org', today.d],
        [A.parentMember, 'parent', 'parent.a@example.org', today.d],
      ]);
      expect(rows.filter((r) => r.is_me).map((r) => r.member_id)).toEqual([who === A.primary ? A.primaryMember : A.parentMember]);
    }
  });

  it('other families, devices, strangers and signed-out callers are refused', async () => {
    const { A, B } = w;
    await denied(list(B.primary, A.id));
    await denied(list(A.device, A.id));
    await denied(list(w.stranger, A.id));
    await denied(w.db.as(null, `select * from public.family_parents($1)`, [A.id]));
    await denied(w.db.as(A.device, `select public.parent_seen()`));
    await denied(w.db.as(null, `select public.parent_seen()`));
  });

  it('parent_seen touches only the caller’s own rows, and the columns are not readable directly', async () => {
    const { A, B, db } = w;
    await db.owner(`update public.family_members set last_seen_on = null where family_id in ($1, $2)`, [A.id, B.id]);
    await db.as(A.parent, `select public.parent_seen()`);
    const seen = await db.owner<{ member_id: string }>(`select member_id from public.family_members where last_seen_on is not null`);
    expect(seen.map((r) => r.member_id)).toEqual([A.parentMember]);
    // A stranger (in no family) changes nothing.
    await db.as(w.stranger, `select public.parent_seen()`);
    expect((await db.owner(`select 1 from public.family_members where last_seen_on is not null`)).length).toBe(1);
    await denied(db.as(A.primary, `select email_enc from public.family_members`));
    await denied(db.as(A.primary, `select last_seen_on from public.family_members`));
    const [{ anon }] = await db.owner<{ anon: boolean }>(
      `select has_function_privilege('anon', 'public.family_parents(uuid)', 'execute') or has_function_privilege('anon', 'public.parent_seen()', 'execute') as anon`,
    );
    expect(anon).toBe(false);
  });
});
