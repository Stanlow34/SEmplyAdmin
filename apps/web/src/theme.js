import { createThemeController } from '@semply/theme';

/**
 * Thème du back-office.
 *
 * Une seule instance pour toute l'application : le contrôleur écrit sur
 * `:root`, deux instances se marcheraient dessus.
 *
 * La palette est VERROUILLÉE sur « Administration ». Ce n'est pas un réglage
 * oublié : le back-office pilote toutes les applications de la suite, et son
 * aubergine dit en permanence « tu n'es pas dans une application cliente ».
 * Un sélecteur de palette la ferait disparaître au premier clic distrait —
 * seule l'apparence claire/sombre reste ouverte, parce qu'elle règle le
 * confort des yeux et non l'identité de l'outil.
 *
 * Le passage en sombre sert `adminSombre` et non la palette « Sombre » de la
 * suite (cf. `dark` dans la palette) : l'identité doit survivre à la nuit.
 */
export const theme = createThemeController({ lockedPalette: 'admin' });
