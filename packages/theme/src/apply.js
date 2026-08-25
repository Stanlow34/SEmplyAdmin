import { PALETTES, DEFAULT_PALETTE_KEY } from './palettes.js';
import { isDarkPalette } from './mode.js';

/**
 * Application d'une palette sur le document.
 *
 * Extrait du store de SEmplyApp pour que les quatre produits de la suite
 * peignent leur interface exactement de la même façon. Rien ici ne dépend de
 * React ni d'un gestionnaire d'état : ce sont trois fonctions qui écrivent sur
 * `:root`, appelables depuis n'importe quel front.
 */

/** Écrit les variables de palette sur `:root`. */
export function applyVars(vars) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  Object.entries(vars).forEach(([name, value]) => {
    if (name.startsWith('--') && value) root.style.setProperty(name, value);
  });
}

/**
 * Annonce au navigateur si l'interface est claire ou sombre.
 *
 * Sans cela, les éléments dessinés par le navigateur lui-même — barres de
 * défilement, cases à cocher, calendriers des `<input type="date">`, menus des
 * `<select>` — restent clairs sur une interface sombre. Ce sont eux, et non le
 * CSS, qui trahissent le plus vite un thème sombre incomplet.
 */
export function applyColorScheme(paletteKey) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.colorScheme = isDarkPalette(paletteKey) ? 'dark' : 'light';
}

/** Variables effectives = palette de base + retouches individuelles. */
export function resolveVars(paletteKey, customVars) {
  const palette = PALETTES[paletteKey] ?? PALETTES[DEFAULT_PALETTE_KEY];
  return { ...palette.vars, ...customVars };
}

/** Applique une palette complète (variables + `color-scheme`). */
export function applyPalette(paletteKey, customVars) {
  applyVars(resolveVars(paletteKey, customVars));
  applyColorScheme(paletteKey);
}
