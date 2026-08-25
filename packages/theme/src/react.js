import { useSyncExternalStore } from 'react';

/**
 * Branche un contrôleur de thème sur un composant React.
 *
 * `useSyncExternalStore` plutôt qu'un `useState` + `useEffect` : c'est l'API
 * prévue pour lire un état qui vit hors de React, et elle évite l'écran
 * intermédiaire peint avec l'ancienne valeur au premier rendu.
 *
 * Le paquet ne dépend de React que par ce fichier, et en pair : les fronts qui
 * ne l'importent pas n'ont aucune dépendance à React.
 */
export function useTheme(controller) {
  return useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot
  );
}
