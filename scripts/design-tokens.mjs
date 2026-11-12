// Turns design/tokens.json (the mirror of the Claude Design System) into src/design-tokens.css,
// one block per color theme, and writes design/bundle.css (the app stylesheet, as the design
// system's components/bundle.css). Fails if a theme breaks a contrast rule.
// Run: npm run design:tokens
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const tokens = JSON.parse(readFileSync(new URL('design/tokens.json', root), 'utf8'));
const themes = tokens.color.themes.map((t) => t.id);
const first = themes[0];

// A plain string value belongs to the first theme (later themes inherit it via :root).
const valueIn = (t, theme) => (typeof t.value === 'string' ? (theme === first ? t.value : undefined) : t.value[theme]);
const ref = (v) => String(v).replace(/^\{(.+)\}$/, 'var(--$1)'); // {alias} -> var(--alias)
const DARK = new Set(tokens.color.themes.filter((t) => /dark/i.test(t.id + t.name)).map((t) => t.id));

// ---------- CSS ----------
const perTheme = [...tokens.color.tokens, ...(tokens.shadow?.tokens ?? [])];
const blocks = themes.map((theme, i) => {
  const lines = [`  color-scheme: ${DARK.has(theme) ? 'dark' : 'light'};`];
  for (const t of perTheme) {
    const v = valueIn(t, theme);
    if (v !== undefined) lines.push(`  --${t.name}: ${ref(v)};`);
  }
  const sel = i === 0 ? `:root, [data-theme="${theme}"]` : `[data-theme="${theme}"]`;
  return `${sel} {\n${lines.join('\n')}\n}`;
});
const shared = [];
for (const fam of ['spacing', 'radius']) for (const t of tokens[fam]?.tokens ?? []) shared.push(`  --${t.name}: ${t.value};`);
for (const [k, stack] of Object.entries(tokens.type.families)) shared.push(`  --font-${k}: ${stack};`);

const css = `/* Generated from design/tokens.json by scripts/design-tokens.mjs. Do not edit by hand. */\n${blocks.join('\n')}\n:root {\n${shared.join('\n')}\n}\n`;
writeFileSync(new URL('src/design-tokens.css', root), css);

const app = readFileSync(new URL('src/styles.css', root), 'utf8').replace(/^﻿/, '');
writeFileSync(
  new URL('design/bundle.css', root),
  `@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700&display=swap');\n/* App stylesheet (src/styles.css), copied by scripts/design-tokens.mjs. */\n${app}`,
);

// ---------- contrast check ----------
const hex2 = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (h) => {
  const [r, g, b] = hex2(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const RULES = [
  ['ink', 'bg', 4.5], ['ink', 'card', 4.5], ['muted', 'bg', 4.5], ['muted', 'card', 4.5],
  ['on-accent', 'accent', 4.5], ['accent-text', 'card', 4.5], ['on-ink', 'ink', 4.5],
  ['good', 'card', 3], ['bad', 'card', 3], ['warn', 'card', 3],
];
const byName = Object.fromEntries(tokens.color.tokens.map((t) => [t.name, t]));
const failures = [];
for (const theme of themes) {
  for (const [fg, bg, min] of RULES) {
    const a = byName[fg] && (valueIn(byName[fg], theme) ?? valueIn(byName[fg], first));
    const b = byName[bg] && (valueIn(byName[bg], theme) ?? valueIn(byName[bg], first));
    if (!a || !b || !/^#[0-9a-f]{6}$/i.test(a) || !/^#[0-9a-f]{6}$/i.test(b)) continue;
    const c = contrast(a, b);
    if (c < min) failures.push(`${theme}: ${fg} on ${bg} = ${c.toFixed(2)} (needs ${min})`);
  }
}
console.log(`design tokens: ${themes.length} themes -> src/design-tokens.css; design/bundle.css updated`);
if (failures.length) {
  console.error('Contrast problems:\n  ' + failures.join('\n  '));
  process.exit(1);
}
console.log('contrast: all themes pass');
