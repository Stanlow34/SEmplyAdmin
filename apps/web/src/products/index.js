/**
 * Modules de routes par produit — chargés à la demande (code splitting).
 *
 * Un module est DÉTACHABLE : retirer l'entrée ci-dessous et supprimer le
 * dossier suffit à sortir un produit du back-office, sans toucher au reste.
 * C'est ce qui rend l'arrêt d'un produit sans conséquence ici.
 *
 * La clé correspond au `clientId` du produit dans le catalogue OIDC
 * d'AuthSEmply : un produit absent du catalogue n'affiche simplement pas ses
 * écrans, même si le module existe.
 */
export const PRODUCT_MODULES = {
  semplyapp: () => import('./semplyapp/routes.jsx'),
};
