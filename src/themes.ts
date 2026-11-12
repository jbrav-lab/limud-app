import tokens from '../design/tokens.json';

/** Color themes, read from the design system's tokens (design/tokens.json). */
const NAMES_HE: Record<string, { name: string; mood: string }> = {
  analytical: { name: 'ריכוז', mood: 'רגוע ובהיר' },
  endurance: { name: 'סבולת', mood: 'טבעי וחמים' },
  darkfocus: { name: 'מצב לילה', mood: 'כהה ונעים לעיניים' },
  detail: { name: 'דיוק', mood: 'נקי וחד' },
};

type ColorValue = string | Record<string, string>;
const color = (name: string, theme: string): string => {
  const t = tokens.color.tokens.find((x) => x.name === name);
  const v = t?.value as ColorValue | undefined;
  if (!v) return '';
  return typeof v === 'string' ? v : v[theme] ?? Object.values(v)[0];
};

export interface ThemeInfo {
  id: string;
  name: string;
  mood: string;
  swatch: { bg: string; card: string; accent: string; secondary: string; ink: string };
}

export const THEMES: ThemeInfo[] = tokens.color.themes.map((t) => ({
  id: t.id,
  name: NAMES_HE[t.id]?.name ?? t.name,
  mood: NAMES_HE[t.id]?.mood ?? '',
  swatch: { bg: color('bg', t.id), card: color('card', t.id), accent: color('accent', t.id), secondary: color('secondary', t.id), ink: color('ink', t.id) },
}));

export const DEFAULT_THEME = THEMES[0].id;

export const validTheme = (id?: string) => (id && THEMES.some((t) => t.id === id) ? id : DEFAULT_THEME);

/** Apply a theme to the whole page (CSS variables switch via [data-theme]). */
export function applyTheme(id?: string) {
  const theme = validTheme(id);
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', color('bg', theme));
}
