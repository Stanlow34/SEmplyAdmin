import { useId } from 'react'

/**
 * Champ de formulaire : un libellé RELIÉ à son contrôle.
 *
 * ── Pourquoi ce composant ───────────────────────────────────────────────────
 * L'app comptait 245 `<label>` visuellement corrects mais rattachés à aucun
 * champ :
 *
 *     <div className="…">
 *       <label>N° facture *</label>
 *       <input value={…} onChange={…} />     ← aucun lien avec le label
 *     </div>
 *
 * Un lecteur d'écran annonce alors « zone d'édition », sans dire de quoi il
 * s'agit. Sur une application de facturation, la saisie devient impossible à
 * l'aveugle. Le `placeholder` ne remplace pas un libellé : il disparaît dès la
 * première frappe et n'est pas restitué de façon fiable.
 *
 * ── Utilisation ─────────────────────────────────────────────────────────────
 * L'enfant est une fonction qui reçoit l'identifiant à poser sur le contrôle.
 * C'est un peu plus verbeux qu'un `cloneElement` implicite, mais ça fonctionne
 * avec n'importe quoi — champ natif comme composant maison (`CustomSelect`,
 * `CityPostalSearch`…) — et ça reste lisible : on voit où part l'`id`.
 *
 *     <Field label="Numéro" className="non-required">
 *       {(id) => <input id={id} type="text" name="adresse_numero" />}
 *     </Field>
 *
 *     <Field label="Pays" className="required">
 *       {(id) => <CustomSelectNonClear id={id} value={pays} onChange={setPays} … />}
 *     </Field>
 *
 * `as` permet de conserver le conteneur d'origine (souvent `<p className=
 * "customer_field">` dans les formulaires existants) pour ne rien changer au CSS.
 *
 * ⚠️ Le contrôle DOIT recevoir l'`id`. Sans lui, le libellé pointe dans le vide
 * et on est revenu au point de départ — en pire, puisque le linter, lui, sera
 * satisfait.
 */
export function Field({
  label,
  children,
  /** Classe du <label> (ex. 'required' / 'non-required' du CSS existant). */
  className,
  /** Style en ligne du <label>, quand le code d'origine en portait un. */
  labelStyle,
  /**
   * Élément conteneur : 'p', 'div', 'li'… selon la mise en page d'origine.
   *
   * `as={null}` n'enveloppe RIEN : le libellé et le contrôle restent frères
   * directs. Indispensable quand le parent les positionne lui-même — une rangée
   * `display: flex` ou une grille dont le CSS cible `> label` / `> input` :
   * y insérer un <div> casserait la mise en page.
   */
  as: Wrapper = 'div',
  /** Classe du conteneur. */
  wrapperClassName,
  /** Style en ligne du conteneur, quand le code d'origine en portait un. */
  wrapperStyle,
  /** Texte d'aide affiché sous le champ et relié via aria-describedby. */
  hint,
}) {
  const id = useId()
  const hintId = `${id}-hint`

  const content = (
    <>
      <label htmlFor={id} className={className} style={labelStyle}>{label}</label>
      {children(id, hint ? hintId : undefined)}
      {hint && <span className="field-hint" id={hintId}>{hint}</span>}
    </>
  )

  return Wrapper
    ? <Wrapper className={wrapperClassName} style={wrapperStyle}>{content}</Wrapper>
    : content
}

/**
 * Intitulé d'un GROUPE de contrôles — cases à cocher, boutons de choix…
 *
 * À ne pas confondre avec `Field` : un `<label>` ne peut désigner qu'UN seul
 * contrôle. Coiffer plusieurs cases d'un `<label>` produit un libellé qui ne
 * mène nulle part — exactement le défaut que ce chantier corrige. Pire, le
 * linter s'en satisfait dès qu'un `htmlFor` est présent, même s'il pointe vers
 * un `<div>` ou un autre `<label>`.
 *
 * Ici, le titre reste un simple texte et c'est `role="group"` +
 * `aria-labelledby` qui le rattache à l'ensemble.
 *
 *     <FieldGroup label="Produits inclus" className="ap-checks">
 *       {PRODUCTS.map((p) => (
 *         <label key={p.id}><input type="checkbox" … /> {p.label}</label>
 *       ))}
 *     </FieldGroup>
 */
export function FieldGroup({ label, children, className, titleClassName, as: Wrapper = 'div' }) {
  const titleId = useId()
  return (
    <>
      <span className={titleClassName} id={titleId}>{label}</span>
      <Wrapper className={className} role="group" aria-labelledby={titleId}>
        {children}
      </Wrapper>
    </>
  )
}

export default Field
