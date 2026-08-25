/**
 * Génère css/tokens.css à partir de src/palettes.js.
 *
 * Pourquoi une génération plutôt qu'un fichier écrit à la main : les jetons
 * existent en DEUX exemplaires par nature — en JavaScript, parce que le
 * changement de palette est appliqué à l'exécution ; en CSS, parce que la page
 * doit être peinte correctement avant que le moindre script ne tourne. Deux
 * exemplaires écrits à la main dérivent, c'est précisément ce qui s'est passé
 * entre les quatre dépôts de la suite. Ici l'un est produit à partir de
 * l'autre, et `npm run check` échoue si la copie n'est plus à jour.
 *
 *   node scripts/build-tokens.mjs           écrit css/tokens.css
 *   node scripts/build-tokens.mjs --check   vérifie sans écrire
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PALETTES, DEFAULT_PALETTE_KEY } from '../src/palettes.js';

const here = dirname(fileURLToPath(import.meta.url));
const target = join(here, '..', 'css', 'tokens.css');

const GROUPS = [
  ['Marque', /^--color-(on-)?(primary|secondary|tertiary|accent)/],
  ['États sémantiques', /^--color-(success|danger|warning|info|alerte)/],
  ['Interface', /^--color-border/],
  ['Texte', /^--text-color/],
  ['Fonds', /^--bg-color/],
];

function renderPalette(vars) {
  const remaining = new Map(Object.entries(vars));
  const out = [];
  for (const [title, match] of GROUPS) {
    const lines = [];
    for (const [name, value] of [...remaining]) {
      if (!match.test(name)) continue;
      lines.push(`  ${(name + ":").padEnd(29)}${value};`);
      remaining.delete(name);
    }
    if (!lines.length) continue;
    out.push(`  /* ── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))} */`);
    out.push(...lines);
    out.push('');
  }
  if (remaining.size) {
    out.push('  /* ── Divers ─────────────────────────────────────────────── */');
    for (const [name, value] of remaining) out.push(`  ${(name + ":").padEnd(29)}${value};`);
    out.push('');
  }
  return out.join('\n');
}

const STATIC = readFileSync(join(here, 'tokens.static.css'), 'utf8');

const palette = PALETTES[DEFAULT_PALETTE_KEY];

const css = `/*
 * JETONS DE DESIGN DE LA SUITE SEMPLY — FICHIER GÉNÉRÉ, NE PAS ÉDITER.
 *
 * Produit par scripts/build-tokens.mjs à partir de src/palettes.js, palette
 * « ${palette.label} » (${DEFAULT_PALETTE_KEY}). Pour changer une couleur, éditer la palette
 * dans src/palettes.js puis relancer \`npm run build\` dans ce paquet.
 *
 * Ces valeurs sont celles peintes AVANT l'exécution du moindre script. Dès que
 * le front démarre, elles sont remplacées sur \`:root\` par la palette choisie
 * par l'utilisateur (sept disponibles, dont « Sombre » et « Daltonien »).
 * Les noms, eux, ne changent jamais : c'est ce qui permet à un composant de
 * passer d'un dépôt de la suite à l'autre sans retouche.
 *
 * Règle d'usage : toute couleur d'un front de la suite vient d'un jeton
 * ci-dessous, jamais d'une valeur en dur. Pour poser du texte sur un aplat de
 * marque, utiliser les \`--color-on-*\` (contrastes vérifiés) et jamais #fff.
 */

:root {
${renderPalette(palette.vars)}${STATIC}}
`;

if (process.argv.includes('--check')) {
  const current = readFileSync(target, 'utf8');
  if (current !== css) {
    console.error('css/tokens.css n’est plus à jour : relancer `npm run build` dans packages/theme.');
    process.exit(1);
  }
  console.log('css/tokens.css est à jour.');
} else {
  writeFileSync(target, css);
  console.log(`css/tokens.css écrit (${Object.keys(palette.vars).length} jetons de palette).`);
}
