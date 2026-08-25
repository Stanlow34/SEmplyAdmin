# @semply/theme

Charte graphique de la suite SEmply : **SEmplyApp**, **AuthSEmply**,
**SEmplyCompta**, **SEmplyPrevi**.

Avant ce paquet, chaque dépôt portait sa propre copie des jetons, recopiée à la
main depuis `SEmplyApp/frontend/src/constants/themes.js`. Les copies avaient
déjà dérivé : polices chargées avec des graisses différentes, fond de page
tantôt blanc tantôt gris, jetons `--color-on-*` absents de deux dépôts sur
quatre (donc du texte hors contraste sur les aplats de marque), et le mode
sombre nulle part ailleurs que dans SEmplyApp.

**La source de vérité est `src/palettes.js`.** `css/tokens.css` en est
_généré_ ; le fichier ne s'édite pas à la main.

## Utilisation

```js
// main.jsx / main.tsx — l'import CSS avant tout style d'application
import '@semply/theme/css';
```

```html
<!-- index.html, dans <head> : voir html/fonts.html et html/preflight.html -->
```

Les deux fragments HTML se **copient** dans le `<head>` de chaque produit :
les polices (avec `preconnect`, jamais en `@import` CSS) et le script
anti-flash, qui pose le fond sombre avant la première peinture.

Mode clair/sombre, pour un front sans gestionnaire d'état :

```js
import { createThemeController } from '@semply/theme';
import { useTheme } from '@semply/theme/react';

export const theme = createThemeController();
theme.start();          // applique la palette et suit le thème du système
```

SEmplyApp garde son store Zustand (il synchronise aussi la palette avec le
compte) et consomme seulement les palettes et les feuilles de style.

## Ce que contient le paquet

| Fichier | Rôle |
|---|---|
| `src/palettes.js` | Les 7 palettes (`default`, `ocean`, `rose`, `nuit`, `foret`, `sombre`, `daltonien`) |
| `src/mode.js` | Règle clair/sombre : mode `auto`/`manual`, suivi de `prefers-color-scheme` |
| `src/apply.js` | Écriture des variables sur `:root` + `color-scheme` |
| `src/controller.js` | Thème complet sans dépendance (stockage local, abonnement) |
| `css/tokens.css` | **Généré.** Palette par défaut + alias historiques |
| `css/base.css` | Corps de page, titres, liens, focus clavier, lien d'évitement |
| `css/components.css` | Boutons, champs, tableaux, listes, alertes, liens de menu |
| `html/*.html` | Fragments à copier dans le `<head>` |
| `turbo.json` | Déclare `css/tokens.css` comme sortie de build (sans quoi Turbo ne le restaure pas depuis son cache) |

## La palette du back-office

`admin` et `adminSombre` portent `internal: true` : elles sont **réservées au
back-office** et n'apparaissent dans aucun sélecteur de palette client.

Le back-office pilote toutes les applications de la suite ; son aubergine dit
en permanence « tu n'es pas dans une application cliente ». La teinte n'a pas
été choisie à l'œil mais par recherche, sur trois critères simultanés : loin
des couleurs de marque clientes (ΔE ≥ 17), loin des couleurs sémantiques
(ΔE ≥ 22 — un aplat de marque ne doit pas se lire comme une alerte), et dont la
version pâle reste distinguable du fond d'erreur, puisque
`--color-primary-light` peint les champs de saisie.

Elle se verrouille côté produit :

```js
export const theme = createThemeController({ lockedPalette: 'admin' });
```

`setPalette` devient inerte, seul le choix Clair · Sombre · Navigateur reste
ouvert, et le passage en sombre sert `adminSombre` — pas la palette « Sombre »
commune, qui rendrait le back-office indiscernable d'une application cliente.

**Convention de nommage :** une palette sombre a une clé qui se termine par
« sombre ». Le script anti-flash s'exécute avant le bundle et ne peut pas
importer la charte : il se fie au nom. Deux tests gardent la convention.

## Règles

1. **Aucune couleur en dur** dans un front de la suite. Tout vient d'un jeton.
2. **Du texte sur un aplat de marque** utilise `--color-on-primary`,
   `--color-on-secondary`, `--color-on-tertiary`, `--color-on-accent` — dont
   les contrastes sont mesurés — et jamais `#fff` ni `--text-color`.
3. **Pour mettre un mot en couleur de marque**, c'est `--color-primary-text`
   (lisible sur le fond de page), pas `--color-primary` (qui est une surface).
4. **Ne pas étendre les alias historiques** de `tokens.css`.
5. Après toute modification d'une palette : `npm run build` dans ce paquet, et
   commiter `css/tokens.css` avec. `npm run check` échoue si l'un des deux a
   été oublié.

## Tests

`npm test` dans le paquet (86 assertions de palette, de mode et de contrôleur,
plus la vérification que `css/tokens.css` est à jour vis-à-vis de
`src/palettes.js`).

Ils s'exécutent partout où le paquet est un **workspace** — SEmplyApp,
AuthSEmply, SEmplyCompta — parce que npm y installe ses devDependencies
(`vitest`). Dans SEmplyPrevi, où il est tiré par `file:../packages/theme` sans
workspace racine, npm n'installe pas les devDependencies : les tests y sont
présents mais ne s'y lancent pas. Leur place de référence reste SEmplyApp.

## Diffusion

Le paquet vit ici et est **copié** dans les trois autres dépôts
(`packages/theme/`), comme l'a été `@semply/auth` avant lui. Pour propager une
évolution : `npm run build`, puis recopier le dossier et relancer
`npm install` dans chaque dépôt.

## Réserves ouvertes

- `.list-dropdown` porte son ombre en `--text-color`, qui devient presque
  blanc en thème sombre : le panneau y est cerné d'un halo clair.
- La charte n'a pas de surface « information » : `--color-info-bg` retombe sur
  la surface neutre, donc les pastilles bleues rendent un fond neutre à texte
  bleu.
- Palette **Rosé** : son primaire est rose et le fond d'erreur l'est aussi.
  Aucune teinte pâle sur la teinte du primaire n'atteint ΔE 15 du rouge
  d'erreur — `--color-primary-light` y reste donc à `#FAE5E4`, et la
  distinction repose sur la bordure du champ et la couleur du texte d'erreur.
  La corriger demanderait de déplacer `--color-danger-light` pour cette
  palette seulement.

## Corrigé le 2026-08-25 — `--color-primary-light`

Ce jeton peint le fond des champs, des en-têtes de tableau et des options de
liste. Il portait selon la palette un « primaire éclairci » illisible ou un
rose indiscernable du fond d'erreur :

| palette | avant | contraste | ΔE fond d'erreur | après | contraste | ΔE |
|---|---|---|---|---|---|---|
| default | `#FAE5E4` | 14,69 | **2,5** | `#E1EFE0` | 14,89 | 22,5 |
| ocean | `#2083a7` | **4,11** | 46,9 | `#CBEDFF` | 14,44 | 26,4 |
| nuit | `#184374` | **1,77** | 61,1 | `#D6E0FC` | 13,45 | 16,8 |
| foret | `#15868F` | **4,09** | 54,3 | `#C7E2E5` | 13,04 | 25,7 |
| daltonien | `#E7F0FA` | 15,41 | 12,5 | `#D3DEFD` | 13,21 | 17,2 |

(`#E7F0FA` valait en outre exactement `--bg-color-hover` : une ligne survolée
et un champ de saisie avaient la même couleur.)

`sombre` (`#124B66`, contraste 7,82) et `rose` sont inchangées.
