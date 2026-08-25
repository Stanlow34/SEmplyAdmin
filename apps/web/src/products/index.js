import * as semplyapp from './semplyapp/routes.jsx';

/**
 * Modules de routes par produit.
 *
 * La clé correspond à celle du produit dans la liste blanche du relais
 * (`PRODUCTS`) : un produit absent du relais n'affiche pas ses écrans, même si
 * son module existe. Retirer une entrée ici et supprimer son dossier suffit à
 * sortir un produit du back-office.
 *
 * Les descripteurs sont importés tout de suite — ils ne pèsent que des
 * `lazy()` — mais les pages, elles, ne sont téléchargées qu'à l'ouverture.
 */
export const PRODUCT_MODULES = {
  semplyapp,
};
