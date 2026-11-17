import { describe, expect, it } from 'vitest';
import { NEW_ORIGIN, OLD_ORIGIN, fromNewSite, fromOldSite } from './move';

const opened = { name: 'the window the old page opened' };
const opener = { name: 'the window that opened the new page' };
const someone = { name: 'another window' };

describe('moving to the new address: who may talk to whom', () => {
  it('the new page takes the handoff only from its opener, at the old origin', () => {
    const msg = { type: 'limud-handoff', text: '{"version":3}' };
    expect(fromOldSite({ origin: OLD_ORIGIN, source: opener, data: msg }, opener)).toBe('{"version":3}');
    expect(fromOldSite({ origin: 'https://evil.example', source: opener, data: msg }, opener)).toBeNull();
    expect(fromOldSite({ origin: 'https://jbrav-lab.github.io.evil.example', source: opener, data: msg }, opener)).toBeNull();
    expect(fromOldSite({ origin: OLD_ORIGIN, source: someone, data: msg }, opener)).toBeNull();
    expect(fromOldSite({ origin: OLD_ORIGIN, source: opener, data: msg }, null)).toBeNull();
    expect(fromOldSite({ origin: OLD_ORIGIN, source: opener, data: { type: 'limud-handoff', text: 5 } }, opener)).toBeNull();
    expect(fromOldSite({ origin: OLD_ORIGIN, source: opener, data: { type: 'limud-ready' } }, opener)).toBeNull();
  });

  it('the old page answers only the window it opened, at the new origin, and never takes a handoff', () => {
    const ready = { type: 'limud-ready' };
    expect(fromNewSite({ origin: NEW_ORIGIN, source: opened, data: ready }, opened)).toEqual(ready);
    expect(fromNewSite({ origin: NEW_ORIGIN, source: opened, data: { type: 'limud-done', ok: true } }, opened)).toEqual({ type: 'limud-done', ok: true });
    expect(fromNewSite({ origin: 'https://evil.example', source: opened, data: ready }, opened)).toBeNull();
    expect(fromNewSite({ origin: NEW_ORIGIN, source: someone, data: ready }, opened)).toBeNull();
    expect(fromNewSite({ origin: NEW_ORIGIN, source: opened, data: { type: 'limud-handoff', text: '{}' } }, opened)).toBeNull();
    expect(fromNewSite({ origin: NEW_ORIGIN, source: opened, data: 'limud-ready' }, opened)).toBeNull();
  });

  it('names exact https origins', () => {
    expect(OLD_ORIGIN).toBe('https://jbrav-lab.github.io');
    expect(NEW_ORIGIN).toBe('https://limud-app.lomdim.workers.dev');
  });
});
