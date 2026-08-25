import { APPEARANCES, APPEARANCE_LABELS } from './mode.js';
import { useTheme } from './react.js';

/**
 * Sélecteur d'apparence : Clair · Sombre · Navigateur.
 *
 * Les trois options plutôt qu'une bascule à deux états : « Sombre » et « le
 * système est sombre » sont deux choses différentes, et c'est précisément la
 * distinction que le sélecteur doit rendre lisible. Quelqu'un qui choisit
 * « Clair » alors que son système est sombre demande à ce que ça ne change
 * plus — une bascule à deux états ne sait pas exprimer ça.
 *
 * Le symbole n'est pas seul à porter l'information : `aria-pressed` et le
 * libellé accessible disent l'état, et l'option retenue se distingue par un
 * fond plein — donc par la forme, pas seulement par la couleur.
 */
const ICONS = { light: '☀', dark: '☾', system: '🖵' };

export function ThemeSwitch({ controller, className = '' }) {
  const { appearance } = useTheme(controller);

  return (
    <div className={`theme-switch ${className}`.trim()} role="group" aria-label="Apparence">
      {APPEARANCES.map((choice) => (
        <button
          key={choice}
          type="button"
          className={`theme-switch-btn${choice === appearance ? ' theme-switch-active' : ''}`}
          aria-pressed={choice === appearance}
          title={APPEARANCE_LABELS[choice]}
          onClick={() => controller.setAppearance(choice)}
        >
          <span aria-hidden="true">{ICONS[choice]}</span>
          <span className="sr-only">{APPEARANCE_LABELS[choice]}</span>
        </button>
      ))}
    </div>
  );
}
