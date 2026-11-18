import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The connection to the family server (Supabase). Off unless the build has VITE_SYNC_URL and
 * VITE_SYNC_KEY (the kill switch; vite.config.ts allows only the project's own address).
 *
 * Two sign-ins live side by side (family-view-design.md, "Devices"):
 * - the device: an anonymous sign-in that holds this phone's pairing with a family (permanent);
 * - a parent: a Google sign-in, used only in the parent area.
 * They are stored under different keys, so a parent signing in on a child's tablet never unpairs it.
 * The library is loaded only when sync is on and used.
 */

export const SYNC_URL: string = import.meta.env.VITE_SYNC_URL ?? '';
const SYNC_KEY: string = import.meta.env.VITE_SYNC_KEY ?? '';
export const syncEnabled = (): boolean => Boolean(SYNC_URL && SYNC_KEY);

/** Storage keys of the two sign-ins (data inventory, security file §3). */
export const PARENT_AUTH_KEY = 'limud-parent-auth';
export const DEVICE_AUTH_KEY = 'limud-device-auth';

let parent: Promise<SupabaseClient> | null = null;
let device: Promise<SupabaseClient> | null = null;

async function make(storageKey: string, isParent: boolean): Promise<SupabaseClient> {
  if (!syncEnabled()) throw new Error('sync is off');
  const { createClient } = await import('@supabase/supabase-js');
  return createClient(SYNC_URL, SYNC_KEY, {
    auth: {
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      flowType: 'pkce',
      // Only the parent sign-in comes back from Google with a code in the address.
      detectSessionInUrl: isParent,
    },
  });
}

export const parentClient = () => (parent ??= make(PARENT_AUTH_KEY, true));
export const deviceClient = () => (device ??= make(DEVICE_AUTH_KEY, false));
