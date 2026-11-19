import type { Profile } from '../engine/store';
import { deviceClient, parentClient } from './client';

/**
 * Parent and device actions against the family server. Every call goes to a server function that checks
 * the caller itself (supabase/migrations/…0400_api.sql); this file only shapes inputs and errors.
 */

/** Version of the privacy notice the parent agreed to (recorded with record_consent). */
export const NOTICE_VERSION = '2026-11-18';

export type Family = { family_id: string; name: string; role: 'primary' | 'parent'; member_id: string };
export type ServerChild = { id: string; name: string; avatar: string; grade: number; theme: string | null; deleted_at: string | null };
export type Device = { id: string; label: string | null; linked_at: string; last_seen_on: string | null; revoked_at: string | null };

/** A short Hebrew message for an error, never the server's text (generic errors, OWASP A10). */
export class SyncError extends Error {}
function explain(e: { code?: string; message?: string } | null): never {
  const code = e?.code ?? '';
  const msg =
    code === '42501'
      ? 'אין הרשאה לפעולה הזאת.'
      : code === '22023'
        ? 'אחד הפרטים לא תקין.'
        : code === '54000'
          ? 'יותר מדי ניסיונות. נסו שוב בעוד שעה.'
          : 'משהו השתבש. בדקו את החיבור לאינטרנט ונסו שוב.';
  throw new SyncError(msg);
}

async function rpc<T>(fn: string, args: Record<string, unknown> = {}, as: 'parent' | 'device' = 'parent'): Promise<T> {
  const c = await (as === 'parent' ? parentClient() : deviceClient());
  const { data, error } = await c.rpc(fn, args);
  if (error) explain(error);
  return data as T;
}

// --- Parent sign-in -----------------------------------------------------------------------------

const AFTER_SIGNIN = 'limud-after-signin';

/** Start Google sign-in. The browser leaves the app and comes back to the parent area. */
export async function signInWithGoogle() {
  const c = await parentClient();
  try {
    sessionStorage.setItem(AFTER_SIGNIN, 'parent');
  } catch {
    /* ignore */
  }
  const { error } = await c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: 'select_account' } },
  });
  if (error) explain(error);
}

/** True once, right after coming back from Google sign-in (the app opens the parent area). */
export function cameBackFromSignIn(): boolean {
  try {
    const v = sessionStorage.getItem(AFTER_SIGNIN) === 'parent';
    sessionStorage.removeItem(AFTER_SIGNIN);
    return v;
  } catch {
    return false;
  }
}

/**
 * A refused sign-in comes back with ?error=… in the address (for example an uninvited Google account,
 * refused by the "before user created" hook). Read it once and clean the address.
 */
export function takeSignInError(): string | null {
  try {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams(location.hash.slice(1));
    const err = q.get('error') ?? h.get('error');
    if (!err) return null;
    history.replaceState(history.state, '', location.pathname);
    return 'החשבון הזה לא הוזמן ללומדים. בקשו הזמנה מהורה שכבר מחובר, או התחברו עם החשבון שהוזמן.';
  } catch {
    return null;
  }
}

/** The signed-in parent's Google email, or null. Shown only to that parent, never stored by the app. */
export async function parentEmail(): Promise<string | null> {
  const c = await parentClient();
  const { data } = await c.auth.getSession();
  const s = data.session;
  if (!s || s.user.is_anonymous) return null;
  return s.user.email ?? null;
}

export async function signOut(everywhere = false) {
  const c = await parentClient();
  await c.auth.signOut({ scope: everywhere ? 'global' : 'local' });
}

// --- Families -----------------------------------------------------------------------------------

/** Join every family that invited this parent, then list the parent's families. */
export async function loadFamilies(): Promise<{ families: Family[]; joined: string[] }> {
  const joined = (await rpc<string[] | null>('accept_invites')) ?? [];
  const families = (await rpc<Family[] | null>('my_families')) ?? [];
  for (const f of joined) await rpc('record_consent', { p_family: f, p_notice_version: NOTICE_VERSION });
  return { families, joined };
}

export async function createFamily(name: string): Promise<string> {
  const id = await rpc<string>('create_family', { p_name: name });
  await rpc('record_consent', { p_family: id, p_notice_version: NOTICE_VERSION });
  return id;
}

