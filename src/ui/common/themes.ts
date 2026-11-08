/**
 * Table themes: the look of the laptop, the TV and the lobby. A theme is a
 * set of CSS custom properties (and a few decorative touches) keyed on
 * `<html data-theme>`, in themes.css. It changes colours, patterns, fonts
 * and roundness, never layout: the board stays where it is in every theme.
 *
 * Fonts are local stacks only (nothing is downloaded), set on the root so
 * that the script-specific stacks in base.css (`:lang(ar)`, `:lang(zh-Hant)`,
 * …) still win for Arabic, Chinese and Japanese text.
 */
export const THEME_IDS = [
  'classic',
  'laundromat',
  'mirrorBall',
  'grandmasSofa',
  'neonLockerRoom',
  'clothesline',
  'tieDye',
  'sockDrawer',
  'runway',
  'beachTowel',
  'pajamaParty',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export const DEFAULT_THEME: ThemeId = 'classic';

const STORAGE_KEY = 'battlestrip.theme';

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && (THEME_IDS as readonly string[]).includes(value);
}

/** The theme this browser last chose, for new tables. */
export function preferredTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isThemeId(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function rememberTheme(theme: ThemeId): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode or storage full: the choice just isn't remembered.
  }
}

/** Put a theme on the page. Classic is the stylesheet's own default. */
export function applyTheme(theme: ThemeId | undefined): void {
  const root = document.documentElement;
  const id = theme && isThemeId(theme) ? theme : DEFAULT_THEME;
  if (id === DEFAULT_THEME) delete root.dataset['theme'];
  else root.dataset['theme'] = id;
}
