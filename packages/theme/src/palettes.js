// Palettes de couleurs de l'application.
//
// Les palettes « Sombre » et « Daltonien » ne sont pas des variations de goût :
// leurs couleurs ont été choisies par calcul, puis vérifiées.
//
//  - Contraste WCAG 2.1 : ≥ 4.5:1 pour tout ce qui porte du texte, y compris
//    chaque couleur sémantique sur SON fond clair (les badges « payé »,
//    « en retard »…), qui est l'endroit où les palettes ratent d'habitude.
//  - Pour « Daltonien », séparation perceptuelle (ΔE CIE76) d'au moins 30 entre
//    succès, danger, avertissement et information, sous vision normale ET sous
//    simulation de protanopie, deutéranopie et tritanopie.
//
// Ce qu'une palette ne peut PAS faire, et qu'il faut savoir : rien ici ne
// corrige une information portée par la seule couleur. Un statut signalé
// uniquement par une pastille verte ou rouge reste illisible pour une partie
// des utilisateurs, quelle que soit la palette. C'est aux composants d'ajouter
// un libellé, une icône ou une forme — la palette ne fait que garantir que les
// couleurs, quand elles sont vues, sont distinguables.

export const PALETTES = {
  default: {
    label: 'Par défaut',
    swatch: ['#b7e6b8', '#edea97', '#f5cd3d'],
    vars: {
      '--color-primary':          '#b7e6b8',
      '--color-primary-dark':     '#e9fb60',
      // Surface de saisie : un vert TRÈS pâle sur la teinte du primaire.
      // Valait #FAE5E4 — un rose, reste de la palette « Rosé » de
      // développement, alors que le primaire est vert. Il se trouvait à ΔE 2,5
      // de `--color-danger-light` (#fee2e2), c'est-à-dire à la même couleur :
      // sur un écran de connexion, le champ et le bandeau d'erreur juste
      // au-dessus devenaient indiscernables. Ici : ΔE 22,5 du rouge d'erreur,
      // contraste 14,9 avec le texte, et la même présence qu'avant sur le fond
      // blanc (ΔE 10,5 contre 9,8).
      '--color-primary-light':    '#E1EFE0',
      '--color-primary-transp':   '#b7e6b890',
      '--color-primary-text':     '#2E6B33',
      '--color-on-primary':      '#111827',
      '--color-secondary':        '#edea97',
      '--color-secondary-dark':   '#807052',
      '--color-secondary-light':  '#FFF0C4',
      '--color-secondary-transp': '#edea9790',
      '--color-secondary-text':   '#6B6420',
      '--color-on-secondary':    '#111827',
      '--color-tertiary':         '#f5cd3d',
      '--color-on-tertiary':      '#000000',   // sur #f5cd3d → 13.7:1
      '--color-tertiary-transp':  '#f5cd3d90',
      '--color-accent':           '#ccecac',
      '--color-on-accent':        '#000000',   // sur #ccecac → 16.2:1
      '--color-accent-transp':    '#ccecac90',
      '--color-success':          '#059669',
      '--color-success-dark':     '#047857',
      '--color-success-transp':   '#05966940',
      '--color-success-light':    '#d1fae5',
      '--color-danger':           '#dc2626',
      '--color-danger-dark':      '#b91c1c',
      '--color-danger-transp':    '#dc262640',
      '--color-danger-light':     '#fee2e2',
      '--color-warning':          '#D97706',
      '--color-warning-transp':   '#D9770640',
      '--color-warning-light':    '#efead7',
      '--color-warning-dark':     '#FBBF24',
      '--color-info':             '#2563EB',
      '--color-alerte':           '#f2ab69',
      '--color-border':           '#E5E7EB',
      '--color-border-light':     '#c5c6c9',    
      '--text-color':             '#111827',
      '--text-color-light':       '#4B5563',
      '--text-color-hover':       '#15868F',
      '--bg-color':               '#FFFFFF',
      '--bg-color-light':         '#F4F7F6',
      '--bg-color-hover':         '#ccefea',
    },
  },
  ocean: {
    label: 'Océan',
    swatch: ['#19617c', '#206BC2', '#C85A32'],
    vars: {
      '--color-primary': '#19617c',
      '--color-primary-dark': '#030A14',
      // Surface de saisie, et non « bleu primaire éclairci ».
      // Valait #2083a7 : un bleu MOYEN, sur lequel `--text-color` ne tenait que
      // 4,11:1 — sous le seuil AA de 4,5. Or cette variable peint le fond des
      // champs et des en-têtes de tableau. Ici : contraste 14,4.
      '--color-primary-light': '#CBEDFF',
      '--color-primary-transp': 'var(--color-primary)80',
      '--color-primary-text':     '#19617c',
      '--color-on-primary':      '#FFFFFF',
      '--color-secondary': '#206BC2',
      '--color-secondary-dark': '#134074',
      '--color-secondary-light': '#5193E7',
      '--color-secondary-transp': 'var(--color-secondary)80',
      // Plus sombre que `-dark` : ici `--color-secondary-light` (#5193E7) est un
      // bleu MOYEN, pas une teinte pâle. Un texte à #134074 n'y tenait que
      // 3,3:1 ; celui-ci passe à 4,9:1.
      '--color-secondary-text':   '#0B2545',
      '--color-on-secondary':    '#FFFFFF',
      '--color-tertiary': '#a1882f',
      '--color-on-tertiary':      '#000000',   // sur #a1882f → 6.1:1
      '--color-tertiary-transp': 'var(--color-tertiary)80',
      '--color-accent': '#C85A32',
      '--color-on-accent':        '#000000',   // sur #C85A32 → 5.0:1
      '--color-accent-transp': 'var(--color-accent)80',
      '--color-success':          '#059669',
      '--color-success-dark':     '#047857',
      '--color-success-transp':   'var(--color-success)40',
      '--color-success-light':       '#d1fae5',
      '--color-danger':           '#dc2626',
      '--color-danger-dark':      '#b91c1c',
      '--color-danger-transp':    'var(--color-danger)40',
      '--color-danger-light':        '#fee2e2',
      '--color-warning':          '#D97706',
      '--color-warning-transp':   'var(--color-warning)40',
      '--color-warning-light':       '#FEF3C7',
      '--color-warning-dark':   '#FBBF24',
      '--color-info':             '#2563EB',
      '--color-alerte':           '#92400e',
      '--color-border':           '#E5E7EB',
      '--color-border-light':     '#c5c6c9',
      '--text-color':             '#111827',
      '--text-color-light':       '#4B5563',
      '--text-color-hover':       '#15868F',
      '--bg-color':               '#FFFFFF',
      '--bg-color-light':         '#F4F7F6',
      '--bg-color-hover':         '#E6ECEB',
    },
  },
  rose: {
    label: 'Rosé',
    swatch: ['#F5CFCE', '#FFD390', '#E29EE6'],
    vars: {
      '--color-primary': '#F5CFCE',
      '--color-primary-dark': '#5C3A39',
      '--color-primary-light': '#FAE5E4',
      '--color-primary-transp': 'var(--color-primary)80',
      '--color-primary-text':     '#5C3A39',
      '--color-on-primary':      '#111827',
      '--color-secondary': '#FFD390',
      '--color-secondary-dark': '#664B1E',
      '--color-secondary-light': '#FFF0C4',
      '--color-secondary-transp': 'var(--color-secondary)80',
      '--color-secondary-text':   '#664B1E',
      '--color-on-secondary':    '#111827',
      '--color-tertiary': '#F57756',
      '--color-on-tertiary':      '#000000',   // sur #F57756 → 7.7:1
      '--color-tertiary-transp': 'var(--color-tertiary)80',
      '--color-accent': '#E29EE6',
      '--color-on-accent':        '#000000',   // sur #E29EE6 → 10.3:1
      '--color-accent-transp': 'var(--color-accent)80',
      '--color-success':          '#059669',
      '--color-success-dark':     '#047857',
      '--color-success-transp':   'var(--color-success)40',
      '--color-success-light':       '#d1fae5',
      '--color-danger':           '#dc2626',
      '--color-danger-dark':      '#b91c1c',
      '--color-danger-transp':    'var(--color-danger)40',
      '--color-danger-light':        '#fee2e2',
      '--color-warning':          '#D97706',
      '--color-warning-transp':   'var(--color-warning)40',
      '--color-warning-light':       '#FEF3C7',
      '--color-warning-dark':   '#FBBF24',
      '--color-info':             '#2563EB',
      '--color-alerte':           '#92400e',
      '--color-border':           '#E5E7EB',
      '--color-border-light':     '#c5c6c9',
      '--text-color':             '#111827',
      '--text-color-light':       '#4B5563',
      '--text-color-hover':       '#15868F',
      '--bg-color':               '#FFFFFF',
      '--bg-color-light':         '#F4F7F6',
      '--bg-color-hover':         '#E6ECEB',
    },
  },
  nuit: {
    label: 'Nuit',
    swatch: ['#0B2545', '#F0F4F8', '#EEB902'],
    vars: {
      '--color-primary': '#0B2545',
      '--color-primary-dark': '#051222',
      // Surface de saisie, et non « bleu nuit éclairci ».
      // Valait #184374, sur lequel `--text-color` tombait à 1,77:1 : un champ
      // de saisie dont on ne lit tout simplement pas le contenu. Ici : 13,45.
      '--color-primary-light': '#D6E0FC',
      '--color-primary-transp': 'var(--color-primary)80',
      '--color-primary-text':     '#0B2545',
      '--color-on-primary':      '#FFFFFF',
      '--color-secondary': '#F0F4F8',
      '--color-secondary-dark': '#D9E2EC',
      '--color-secondary-light': '#FFFFFF',
      '--color-secondary-transp': 'var(--color-secondary)80',
      '--color-secondary-text':   '#3E5062',
      '--color-on-secondary':    '#111827',
      '--color-tertiary': '#EEB902',
      '--color-on-tertiary':      '#000000',   // sur #EEB902 → 11.6:1
      '--color-tertiary-transp': 'var(--color-tertiary)80',
      '--color-accent': '#C85A32',
      '--color-on-accent':        '#000000',   // sur #C85A32 → 5.0:1
      '--color-accent-transp': 'var(--color-accent)80',
      '--color-success':          '#059669',
      '--color-success-dark':     '#047857',
      '--color-success-transp':   'var(--color-success)40',
      '--color-success-light':       '#d1fae5',
      '--color-danger':           '#dc2626',
      '--color-danger-dark':      '#b91c1c',
      '--color-danger-transp':    'var(--color-danger)40',
      '--color-danger-light':        '#fee2e2',
      '--color-warning':          '#D97706',
      '--color-warning-transp':   'var(--color-warning)40',
      '--color-warning-light':       '#FEF3C7',
      '--color-warning-dark':   '#FBBF24',
      '--color-info':             '#2563EB',
      '--color-alerte':           '#92400e',
      '--color-border':           '#E5E7EB',
      '--color-border-light':     '#c5c6c9',
      '--text-color':             '#111827',
      '--text-color-light':       '#4B5563',
      '--text-color-hover':       '#15868F',
      '--bg-color':               '#FFFFFF',
      '--bg-color-light':         '#F4F7F6',
      '--bg-color-hover':         '#E6ECEB',
    },
  },
  foret: {
    label: 'Forêt',
    swatch: ['#093A3E', '#226F54', '#EBB15B'],
    vars: {
      '--color-primary': '#093A3E',
      '--color-primary-dark': '#051F21',
      // Surface de saisie, et non « vert forêt éclairci ».
      // Valait #15868F : un sarcelle moyen, contraste 4,09:1 avec le texte —
      // sous le seuil AA. Ici : 13,04.
      '--color-primary-light': '#C7E2E5',
      '--color-primary-transp': 'var(--color-primary)80',
      '--color-primary-text':     '#093A3E',
      '--color-on-primary':      '#FFFFFF',
      '--color-secondary': '#226F54',
      '--color-secondary-dark': '#184F3C',
      '--color-secondary-light': '#2A8A68',
      '--color-secondary-transp': 'var(--color-secondary)80',
      // Même cas qu'Océan, en plus serré : `--color-secondary-light` (#2A8A68)
      // est un vert moyen sur lequel AUCUNE teinte verte franche n'atteint
      // 4,5:1. Il faut descendre au quasi-noir, qui garde juste ce qu'il faut
      // de vert pour ne pas paraître étranger à la palette (4,6:1).
      '--color-secondary-text':   '#031008',
      '--color-on-secondary':    '#FFFFFF',
      '--color-tertiary': '#EBB15B',
      '--color-on-tertiary':      '#000000',   // sur #EBB15B → 11.0:1
      '--color-tertiary-transp': 'var(--color-tertiary)80',
      '--color-accent': '#C15C3D',
      '--color-on-accent':        '#000000',   // sur #C15C3D → 4.9:1
      '--color-accent-transp': 'var(--color-accent)80',
    
      '--color-success':          '#059669',
      '--color-success-dark':     '#047857',
      '--color-success-transp':   '#05966940',
      '--color-success-light':       '#d1fae5',

      '--color-danger':           '#dc2626',
      '--color-danger-dark':      '#b91c1c',
      '--color-danger-transp':    '#dc262640',
      '--color-danger-light':        '#fee2e2',

      '--color-warning':          '#D97706',
      '--color-warning-transp':   '#D9770640',
      '--color-warning-light':       '#FEF3C7',
      '--color-warning-dark':   '#FBBF24',

      '--color-info':             '#2563EB',
      '--color-alerte':           '#92400e',

      '--color-border':           '#E5E7EB',
      '--color-border-light':     '#c5c6c9',

      '--text-color':             '#111827',
      '--text-color-light':       '#4B5563',
      '--text-color-hover':       '#15868F',

      '--bg-color':               '#FFFFFF',
      '--bg-color-light':         '#F4F7F6',
      '--bg-color-hover':         '#E6ECEB',

    },
  },
  /**
   * Mode sombre.
   *
   * Ce n'est pas la palette « Nuit », qui est claire avec des accents bleu
   * nuit : ici le FOND devient sombre, ce qui change tout le reste.
   *
   * ── Le principe qui gouverne cette palette ────────────────────────────────
   *
   * `--color-primary` et `--color-secondary` sont des SURFACES, pas des
   * accents. C'est le choix structurant : en thème sombre, un bouton primaire
   * est un rectangle sombre portant du texte clair, et non l'inverse. Les deux
   * couleurs sont donc des bleus profonds, presque des fonds.
   *
   * Conséquence directe, et c'est la raison d'être de `--color-primary-text` :
   * une couleur qui fait un bon fond fait un mauvais texte. #0a2e3f sur le fond
   * de page donne 1,26:1 — invisible. Les endroits qui écrivent
   * `color: var(--color-primary)` pour mettre un mot en valeur ont donc leur
   * propre variable, dont le seul travail est d'être lisible.
   *
   * ── Ce qu'on évite ────────────────────────────────────────────────────────
   *
   *  - **Aucun blanc, aucun ton clair en aplat.** Un `#FFFFFF` ou un `#BAE6FD`
   *    en fond découpe un rectangle éblouissant dans une interface sombre. Les
   *    surfaces claires des palettes jour deviennent ici des gris moyens.
   *  - **Les variantes `-light` des couleurs sémantiques** sont le piège
   *    classique : elles servent de fond aux badges. Laissées à #fee2e2 & co,
   *    elles brillent. Elles sont ici des teintes sourdes de la même famille,
   *    assez sombres pour porter du texte clair et assez teintées pour rester
   *    reconnaissables.
   *  - **Les `-dark` sont plus CLAIRES que la couleur de base** : sur fond
   *    sombre, c'est l'éclaircissement qui signale le survol.
   *
   * ── Ce qui ressort quand même ─────────────────────────────────────────────
   *
   * Le tertiaire (ambre) et l'accent (mauve) restent les deux seules couleurs
   * franches. Les désaturer complètement rendrait la palette homogène et
   * illisible fonctionnellement : il ne resterait plus rien pour dire « ici ».
   * Ils sont adoucis pour s'accorder au bleu-gris, pas éteints.
   *
   * Tous les couples texte/fond de cette palette ont été mesurés : ≥ 5,2:1
   * partout, y compris chaque couleur sémantique sur SON fond de badge et sur
   * la plus claire des trois surfaces (`--bg-color-hover`), qui est le cas le
   * plus défavorable.
   */
  sombre: {
    label: 'Sombre',
    swatch: ['#14171C', '#2f344b', '#E0C06A'],
    isDark: true,
    vars: {
      // Surface primaire : bleu profond. `-light` et `-dark` sont deux paliers
      // au-dessus, pour le survol et les zones en relief — jamais des couleurs
      // de texte, d'où `--color-primary-text` plus bas.
      '--color-primary':          '#0a2e3f',
      '--color-primary-dark':     '#10425A',
      '--color-primary-light':    '#124B66',
      '--color-primary-transp':   '#A8C6D833',
      // Lisible sur les trois surfaces : 10.0:1 sur le fond, 7.9:1 au pire.
      '--color-primary-text':     '#A8C6D8',
      '--color-on-primary':      '#E7EAEE',

      '--color-secondary':        '#2f344b',
      '--color-secondary-dark':   '#3e4669',
      '--color-secondary-light':  '#0d0c23',
      '--color-secondary-transp': '#B4BEDC33',
      '--color-secondary-text':   '#B4BEDC',   // 9.7:1 sur le fond
      '--color-on-secondary':    '#E7EAEE',

      // Ambre adouci : reste un signal, sans le jaune électrique qui jure avec
      // le bleu-gris. Le texte posé dessus est le fond de page lui-même plutôt
      // qu'un noir pur — un noir absolu ne se retrouve nulle part ailleurs dans
      // la palette et se lirait comme un trou.
      '--color-tertiary':         '#E0C06A',
      '--color-on-tertiary':      '#14171C',   // sur #E0C06A → 10.2:1
      '--color-tertiary-transp':  '#E0C06A33',
      '--color-accent':           '#D2A9DC',
      '--color-on-accent':        '#14171C',   // sur #D2A9DC → 8.9:1
      '--color-accent-transp':    '#D2A9DC33',

      '--color-success':          '#4FBF93',
      '--color-success-dark':     '#6FD3AC',
      '--color-success-transp':   '#4FBF9333',
      '--color-success-light':    '#1E3A31',   // vert sourd → 5.4:1 pour le vert dessus

      '--color-danger':           '#E08585',
      '--color-danger-dark':      '#EC9F9F',
      '--color-danger-transp':    '#E0858533',
      '--color-danger-light':     '#3B2529',   // 5.3:1

      '--color-warning':          '#D9A63E',
      '--color-warning-transp':   '#D9A63E33',
      '--color-warning-light':    '#3A3020',   // 5.8:1
      '--color-warning-dark':     '#E4BC63',

      '--color-info':             '#6FA0D8',
      '--color-alerte':           '#D98A55',

      // Convention reprise des palettes claires : `border` est la séparation
      // discrète, `border-light` la plus marquée (contour de champ de saisie).
      // Cette dernière tient 3:1 sur le fond, seuil des éléments non textuels :
      // un contour de champ qu'on ne distingue pas est un champ qu'on ne voit
      // pas.
      '--color-border':           '#2E3542',
      '--color-border-light':     '#5A6475',

      // Le texte est la seule chose qui a le droit d'être presque blanche :
      // c'est précisément ce que la consigne « sauf pour le texte » réserve.
      '--text-color':             '#E7EAEE',
      '--text-color-light':       '#A9B2C0',
      '--text-color-hover':       '#A8C6D8',

      '--bg-color':               '#14171C',
      '--bg-color-light':         '#1C2027',
      '--bg-color-hover':         '#262B34',
    },
  },

  /**
   * Palette accessible aux principales formes de daltonisme.
   *
   * Les quatre couleurs porteuses de sens ont été retenues par recherche
   * systématique plutôt que choisies à l'œil : c'est la seule façon de garantir
   * qu'elles restent distinctes une fois la vision simulée.
   *
   * L'avertissement est VIOLET, et non ambre. Ce n'est pas une coquetterie : un
   * ambre lisible sur blanc (≥ 4.5:1) devient indiscernable du vermillon du
   * danger en deutéranopie — mesuré à ΔE 1,8, soit la même couleur. Le violet
   * est la seule famille qui tienne à la fois le contraste et l'écart.
   *
   * Séparation minimale mesurée entre les quatre, toutes visions confondues :
   * ΔE 30,7 (au-delà de 20 = nettement distinct).
   */
  daltonien: {
    label: 'Daltonien',
    swatch: ['#1F5FA8', '#227C67', '#B14C20'],
    vars: {
      '--color-primary':          '#1F5FA8',
      '--color-primary-dark':     '#16406F',
      // Surface de saisie. Valait #E7F0FA — exactement `--bg-color-hover` de
      // cette palette (ΔE 0,0) : une ligne survolée et un champ de saisie
      // avaient la même couleur, et le fond d'erreur n'était qu'à ΔE 12,5.
      // Assombri dans la même teinte : ΔE 17,2 du rouge d'erreur, 8,8 du
      // survol, contraste 13,2 avec le texte.
      '--color-primary-light':    '#D3DEFD',
      '--color-primary-transp':   '#1F5FA840',
      '--color-primary-text':     '#16406F',
      '--color-on-primary':      '#FFFFFF',
      '--color-secondary':        '#227C67',
      '--color-secondary-dark':   '#175646',
      '--color-secondary-light':  '#EDF6F3',
      '--color-secondary-transp': '#227C6740',
      '--color-secondary-text':   '#175646',
      '--color-on-secondary':    '#FFFFFF',
      '--color-tertiary':         '#673285',
      '--color-on-tertiary':      '#FFFFFF',   // sur #673285 → 8.9:1
      '--color-tertiary-transp':  '#67328540',
      '--color-accent':           '#B14C20',
      '--color-on-accent':        '#FFFFFF',   // sur #B14C20 → 5.4:1
      '--color-accent-transp':    '#B14C2040',

      // Assombri de #227C67 : sur `--bg-color-hover` (#E7F0FA), qui est la plus
      // claire des surfaces mais reste teintée, l'ancien vert ne tenait que
      // 4,40:1 — sous le seuil, et invisible à la relecture. Il passe à 4,90:1.
      // L'assombrissement se fait DANS la même teinte : la séparation
      // perceptuelle avec le vermillon, le violet et le bleu de cette palette
      // tient à la teinte, pas à la clarté, et n'est donc pas entamée.
      '--color-success':          '#1F7460',
      '--color-success-dark':     '#175646',
      '--color-success-transp':   '#1F746040',
      // Éclairci jusqu'à ce que le vert conserve 4.5:1 dessus : à #E2F1ED il
      // n'était plus qu'à 4,35:1, ce qui ne se voit pas à l'œil mais se mesure.
      '--color-success-light':    '#EDF6F3',

      '--color-danger':           '#B14C20',
      '--color-danger-dark':      '#853919',
      '--color-danger-transp':    '#B14C2040',
      '--color-danger-light':     '#FBEAE3',

      '--color-warning':          '#673285',
      '--color-warning-transp':   '#67328540',
      '--color-warning-light':    '#F0E8F5',
      '--color-warning-dark':     '#4E2565',

      '--color-info':             '#2A24C6',
      '--color-alerte':           '#B14C20',

      '--color-border':           '#8A9199',
      '--color-border-light':     '#5F6670',

      '--text-color':             '#111827',
      '--text-color-light':       '#41474F',
      '--text-color-hover':       '#1F5FA8',

      '--bg-color':               '#FFFFFF',
      '--bg-color-light':         '#F5F6F8',
      '--bg-color-hover':         '#E7F0FA',
    },
  },
  /**
   * Palette « Administration » — RÉSERVÉE AU BACK-OFFICE.
   *
   * Le back-office pilote TOUTES les applications de la suite. Savoir d'un
   * coup d'œil qu'on y est, et non dans une application cliente, n'est pas un
   * confort : c'est ce qui évite d'appliquer à la plateforme entière un geste
   * qu'on croyait local. Même intention que le bandeau d'environnement, mais
   * en permanence et sur toute la surface.
   *
   * ── Comment la teinte a été choisie ─────────────────────────────────────
   *
   * Par recherche, sur trois critères simultanés, et non à l'œil :
   *
   *  1. loin des couleurs de marque clientes — sinon l'outil ressemble au
   *     produit (ΔE CIEDE2000 ≥ 17 de la plus proche) ;
   *  2. loin des couleurs sémantiques — un aplat de marque ne doit jamais se
   *     lire comme une alerte (ΔE ≥ 22 de la plus proche) ;
   *  3. dont la version PÂLE reste distinguable du fond d'erreur, puisque
   *     `--color-primary-light` peint les champs de saisie. Ce troisième
   *     critère élimine tout le voisinage du rouge et du rose — c'est
   *     exactement le défaut qui rendait champ et bandeau d'erreur
   *     indiscernables dans la palette par défaut.
   *
   * L'aubergine (315° du plan a*b*) est le meilleur compromis des trois.
   *
   * `internal: true` la retire des sélecteurs de palette des applications
   * clientes : elle ne doit pouvoir être choisie nulle part ailleurs.
   * `dark` la relie à sa variante sombre — sans quoi le back-office perdrait
   * son identité dès que l'utilisateur passe au thème sombre.
   */
  admin: {
    label: 'Administration',
    swatch: ['#4E3B58', '#7C6489', '#D9CEDF'],
    internal: true,
    dark: 'adminSombre',
    vars: {
      '--color-primary':            '#4E3B58',
      '--color-primary-dark':       '#3B2A45',
      // Gris chaud quasi neutre : dans un outil, un champ est du papier, pas
      // de la marque. Et sur une teinte aubergine, un « primaire pâle » serait
      // un rose, donc à quelques points du fond d'erreur.
      '--color-primary-light':      '#E3DEE6',
      '--color-primary-transp':     '#4E3B5890',
      '--color-primary-text':       '#5F476D',
      '--color-on-primary':         '#FFFFFF',
      '--color-secondary':          '#6A606F',
      '--color-secondary-dark':     '#514856',
      '--color-secondary-light':    '#EFE9F2',
      '--color-secondary-transp':   '#6A606F90',
      '--color-secondary-text':     '#5D5065',
      '--color-on-secondary':       '#FFFFFF',
      '--color-tertiary':           '#7C6489',
      // Blanc : #7C6489 est un aubergine moyen (contraste 5,1:1).
      '--color-on-tertiary':        '#FFFFFF',
      '--color-tertiary-transp':    '#7C648990',
      '--color-accent':             '#D9CEDF',
      '--color-on-accent':          '#111827',
      '--color-accent-transp':      '#D9CEDF90',
      '--color-success':            '#23704F',
      '--color-success-dark':       '#005738',
      '--color-success-transp':     '#23704F40',
      '--color-success-light':      '#CDF0DD',
      '--color-danger':             '#A03332',
      '--color-danger-dark':        '#7F1D20',
      '--color-danger-transp':      '#A0333240',
      '--color-danger-light':       '#FFC8C7',
      '--color-warning':            '#855718',
      '--color-warning-transp':     '#85571840',
      '--color-warning-light':      '#FFE7C6',
      '--color-warning-dark':       '#754C14',
      '--color-info':               '#365CA7',
      '--color-alerte':             '#AB4F31',
      '--color-border':             '#DFDCE1',
      '--color-border-light':       '#908993',
      '--text-color':               '#111827',
      '--text-color-light':         '#4B5563',
      '--text-color-hover':         '#5F476D',
      '--bg-color':                 '#FFFFFF',
      '--bg-color-light':           '#F8F6F9',
      '--bg-color-hover':           '#F8F1FC',
    },
  },

  /**
   * Variante sombre de « Administration ».
   *
   * Les trois surfaces neutres (`--bg-color`, `--bg-color-light`,
   * `--text-color`) sont EXACTEMENT celles de la palette « Sombre ». Ce n'est
   * pas de la paresse : le script anti-flash posé dans le <head> des quatre
   * produits écrit ces trois valeurs en dur avant la première peinture. S'en
   * écarter ferait clignoter le back-office d'un sombre à l'autre au
   * chargement. L'identité est portée par la marque et l'accent — en thème
   * sombre, tous les fonds convergent de toute façon vers le presque-noir.
   */
  adminSombre: {
    label: 'Administration (sombre)',
    swatch: ['#14171C', '#453251', '#D4BFDE'],
    internal: true,
    isDark: true,
    vars: {
      '--color-primary':            '#372D3D',
      '--color-primary-dark':       '#493E4F',
      '--color-primary-light':      '#453251',
      '--color-primary-transp':     '#D2C0DC33',
      '--color-primary-text':       '#D2C0DC',
      '--color-on-primary':         '#E7EAEE',
      '--color-secondary':          '#3D373F',
      '--color-secondary-dark':     '#4D4750',
      '--color-secondary-light':    '#2F2A32',
      '--color-secondary-transp':   '#C8BDCE33',
      '--color-secondary-text':     '#C8BDCE',
      '--color-on-secondary':       '#E7EAEE',
      '--color-tertiary':           '#CBB3D8',
      '--color-on-tertiary':        '#14171C',
      '--color-tertiary-transp':    '#CBB3D833',
      '--color-accent':             '#D4BFDE',
      '--color-on-accent':          '#14171C',
      '--color-accent-transp':      '#D4BFDE33',
      '--color-success':            '#4FBF93',
      '--color-success-dark':       '#6FD3AC',
      '--color-success-transp':     '#4FBF9333',
      '--color-success-light':      '#1E3A31',
      '--color-danger':             '#E08585',
      '--color-danger-dark':        '#EC9F9F',
      '--color-danger-transp':      '#E0858533',
      // S'écarte de « Sombre » (#3B2529) : sur une marque aubergine la surface
      // de saisie est elle-même violette, les deux tombaient à ΔE 9,4. Décalé
      // vers le rouge franc, l'écart remonte à 17,6.
      '--color-danger-light':       '#46211E',
      '--color-warning':            '#D9A63E',
      '--color-warning-transp':     '#D9A63E33',
      '--color-warning-light':      '#3A3020',
      '--color-warning-dark':       '#E4BC63',
      '--color-info':               '#8FB0E8',
      '--color-alerte':             '#D98A55',
      '--color-border':             '#38333A',
      '--color-border-light':       '#726A76',
      '--text-color':               '#E7EAEE',
      '--text-color-light':         '#A9B2C0',
      '--text-color-hover':         '#D2C0DC',
      // Les trois surfaces neutres sont celles de « Sombre », à la valeur près
      // (cf. le commentaire de la palette).
      '--bg-color':                 '#14171C',
      '--bg-color-light':           '#1C2027',
      '--bg-color-hover':           '#262B34',
    },
  },
};

export const DEFAULT_PALETTE_KEY = 'default';  // palette par défaut si la clé n’existe pas

// Couleurs de base ajustables individuellement via les color pickers.
// `var` = variable CSS écrasée ; `label` = libellé affiché.
export const EDITABLE_COLORS = [
  { var: '--color-primary', label: 'Couleur principale' },
  { var: '--color-secondary', label: 'Couleur secondaire' },
  { var: '--color-tertiary', label: 'Couleur tertiaire' },
  { var: '--color-accent', label: 'Couleur d’accent' },

  { var: '--color-success', label: 'Couleur succès' },

  { var: '--color-danger', label: 'Couleur danger' },

  { var: '--color-warning', label: 'Couleur avertissement' },

  { var: '--color-info', label: 'Couleur info' },
  { var: '--color-alerte', label: 'Couleur alerte' },

  { var: '--color-border', label: 'Couleur bordure' },

  { var: '--text-color', label: 'Couleur texte' },
  { var: '--text-color-hover', label: 'Couleur texte survol' },

  { var: '--bg-color', label: 'Couleur fond' },
  { var: '--bg-color-hover', label: 'Couleur fond survol' },
];
