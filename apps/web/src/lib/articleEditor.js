/**
 * Outils de saisie de l'éditeur d'articles — la part de `AdminArticlesPage` qui
 * n'a pas besoin de React, et se teste donc sans monter d'écran.
 *
 * (Fichier séparé aussi parce qu'un module qui exporte un composant ET des
 * fonctions casse le rafraîchissement à chaud de Vite.)
 */

/** Texte alternatif posé à l'insertion, présélectionné pour être remplacé. */
export const ALT_PLACEHOLDER = 'Légende'

/** Ce que la route de dépôt accepte (cf. backend/src/articles/article-images.ts). */
export const IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp,image/avif'

/**
 * Insère un bloc à la position du curseur, isolé par une ligne vide de part et
 * d'autre.
 *
 * L'isolement n'est pas cosmétique : `![…](…)` seul sur sa ligne devient une
 * figure légendée pleine largeur, alors que la même syntaxe au milieu d'un
 * paragraphe donne une petite image au fil du texte. Déposer une capture
 * d'écran en plein milieu d'une phrase produirait donc silencieusement le
 * mauvais rendu.
 *
 * Retourne le nouveau corps et la plage à sélectionner — le texte alternatif,
 * pour que le rédacteur écrive sa légende sans viser à la souris.
 */
export function insertBlockAt(text, start, end, block, selectable) {
  const before = text.slice(0, start).replace(/\s+$/, '')
  const after = text.slice(end).replace(/^\s+/, '')

  const prefix = before ? `${before}\n\n` : ''
  const suffix = after ? `\n\n${after}` : '\n'

  const offset = block.indexOf(selectable)
  return {
    body: `${prefix}${block}${suffix}`,
    start: prefix.length + offset,
    end: prefix.length + offset + selectable.length,
  }
}

/** Première image d'un presse-papiers ou d'un glisser-déposer, s'il y en a une. */
export function imageOf(transfer) {
  const files = Array.from(transfer?.files ?? [])
  return files.find((file) => file.type?.startsWith('image/')) ?? null
}
