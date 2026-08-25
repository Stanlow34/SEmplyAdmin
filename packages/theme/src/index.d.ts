export type PaletteKey =
  | 'default' | 'ocean' | 'rose' | 'nuit' | 'foret' | 'sombre' | 'daltonien'
  /** Réservées au back-office : `internal: true`, à ne pas proposer ailleurs. */
  | 'admin' | 'adminSombre';
export type ThemeMode = 'auto' | 'manual';
export type Appearance = 'light' | 'dark' | 'system';

export interface Palette {
  label: string;
  swatch: string[];
  vars: Record<string, string>;
  /** Palette sombre : surfaces sombres, texte clair. */
  isDark?: boolean;
  /** Réservée à un produit : absente des sélecteurs de palette. */
  internal?: boolean;
  /** Variante sombre propre à cette palette (défaut : « sombre »). */
  dark?: PaletteKey;
}

export declare const PALETTES: Record<PaletteKey, Palette>;
export declare const DEFAULT_PALETTE_KEY: PaletteKey;
export declare const EDITABLE_COLORS: Array<{ var: string; label: string }>;

export declare const APPEARANCES: Appearance[];
export declare const APPEARANCE_LABELS: Record<Appearance, string>;
export declare const DARK_PALETTE_KEY: PaletteKey;
export declare const DARK_QUERY: string;
export declare const DEFAULT_THEME_MODE: ThemeMode;
export declare const THEME_MODES: ThemeMode[];

export declare function currentAppearance(s: { mode: ThemeMode; paletteKey: PaletteKey }): Appearance;
export declare function inferModeForExistingTheme(paletteKey?: string): ThemeMode;
export declare function isDarkPalette(key?: string): boolean;
export declare function darkPaletteFor(lightPaletteKey?: string): PaletteKey;
export declare function prefersDark(): boolean;
export declare function resolvePaletteKey(s: {
  mode: ThemeMode;
  lightPaletteKey?: PaletteKey;
  paletteKey?: PaletteKey;
  systemDark: boolean;
}): PaletteKey;
export declare function watchColorScheme(onChange: (dark: boolean) => void): () => void;

export declare function applyVars(vars: Record<string, string>): void;
export declare function applyColorScheme(paletteKey: string): void;
export declare function resolveVars(paletteKey: string, customVars?: Record<string, string>): Record<string, string>;
export declare function applyPalette(paletteKey: string, customVars?: Record<string, string>): void;

export declare const STORAGE_KEY: string;
export declare const STORAGE_KEYS: string[];
export declare function readStoredTheme(storage: Storage | null, keys?: string[]): Record<string, unknown> | null;
export declare function writeStoredTheme(storage: Storage | null, state: unknown, key?: string): void;

export interface ThemeSnapshot {
  mode: ThemeMode;
  paletteKey: PaletteKey;
  lightPaletteKey: PaletteKey;
  effectivePaletteKey: PaletteKey;
  appearance: Appearance;
  isDark: boolean;
}

export interface ThemeController {
  getSnapshot(): ThemeSnapshot;
  subscribe(listener: () => void): () => void;
  apply(): void;
  setAppearance(choice: Appearance): void;
  setPalette(key: PaletteKey): void;
  watchSystem(): () => void;
  start(): () => void;
}

export declare function createThemeController(options?: {
  storage?: Storage | null;
  storageKey?: string;
  storageKeys?: string[];
  /** Verrouille la palette du produit : `setPalette` devient inerte. */
  lockedPalette?: PaletteKey;
}): ThemeController;
