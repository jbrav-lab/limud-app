// The one sync server the app may ever talk to: the project's own Supabase address (go-live plan).
// vite.config.ts puts it in the CSP connect-src when the build has VITE_SYNC_URL, and refuses any other
// address; scripts/check-dist.mjs allows it and nothing else.
export const SYNC_ORIGIN = 'https://adwtnunulufninshravy.supabase.co';
