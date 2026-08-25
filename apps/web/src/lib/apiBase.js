import { apiBaseFor } from '@semplyadmin/http';

/**
 * Racine à préfixer aux URL construites À LA MAIN — sources d'images, liens de
 * téléchargement, cibles de formulaire — c'est-à-dire tout ce qui ne passe pas
 * par `apiFetch`.
 *
 * Elle vise le RELAIS, jamais une API de produit : le navigateur ne détient
 * aucun jeton, seul le cookie de session du back-office l'accompagne, et c'est
 * le relais qui présente les identifiants au produit. Une URL absolue vers
 * `api.semply.fr` afficherait donc une image vide et un 401 dans la console.
 */
export const API_BASE = apiBaseFor();

/** Même chose pour un autre produit que celui par défaut. */
export const apiBaseOf = apiBaseFor;
