import { describe, expect, it, vi } from 'vitest';
import { PIN_RESET_WINDOW_S, inviteMessage, signedInSecondsAgo } from './family';

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = (claims: object) => `${b64({ alg: 'ES256' })}.${b64(claims)}.sig`;
const now = Date.UTC(2026, 10, 19, 12, 0, 0);
const at = (secondsAgo: number) => Math.round(now / 1000) - secondsAgo;

describe('PIN reset: a fresh Google sign-in only', () => {
  it('reads how long ago the parent signed in with Google', () => {
    expect(signedInSecondsAgo(token({ amr: [{ method: 'oauth', timestamp: at(90) }] }), now)).toBe(90);
  });

  it('an older sign-in, a renewed session or a device sign-in does not count', () => {
    const old = signedInSecondsAgo(token({ amr: [{ method: 'oauth', timestamp: at(3 * 3600) }] }), now)!;
    expect(old).toBeGreaterThan(PIN_RESET_WINDOW_S);
    expect(signedInSecondsAgo(token({ amr: [{ method: 'anonymous', timestamp: at(5) }], is_anonymous: true }), now)).toBeNull();
    expect(signedInSecondsAgo(token({ amr: [{ method: 'password', timestamp: at(5) }] }), now)).toBeNull();
    expect(signedInSecondsAgo('not-a-token', now)).toBeNull();
  });
});

describe('invite message', () => {
  it('names the Google account and the steps, and never claims an email was sent', () => {
    vi.stubGlobal('location', { origin: 'https://limud-app.lomdim.workers.dev', pathname: '/' });
    const m = inviteMessage(' dana@gmail.com ', false);
    expect(m).toContain('dana@gmail.com');
    expect(m).toContain('https://limud-app.lomdim.workers.dev/');
    expect(m).toContain('התחברות עם Google');
    expect(m).toContain('7 ימים');
    expect(inviteMessage('x@gmail.com', true)).toContain('צרו את המשפחה');
  });
});