const cleanEmail = (email: string) => {
  const e = email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 254) throw new SyncError('כתובת האימייל לא תקינה.');
  return e;
};

/** The primary parent invites another parent. Only an HMAC of the address is stored. */
export const inviteParent = (family: string, email: string) => rpc('invite_parent', { p_family: family, p_email: cleanEmail(email) });

/** The admin invites the primary parent of a new family. */
export const invitePrimary = (email: string) => rpc('invite_primary', { p_email: cleanEmail(email) });

// --- Children -----------------------------------------------------------------------------------

export const familyChildren = (family: string) => rpc<ServerChild[]>('family_children', { p_family: family });

/** Add (or update) this device's children in the family. Each keeps its id, so devices can merge later. */
export async function shareChildren(family: string, profiles: Profile[]) {
  for (const p of profiles) {
    await rpc('upsert_child', {
      p_id: p.id,
      p_family: family,
      p_name: p.name,
      p_avatar: p.avatar,
      p_grade: p.grade,
      p_theme: p.theme ?? null,
      p_updated_at: new Date(p.updatedAt || p.createdAt || Date.now()).toISOString(),
    });
  }
}

// --- Devices ------------------------------------------------------------------------------------

export const familyDevices = (family: string) => rpc<Device[]>('family_devices', { p_family: family });

/** A one-time pairing code for a child's phone (valid 15 minutes). */
export const createPairing = (family: string, label: string, children: string[]) =>
  rpc<string>('create_device_pairing', { p_family: family, p_label: label.trim() || null, p_children: children });

export const revokeDevice = (device: string) => rpc('revoke_device', { p_device: device });

/** On the child's phone: sign the device in anonymously (once) and redeem the code. */
export async function pairThisDevice(code: string, deviceId: string): Promise<boolean> {
  const c = await deviceClient();
  const { data } = await c.auth.getSession();
  if (!data.session) {
    const { error } = await c.auth.signInAnonymously();
    if (error) explain(error);
  }
  const fam = await rpc<string | null>('redeem_device_pairing', { p_code: code.replace(/[\s-]/g, '').toUpperCase(), p_device: deviceId }, 'device');
  return Boolean(fam);
}

/** The children this device may practise as, if it is paired (else an empty list). */
export async function pairedChildren(): Promise<{ id: string; name: string }[] | null> {
  const c = await deviceClient();
  const { data } = await c.auth.getSession();
  if (!data.session) return null;
  return rpc<{ id: string; name: string }[]>('device_children_list', {}, 'device');
}

// --- Status (so a parent can see that an action worked) -----------------------------------------

/** Whether the signed-in parent is the app's admin, and when their pending new-family invites expire. */
export async function adminStatus(): Promise<{ isAdmin: boolean; primaryInvites: string[] }> {
  const rows = await rpc<{ is_admin: boolean; primary_invites_expiring: string[] }[]>('my_admin_status');
  return { isAdmin: Boolean(rows?.[0]?.is_admin), primaryInvites: rows?.[0]?.primary_invites_expiring ?? [] };
}

/** The family's pending parent invites (no addresses: the server keeps only an HMAC). */
export async function pendingInvites(family: string): Promise<{ expires_at: string }[]> {
  const c = await parentClient();
  const { data, error } = await c.from('invites').select('expires_at').eq('family_id', family).gt('expires_at', new Date().toISOString());
  if (error) explain(error);
  return (data ?? []) as { expires_at: string }[];
}

/** The message a parent sends the person they invited (the app sends no email; Google-only sign-in). */
export function inviteMessage(email: string, newFamily: boolean): string {
  const where = `${location.origin}${location.pathname}`;
  const then = newFamily ? 'ואז צרו את המשפחה שלכם.' : 'ותצטרפו למשפחה אוטומטית.';
  return `הוזמנתם ל„לומדים”. פתחו את ${where} ← 🔒 אזור הורים ← ⚙️ הגדרות ← „התחברות עם Google”, עם החשבון ${email.trim()}, ${then} ההזמנה בתוקף 7 ימים.`;
}
