/**
 * Charte graphique de la suite SEmply.
 *
 * Côté JavaScript : les palettes et la règle clair/sombre.
 * Côté CSS : `import '@semply/theme/css'` (jetons + base + composants).
 * Côté HTML : copier html/fonts.html et html/preflight.html dans le <head>.
 */
export { PALETTES, DEFAULT_PALETTE_KEY, EDITABLE_COLORS } from './palettes.js';
export {
  APPEARANCES,
  APPEARANCE_LABELS,
  DARK_PALETTE_KEY,
  DARK_QUERY,
  DEFAULT_THEME_MODE,
  THEME_MODES,
  currentAppearance,
  darkPaletteFor,
  inferModeForExistingTheme,
  isDarkPalette,
  prefersDark,
  resolvePaletteKey,
  watchColorScheme,
} from './mode.js';
export { applyColorScheme, applyPalette, applyVars, resolveVars } from './apply.js';
export { STORAGE_KEY, STORAGE_KEYS, readStoredTheme, writeStoredTheme } from './storage.js';
export { createThemeController } from './controller.js';
