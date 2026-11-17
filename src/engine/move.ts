import { backupJson, readBackup } from './backup';
import { actions, getData } from './store';

/**
 * Moving to the new address (go-live plan, "Hosting move").
 *
 * Browser storage belongs to an origin, so the old address (GitHub Pages) hands this device's progress
 * to the new one (Cloudflare) once, browser to browser, with no file:
 * 1. On the old address, a parent or child taps "move": the old page opens the new address in a new tab.
 * 2. The new page, opened by the old one, says it is ready (postMessage to the old origin only).
 * 3. The old page sends the progress as backup text (no PIN) to that window, for the new origin only.
 * 4. The new page checks where it came from, validates it like a backup file and merges it in.
 *
 * Nothing goes through a server or a URL. Each side accepts messages only from the other's exact origin
 * and window, and sends only to the other's exact origin.
 */

export const OLD_ORIGIN = 'https://jbrav-lab.github.io';
export const NEW_ORIGIN = 'https://limud-app.lomdim.workers.dev';
export const NEW_URL = `${NEW_ORIGIN}/`;
const HANDOFF = '#from-old-address';

type Msg = { type: 'limud-ready' } | { type: 'limud-handoff'; text: string } | { type: 'limud-done'; ok: boolean };
type Event = { origin: string; source: unknown; data: unknown };

const isMsg = (x: unknown): x is Msg => {
  if (!x || typeof x !== 'object') return false;
  const m = x as Record<string, unknown>;
  if (m.type === 'limud-ready') return true;
  if (m.type === 'limud-handoff') return typeof m.text === 'string';
  if (m.type === 'limud-done') return typeof m.ok === 'boolean';
  return false;
};

/** The old page accepts only "ready" and "done" from the window it opened, at the new origin. */
export function fromNewSite(e: Event, opened: unknown): Msg | null {
  if (e.origin !== NEW_ORIGIN || !opened || e.source !== opened || !isMsg(e.data)) return null;
  return e.data.type === 'limud-handoff' ? null : e.data;
}

/** The new page accepts the handoff only from the window that opened it, at the old origin. */
export function fromOldSite(e: Event, opener: unknown): string | null {
  if (e.origin !== OLD_ORIGIN || !opener || e.source !== opener || !isMsg(e.data)) return null;
  return e.data.type === 'limud-handoff' ? e.data.text : null;
}

export const isOldAddress = () => {
  try {
    return location.origin === OLD_ORIGIN;
  } catch {
    return false;
  }
};

/** Old address: open the new one and hand over this device's progress. Resolves when the new page confirms. */
export function sendToNewAddress(timeoutMs = 20000): Promise<'done' | 'failed' | 'blocked'> {
  const w = window.open(NEW_URL + HANDOFF, '_blank');
  if (!w) return Promise.resolve('blocked');
  return new Promise((resolve) => {
    const finish = (r: 'done' | 'failed') => {
      removeEventListener('message', onMsg);
      clearTimeout(timer);
      resolve(r);
    };
    const onMsg = (e: MessageEvent) => {
      const m = fromNewSite(e, w);
      if (!m) return;
      if (m.type === 'limud-ready') w.postMessage({ type: 'limud-handoff', text: backupJson(getData()) } satisfies Msg, NEW_ORIGIN);
      else if (m.type === 'limud-done') finish(m.ok ? 'done' : 'failed');
    };
    const timer = setTimeout(() => finish('failed'), timeoutMs);
    addEventListener('message', onMsg);
  });
}

/** What the new page reports after a handoff (shown once). */
let received: 'merged' | 'failed' | null = null;
export const handoffResult = () => received;

/** New address: if the old address opened this page to hand over progress, receive and merge it. */
export function receiveFromOldAddress(onDone: () => void) {
  try {
    if (location.origin !== NEW_ORIGIN || location.hash !== HANDOFF) return;
    history.replaceState(history.state, '', location.pathname + location.search);
    if (!window.opener) {
      // Opened in the same tab, or by a browser that cuts the link back (some home-screen apps).
      received = 'failed';
      onDone();
      return;
    }
    const opener = window.opener as Window;
    const onMsg = (e: MessageEvent) => {
      const text = fromOldSite(e, opener);
      if (text === null) return;
      removeEventListener('message', onMsg);
      let ok = false;
      try {
        const { data, merge } = readBackup(text);
        actions.restoreBackup(data, merge);
        ok = true;
      } catch {
        ok = false;
      }
      received = ok ? 'merged' : 'failed';
      opener.postMessage({ type: 'limud-done', ok } satisfies Msg, OLD_ORIGIN);
      onDone();
    };
    addEventListener('message', onMsg);
    opener.postMessage({ type: 'limud-ready' } satisfies Msg, OLD_ORIGIN);
  } catch {
    /* no opener access: the parent can still use a backup file */
  }
}
