import { createPortal } from 'react-dom'
import { useEscapeToClose } from '../hooks/useEscapeToClose.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { useModalStackEntry } from '../hooks/useModalStackEntry.js'

// Modale accessible réutilisable. Rend exactement le markup existant
// (overlay + conteneur, mêmes classes → aucun impact visuel) en ajoutant :
//   - fermeture au clic sur le fond (onClose)
//   - fermeture à la touche Échap
//   - piège à focus (Tab reste dans la modale, focus restauré en sortie)
//   - rôle ARIA dialog / aria-modal
//
// Migration : remplacer
//   <div className="modal-overlay" onClick={close}>
//     <div className="modal xxx" onClick={e => e.stopPropagation()}>…</div>
//   </div>
// par
//   <Modal onClose={close} className="modal xxx">…</Modal>
export function Modal({
  onClose,
  className = 'modal',
  overlayClassName = 'modal-overlay',
  children,
  labelledBy,
  // Nom accessible de la boîte de dialogue quand aucun titre visible ne peut
  // servir de `labelledBy` (titre absent d'une des branches de rendu, par ex.).
  // Fournir l'un des deux : sans nom, un lecteur d'écran annonce « dialogue »
  // et rien d'autre.
  ariaLabel,
  closeOnBackdrop = true,
}) {
  const isTop = useModalStackEntry()
  const ref = useFocusTrap(isTop)
  useEscapeToClose(onClose, isTop)

  // Rendu dans <body> via un portail : la modale ne dépend plus de l'endroit de
  // l'arbre où elle est déclarée. Évite trois familles de bugs quand un
  // composant profond l'ouvre (ex. ClientSelect dans le formulaire de facture) :
  //   - <form> imbriqué dans <form> : HTML invalide, FormData et validation
  //     native du parent capturaient les champs de la modale ;
  //   - handlers « clic en dehors » d'un ancêtre qui démontaient la modale ;
  //   - clipping par overflow/z-index, et `position: fixed` cadré sur un
  //     ancêtre transformé plutôt que sur le viewport.
  //
  // Attention : les événements SYNTHÉTIQUES React continuent de remonter
  // l'arbre React, pas l'arbre DOM. Un formulaire dans une modale doit donc
  // toujours appeler stopPropagation() s'il est déclaré sous un autre <form>.
  return createPortal(
    // Le fond n'est pas un contrôle : le fermer au clic est un confort souris.
    // L'équivalent clavier existe et est prioritaire (useEscapeToClose), donc
    // on ne lui ajoute ni role="button" ni tabIndex — cela introduirait un
    // arrêt de tabulation fantôme à l'intérieur du piège à focus.
    /* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */
    <div
      className={overlayClassName}
      data-modal-root=""
      onClick={
        closeOnBackdrop
          ? (e) => {
              // Ne ferme que si le clic vise réellement le fond (overlay).
              // Évite qu'un clic sur une option de dropdown — dont le <li> est
              // retiré du DOM au mousedown — remonte jusqu'ici et ferme la modale.
              if (e.target === e.currentTarget) onClose?.()
            }
          : undefined
      }
    >
      {/* onClick ne porte aucune action : il empêche seulement un clic à
          l'intérieur de remonter jusqu'au fond et de fermer la modale. Rien à
          rendre accessible au clavier ici. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className={className}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        ref={ref}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
