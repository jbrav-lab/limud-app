// Dependency audit gate (CI and the Cloudflare build). Fails on any high or critical advisory, except the
// ones listed below: each has a reason, the owner's decision, and an expiry date after which it fails
// again. Evidence for docs/security-privacy.md (§1 "Dependency audit", §11 accepted risks).
import { execSync } from 'node:child_process';

/** Accepted advisories (owner's decision): GHSA id → why it can't hurt this app, and until when. */
const ACCEPTED = {
  'GHSA-fc5q-39xc-vjpf': {
    package: 'picomatch',
    why: 'ReDoS when compiling a crafted glob pattern. Only build tools use picomatch (vite, vitest, vite-plugin-pwa, workbox-build), and every pattern comes from this repository, never from a user. No fixed version exists yet (<=4.0.7).',
    decided: '2026-11-18',
    expires: '2026-12-18',
  },
};

let raw;
try {
  raw = execSync('npm audit --json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
} catch (e) {
  raw = e.stdout; // npm audit exits non-zero when it finds anything
}
const report = JSON.parse(raw);
const today = new Date().toISOString().slice(0, 10);
const blocking = new Set();
const accepted = new Set();

for (const v of Object.values(report.vulnerabilities ?? {})) {
  if (v.severity !== 'high' && v.severity !== 'critical') continue;
  // An object in `via` is an advisory; a string only means "vulnerable through that package",
  // which is blocking exactly when that package's own advisory is (checked on its own entry).
  for (const a of v.via.filter((x) => typeof x === 'object')) {
    const id = a.url?.match(/GHSA-[\w-]+/)?.[0];
    const rule = id ? ACCEPTED[id] : undefined;
    if (rule && rule.package === a.name && today <= rule.expires) accepted.add(id);
    else blocking.add(`${a.name} (${a.severity}): ${a.title} ${a.url ?? ''}`);
  }
}

for (const id of accepted) console.log(`audit: accepted ${id} (${ACCEPTED[id].package}) until ${ACCEPTED[id].expires}: ${ACCEPTED[id].why}`);
for (const [id, a] of Object.entries(ACCEPTED)) if (today > a.expires) console.log(`audit: the exception for ${id} expired on ${a.expires}; review it`);
if (blocking.size) {
  console.error(`audit: ${blocking.size} high or critical advisory(ies) block the deploy:\n- ${[...blocking].join('\n- ')}`);
  process.exit(1);
}
console.log('audit: OK (no high or critical advisories beyond the accepted list)');
