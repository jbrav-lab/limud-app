import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { SYNC_ORIGIN } from './scripts/sync-origin.mjs';

/**
 * Sync is on only when the build has VITE_SYNC_URL (and VITE_SYNC_KEY, the publishable key): the kill
 * switch. The URL must be the project's own (scripts/sync-origin.mjs); anything else fails the build.
 */
const env = loadEnv(process.env.NODE_ENV === 'production' ? 'production' : 'development', process.cwd(), 'VITE_');
const SYNC_URL = env.VITE_SYNC_URL ?? '';
if (SYNC_URL && SYNC_URL !== SYNC_ORIGIN) throw new Error(`VITE_SYNC_URL must be ${SYNC_ORIGIN}`);

/**
 * Content-Security-Policy for the built app. It is sent twice: as a <meta> tag (GitHub Pages can't send
 * headers) and as a real header from Cloudflare (`_headers`, below), which can also forbid framing.
 * Build only: the dev server needs inline scripts for hot reload. scripts/check-dist.mjs checks the result.
 * When the Supabase sync is added, its exact URL goes into connect-src, and nothing else.
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${SYNC_URL ? ` ${SYNC_URL}` : ''}`,
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * HTTP headers for the Cloudflare host (`dist/_headers`; Cloudflare reads the file and doesn't serve it).
 * - frame-ancestors / X-Frame-Options: no other site can frame the app (clickjacking).
 * - Cross-Origin-Opener-Policy is left out for now: it would cut the link the "we've moved" handoff from the
 *   old address needs (go-live plan). Add `same-origin` once every phone has moved.
 * - sw.js is never cached by the browser's HTTP cache, so app updates reach phones promptly.
 */
export const HEADERS = `/*
  Content-Security-Policy: ${CSP}; frame-ancestors 'none'
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), serial=(), hid=(), display-capture=(), browsing-topics=()
  Cross-Origin-Resource-Policy: same-origin

/sw.js
  Cache-Control: no-cache
`;

function securityHeaders(): Plugin {
  return {
    name: 'security-headers',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: '_headers', source: HEADERS });
    },
  };
}

function securityMeta(): Plugin {
  return {
    name: 'security-meta',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig({
  base: './',
  plugins: [
    react(),
    securityMeta(),
    securityHeaders(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'לומדים',
        short_name: 'לומדים',
        description: 'תרגול לפי תכנית הלימודים של משרד החינוך',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        // the default theme ("analytical") from design/tokens.json
        background_color: '#f4f6f8',
        theme_color: '#f4f6f8',
        start_url: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
});
