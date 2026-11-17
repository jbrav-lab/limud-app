// Security and privacy checks on the built app (dist/). Runs in CI after `npm run build`; any failure blocks the deploy.
// Evidence for docs/security-privacy.md: the shipped files load nothing from third parties, carry a strict
// Content-Security-Policy, contain no inline scripts or source maps, and ship no private files.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const problems = [];
const fail = (msg) => problems.push(msg);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
})(DIST);
const rel = (p) => relative(DIST, p).replaceAll('\\', '/');

// 1. Content-Security-Policy and referrer policy in index.html.
const html = readFileSync(join(DIST, 'index.html'), 'utf8').replaceAll('&#39;', "'");
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
if (!csp) fail('index.html: no Content-Security-Policy meta tag');
else {
  const directives = Object.fromEntries(csp.split(';').map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  const require = { 'default-src': ["'self'"], 'script-src': ["'self'"], 'object-src': ["'none'"], 'base-uri': ["'self'"], 'form-action': ["'none'"] };
  for (const [k, v] of Object.entries(require)) {
    if (JSON.stringify(directives[k]) !== JSON.stringify(v)) fail(`CSP: ${k} must be ${v.join(' ')}, found ${directives[k]?.join(' ') ?? 'nothing'}`);
  }
  if (/'unsafe-inline'|'unsafe-eval'|\*/.test(csp)) fail(`CSP must not allow unsafe-inline, unsafe-eval or wildcards: ${csp}`);
  for (const src of directives['connect-src'] ?? []) {
    if (src !== "'self'") fail(`CSP connect-src allows ${src}: only 'self' (plus the sync server once it exists) is allowed`);
  }
}
if (!/<meta name="referrer" content="no-referrer">/.test(html)) fail('index.html: no referrer policy');

// 1b. HTTP headers for the Cloudflare host (dist/_headers): the same CSP as the meta tag, plus framing and
// transport rules a meta tag can't set.
let headers = '';
try {
  headers = readFileSync(join(DIST, '_headers'), 'utf8').replaceAll('\r\n', '\n');
} catch {
  fail('_headers missing (Cloudflare security headers)');
}
if (headers) {
  const block = headers.split(/\n(?=\S)/).find((b) => b.startsWith('/*\n')) ?? '';
  const values = Object.fromEntries(
    block
      .split('\n')
      .slice(1)
      .map((line) => line.trim().match(/^([A-Za-z-]+): (.+)$/))
      .filter(Boolean)
      .map(([, k, v]) => [k.toLowerCase(), v]),
  );
  const get = (name) => values[name.toLowerCase()];
  const want = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
  for (const [k, v] of Object.entries(want)) if (get(k) !== v) fail(`_headers: ${k} must be ${v}, found ${get(k) ?? 'nothing'}`);
  const hsts = Number(get('Strict-Transport-Security')?.match(/max-age=(\d+)/)?.[1] ?? 0);
  if (hsts < 15552000) fail('_headers: Strict-Transport-Security max-age must be at least 180 days');
  const perms = get('Permissions-Policy') ?? '';
  for (const f of ['camera=()', 'microphone=()', 'geolocation=()']) if (!perms.includes(f)) fail(`_headers: Permissions-Policy must include ${f}`);
  if (csp && get('Content-Security-Policy') !== `${csp}; frame-ancestors 'none'`) {
    fail("_headers: the CSP header must equal the meta CSP plus frame-ancestors 'none'");
  }
}

// 2. No inline scripts in any HTML file (the CSP would block them; this keeps the build honest).
for (const f of files.filter((f) => f.endsWith('.html'))) {
  for (const tag of readFileSync(f, 'utf8').match(/<script\b[^>]*>/g) ?? []) {
    if (!/\bsrc=/.test(tag)) fail(`${rel(f)}: inline <script>`);
  }
}

// 3. No third-party addresses. These hosts appear only inside library error messages and XML namespaces, never as requests.
const TEXT_ONLY_HOSTS = new Set(['www.w3.org', 'react.dev', 'bit.ly']);
const hosts = new Map();
for (const f of files.filter((f) => /\.(js|css|html|webmanifest|json)$/.test(f))) {
  for (const [, host] of readFileSync(f, 'utf8').matchAll(/https?:\/\/([a-zA-Z0-9.-]+)/g)) {
    if (!TEXT_ONLY_HOSTS.has(host)) hosts.set(host, rel(f));
  }
}
for (const [host, where] of hosts) fail(`third-party address ${host} in ${where}`);

// 4. Nothing that should never ship.
for (const f of files) {
  const r = rel(f);
  if (r.endsWith('.map')) fail(`source map shipped: ${r}`);
  if (/(^|\/)(\.env|docs|sources)(\/|$)|\.pdf$|\.docx$/.test(r)) fail(`private or source file shipped: ${r}`);
}

// 5. The service worker caches only files from this site.
const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
for (const [, url] of sw.matchAll(/url:"([^"]+)"/g)) {
  if (/^[a-z]+:\/\//i.test(url) || url.startsWith('//')) fail(`service worker precaches an outside URL: ${url}`);
}

if (problems.length) {
  console.error(`check-dist: ${problems.length} problem(s)\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
console.log(`check-dist: OK (${files.length} files; CSP present; no inline scripts, third-party addresses, source maps or private files)`);
