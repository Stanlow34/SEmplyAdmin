import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_BASE } from '../lib/apiBase.js';
import { useSudo } from '../hooks/useSudo.jsx';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import './AdminPlansPage.css';
import { Field, FieldGroup } from '../components/Field.jsx'

const PRODUCTS = [
  { id: 'APP', label: 'SEmplyApp' },
  { id: 'PREVI', label: 'SEmplyPrevi' },
  { id: 'COMPTA', label: 'SEmplyCompta' },
];

const PLAN_TYPES = [
  { id: 'LIGHT', label: 'Light' },
  { id: 'MEDIUM', label: 'Medium' },
  { id: 'FULL', label: 'Full' },
];

const FEATURE_KINDS = [
  { id: 'BOOLEAN', label: 'Droit (oui / non)' },
  { id: 'QUOTA', label: 'Quota (plafond chiffré)' },
];

const EMPTY_PLAN = {
  id: null,
  name: '',
  product: 'APP',
  type: 'LIGHT',
  includes: [],
  priceMonthly: 0,
  stripePriceId: '',
  stripeProductId: '',
  description: '',
  active: true,
  position: 100,
};

const EMPTY_FEATURE = {
  id: null,
  key: '',
  label: '',
  description: '',
  product: 'APP',
  kind: 'BOOLEAN',
  category: '',
  position: 100,
  active: true,
};

const productLabel = (id) => PRODUCTS.find((p) => p.id === id)?.label ?? id;

const euros = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

/**
 * Back-office super admin du catalogue commercial.
 *
 * Deux onglets :
 *  - Formules : ce qui est vendu (prix Stripe rattaché) et ce que chaque
 *    formule débloque (matrice de fonctionnalités + plafonds).
 *  - Fonctionnalités : le catalogue des clés consommées par la nav et les
 *    guards (`app.menu.ventes`…).
 *
 * Accès contrôlé côté serveur (SuperAdminGuard) ; le front interroge
 * GET /admin/access uniquement pour l'affichage.
 */
function AdminPlansPage() {
  const [allowed, setAllowed] = useState(null); // null = vérification en cours
  const [tab, setTab] = useState('plans');

  const [plans, setPlans] = useState([]);
  const [features, setFeatures] = useState([]);
  const [stripePrices, setStripePrices] = useState([]);
  const [stripeError, setStripeError] = useState('');

  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [planForm, setPlanForm] = useState(EMPTY_PLAN);
  // { [featureId]: { checked: bool, limit: string } } — état local de la matrice.
  const [matrix, setMatrix] = useState({});

  const [featureForm, setFeatureForm] = useState(EMPTY_FEATURE);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Les mutations exigent une ré-authentification de moins de 15 min : `run`
  // affiche la modale au premier 403 SUDO_REQUIRED puis rejoue l'action.
  const { run: withSudo, prompt: sudoPrompt } = useSudo();
  // Profil de consultation : les actions d'écriture ne sont pas proposées. Le
  // serveur les refuse de toute façon (capacité `write` sur chaque mutation).
  const { can, profileLabel } = useAdminAccess();
  const canWrite = can('write');

  const jsonHeaders = () => ({ 'Content-Type': 'application/json' });

  const call = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: options.body ? jsonHeaders() : {},
      ...options,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const err = new Error(body?.message ?? `HTTP ${res.status}`);
      // Code d'erreur de l'API (SUDO_REQUIRED, MFA_REQUIRED…) : useSudo s'en
      // sert pour déclencher la ré-authentification plutôt qu'afficher l'erreur.
      err.code = body?.error;
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }, []);

  const loadPlans = useCallback(async () => {
    setPlans(await call('/admin/billing/plans'));
  }, [call]);

  const loadFeatures = useCallback(async () => {
    setFeatures(await call('/admin/billing/features'));
  }, [call]);

  const loadStripePrices = useCallback(async () => {
    try {
      setStripePrices(await call('/admin/billing/stripe/prices'));
      setStripeError('');
    } catch (e) {
      // Clé Stripe absente en local : on retombe sur la saisie manuelle du priceId.
      setStripeError(String(e.message ?? e));
    }
  }, [call]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/access`, { headers: {} });
        const data = res.ok ? await res.json() : { is_superadmin: false };
        if (!data.is_superadmin) { setAllowed(false); return; }
        setAllowed(true);
        await Promise.all([loadPlans(), loadFeatures(), loadStripePrices()]);
      } catch (e) {
        // Super admin sans double authentification : le guard renvoie
        // MFA_REQUIRED. On l'oriente vers l'activation plutôt que d'afficher
        // un refus sec.
        if (e?.code === 'MFA_REQUIRED') { setAllowed('mfa'); return; }
        setAllowed(false);
      }
    })();
  }, [loadPlans, loadFeatures, loadStripePrices]);

  // ─── Formules ─────────────────────────────────────────────────────────────

  const selectPlan = (plan) => {
    setError(''); setNotice('');
    setSelectedPlanId(plan.id);
    setPlanForm({
      id: plan.id,
      name: plan.name,
      product: plan.product,
      type: plan.type,
      includes: plan.includes ?? [],
      priceMonthly: plan.priceMonthly,
      stripePriceId: plan.stripePriceId,
      stripeProductId: plan.stripeProductId ?? '',
      description: plan.description ?? '',
      active: plan.active,
      position: plan.position,
    });
    setMatrix(
      Object.fromEntries(
        (plan.features ?? []).map((pf) => [
          pf.featureId,
          { checked: true, limit: pf.limit === null ? '' : String(pf.limit) },
        ]),
      ),
    );
  };

  const newPlan = () => {
    setError(''); setNotice('');
    setSelectedPlanId(null);
    setPlanForm(EMPTY_PLAN);
    setMatrix({});
  };

  const setPlanField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setPlanForm((f) => ({ ...f, [key]: value }));
  };

  const toggleInclude = (product) => {
    setPlanForm((f) => ({
      ...f,
      includes: f.includes.includes(product)
        ? f.includes.filter((p) => p !== product)
        : [...f.includes, product],
    }));
  };

  /** Rattache un prix Stripe : récupère au passage le produit et le montant. */
  const pickStripePrice = (e) => {
    const priceId = e.target.value;
    const price = stripePrices.find((p) => p.id === priceId);
    setPlanForm((f) => ({
      ...f,
      stripePriceId: priceId,
      stripeProductId: price?.productId ?? f.stripeProductId,
      // Le montant Stripe fait foi : `priceMonthly` n'est qu'un affichage.
      priceMonthly: price?.amount != null ? price.amount : f.priceMonthly,
      name: f.name || price?.productName || '',
    }));
  };

  const savePlan = async () => {
    setSaving(true); setError(''); setNotice('');
    const payload = {
      name: planForm.name.trim(),
      product: planForm.product,
      type: planForm.type,
      includes: planForm.includes,
      priceMonthly: Number(planForm.priceMonthly) || 0,
      stripePriceId: planForm.stripePriceId.trim(),
      stripeProductId: planForm.stripeProductId.trim() || null,
      description: planForm.description.trim() || null,
      active: planForm.active,
      position: Number(planForm.position) || 100,
    };
    try {
      // Une seule enveloppe pour les deux appels : la modale n'apparaît qu'une
      // fois, et l'enregistrement complet est rejoué après confirmation.
      const saved = await withSudo(async () => {
        const plan = planForm.id
          ? await call(`/admin/billing/plans/${planForm.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
          : await call('/admin/billing/plans', { method: 'POST', body: JSON.stringify(payload) });

        // La matrice se sauvegarde dans un second appel : le PATCH ne la touche pas.
        await call(`/admin/billing/plans/${plan.id}/features`, {
          method: 'PUT',
          body: JSON.stringify({
            features: Object.entries(matrix)
              .filter(([, v]) => v.checked)
              .map(([featureId, v]) => ({
                featureId,
                limit: v.limit === '' ? null : Number(v.limit),
              })),
          }),
        });
        return plan;
      });

      setNotice(planForm.id ? 'Formule mise à jour.' : 'Formule créée.');
      await loadPlans();
      await loadStripePrices();
      setSelectedPlanId(saved.id);
      setPlanForm((f) => ({ ...f, id: saved.id }));
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const deletePlan = async (plan) => {
    if (!window.confirm(`Supprimer la formule « ${plan.name} » ? Préférez la désactiver si elle a déjà été vendue.`)) return;
    setError(''); setNotice('');
    try {
      await withSudo(() => call(`/admin/billing/plans/${plan.id}`, { method: 'DELETE' }));
      setNotice('Formule supprimée.');
      newPlan();
      await loadPlans();
    } catch (e) {
      setError(String(e.message ?? e));
    }
  };

  const toggleFeatureInMatrix = (featureId) => {
    setMatrix((m) => {
      const current = m[featureId];
      if (current?.checked) return { ...m, [featureId]: { ...current, checked: false } };
      return { ...m, [featureId]: { checked: true, limit: current?.limit ?? '' } };
    });
  };

  const setMatrixLimit = (featureId, value) => {
    setMatrix((m) => ({ ...m, [featureId]: { checked: true, limit: value } }));
  };

  // ─── Fonctionnalités ──────────────────────────────────────────────────────

  const editFeature = (f) => {
    setError(''); setNotice('');
    setFeatureForm({
      id: f.id,
      key: f.key,
      label: f.label,
      description: f.description ?? '',
      product: f.product,
      kind: f.kind,
      category: f.category ?? '',
      position: f.position,
      active: f.active,
    });
  };

  const setFeatureField = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFeatureForm((f) => ({ ...f, [key]: value }));
  };

  const saveFeature = async () => {
    setSaving(true); setError(''); setNotice('');
    const base = {
      label: featureForm.label.trim(),
      description: featureForm.description.trim() || null,
      product: featureForm.product,
      kind: featureForm.kind,
      category: featureForm.category.trim() || null,
      position: Number(featureForm.position) || 100,
      active: featureForm.active,
    };
    try {
      await withSudo(() =>
        featureForm.id
          ? call(`/admin/billing/features/${featureForm.id}`, { method: 'PATCH', body: JSON.stringify(base) })
          : call('/admin/billing/features', {
              method: 'POST',
              body: JSON.stringify({ ...base, key: featureForm.key.trim().toLowerCase() }),
            }),
      );
      setNotice(featureForm.id ? 'Fonctionnalité mise à jour.' : 'Fonctionnalité créée.');
      setFeatureForm(EMPTY_FEATURE);
      await loadFeatures();
      await loadPlans();
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const deleteFeature = async (f) => {
    if (!window.confirm(`Supprimer « ${f.label} » (${f.key}) ?`)) return;
    setError(''); setNotice('');
    try {
      await withSudo(() => call(`/admin/billing/features/${f.id}`, { method: 'DELETE' }));
      setNotice('Fonctionnalité supprimée.');
      await loadFeatures();
    } catch (e) {
      setError(String(e.message ?? e));
    }
  };

  // ─── Rendu ────────────────────────────────────────────────────────────────

  // Fonctionnalités proposables pour la formule en cours : celles du produit
  // vendu et celles des produits inclus dans le bundle.
  const matrixFeatures = useMemo(() => {
    const scope = new Set([planForm.product, ...planForm.includes]);
    return features
      .filter((f) => scope.has(f.product))
      .reduce((groups, f) => {
        const key = f.category ?? 'Autres';
        (groups[key] ??= []).push(f);
        return groups;
      }, {});
  }, [features, planForm.product, planForm.includes]);

  const plansByProduct = useMemo(
    () =>
      plans.reduce((groups, p) => {
        (groups[p.product] ??= []).push(p);
        return groups;
      }, {}),
    [plans],
  );

  if (allowed === null) return <div className="ap-page"><p>Vérification des droits…</p></div>;
  if (allowed === 'mfa') {
    return (
      <div className="ap-page">
        <h1>Double authentification requise</h1>
        <p>
          L’administration de la plateforme exige la double authentification.
          Activez-la depuis <a href="/parametres/securite">Paramètres › Sécurité</a>,
          puis revenez sur cette page.
        </p>
      </div>
    );
  }
  if (allowed === false) {
    return (
      <div className="ap-page">
        <h1>Administration</h1>
        <p>Cette page est réservée au super admin de la plateforme.</p>
      </div>
    );
  }

  return (
    <div className="ap-page">
      <h1>Formules &amp; fonctionnalités</h1>
      <p className="ap-muted">
        Les prix sont gérés dans Stripe : ici on rattache une formule à un prix existant. Les
        <strong> droits</strong> (menus accessibles, quotas) sont gérés en base et prennent effet à
        la prochaine émission de token du client (reconnexion ou rafraîchissement de session).
      </p>

      <div className="ap-tabs">
        <button className={tab === 'plans' ? 'active' : ''} onClick={() => setTab('plans')}>
          Formules ({plans.length})
        </button>
        <button className={tab === 'features' ? 'active' : ''} onClick={() => setTab('features')}>
          Fonctionnalités ({features.length})
        </button>
      </div>

      {!canWrite && (
        <div className="ap-readonly">
          Profil {profileLabel ?? 'de consultation'} : le catalogue est en lecture seule.
          Prix, droits et plafonds ne peuvent pas être modifiés.
        </div>
      )}

      {error && <div className="ap-error">{error}</div>}
      {notice && <div className="ap-notice">{notice}</div>}

      {tab === 'plans' && (
        <div className="ap-layout">
          {/* ————— Liste des formules ————— */}
          <aside className="ap-list">
            {canWrite && (
              <button className="ap-btn primary block" onClick={newPlan}>+ Nouvelle formule</button>
            )}
            {PRODUCTS.map((p) => (
              <section key={p.id}>
                <h3>{p.label}</h3>
                {(plansByProduct[p.id] ?? []).length === 0 && <p className="ap-muted small">Aucune formule.</p>}
                {(plansByProduct[p.id] ?? []).map((plan) => (
                  <button
                    key={plan.id}
                    className={`ap-plan-item${selectedPlanId === plan.id ? ' selected' : ''}`}
                    onClick={() => selectPlan(plan)}
                  >
                    <span className="ap-plan-name">
                      {plan.name}
                      {!plan.active && <em className="ap-badge muted">inactive</em>}
                    </span>
                    <span className="ap-plan-meta">
                      {plan.type} · {euros(plan.priceMonthly)}/mois · {plan.features.length} droits
                      {plan._count?.subscriptions > 0 && ` · ${plan._count.subscriptions} abonné(s)`}
                    </span>
                  </button>
                ))}
              </section>
            ))}
          </aside>

          {/* ————— Éditeur ————— */}
          <section className="ap-form">
            <h2>{planForm.id ? `Modifier « ${planForm.name} »` : 'Nouvelle formule'}</h2>

            <Field as={null} label="Nom commercial *">
                {(id) => (
                <input id={id} value={planForm.name} onChange={setPlanField('name')} placeholder="Ex. SEmplyApp Essentiel" />
                )}
            </Field>

            <div className="ap-row">
              <div>
                <Field as={null} label="Produit vendu">
                    {(id) => (
                    <select id={id} value={planForm.product} onChange={setPlanField('product')}>
                      {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    )}
                </Field>
              </div>
              <div>
                <Field as={null} label="Formule">
                    {(id) => (
                    <select id={id} value={planForm.type} onChange={setPlanField('type')}>
                      {PLAN_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                    )}
                </Field>
              </div>
              <div>
                <Field as={null} label="Position">
                    {(id) => (
                    <input id={id} type="number" value={planForm.position} onChange={setPlanField('position')} />
                    )}
                </Field>
              </div>
            </div>

            {/* Groupe de cases, pas un champ : chaque case porte déjà son
                propre <label> englobant. */}
            <FieldGroup label="Produits inclus (bundle)" className="ap-checks">
                  {PRODUCTS.filter((p) => p.id !== planForm.product).map((p) => (
                    <label key={p.id} className="ap-check">
                      <input
                        type="checkbox"
                        checked={planForm.includes.includes(p.id)}
                        onChange={() => toggleInclude(p.id)}
                      />
                      {p.label}
                    </label>
                  ))}
            </FieldGroup>
            <p className="ap-hint">
              Un produit inclus donne accès à l’application correspondante sans souscription
              séparée.
            </p>

            {/* Le contrôle change selon que la liste Stripe est joignable ou
                non : l'id doit donc être posé dans LES DEUX branches. */}
            <Field as={null} label="Prix Stripe *">
              {(id) => stripePrices.length > 0 ? (
              <select id={id} value={planForm.stripePriceId} onChange={pickStripePrice}>
                <option value="">— Choisir un prix Stripe —</option>
                {stripePrices.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    disabled={p.linked && p.id !== planForm.stripePriceId}
                  >
                    {p.productName ?? p.nickname ?? p.id}
                    {p.amount != null && ` — ${euros(p.amount)}`}
                    {p.interval && ` / ${p.interval}`}
                    {p.linked && p.id !== planForm.stripePriceId ? ' (déjà rattaché)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  id={id}
                  value={planForm.stripePriceId}
                  onChange={setPlanField('stripePriceId')}
                  placeholder="price_..."
                />
                <p className="ap-hint">
                  Liste Stripe indisponible ({stripeError || 'clé absente'}) : saisissez l’identifiant
                  de prix manuellement.
                </p>
              </>
              )}
            </Field>

            <div className="ap-row">
              <div>
                <Field as={null} label="Prix mensuel affiché (€)">
                    {(id) => (
                    <input id={id} type="number" step="0.01" value={planForm.priceMonthly} onChange={setPlanField('priceMonthly')} />
                    )}
                </Field>
              </div>
              <div className="ap-inline-check">
                <label className="ap-check">
                  <input type="checkbox" checked={planForm.active} onChange={setPlanField('active')} />
                  En vente
                </label>
              </div>
            </div>

            <Field as={null} label="Description (optionnel)">
                {(id) => (
                <textarea id={id} rows={2} value={planForm.description} onChange={setPlanField('description')} />
                )}
            </Field>

            {/* ————— Matrice des droits ————— */}
            <h3 className="ap-section">Ce que la formule débloque</h3>
            {Object.keys(matrixFeatures).length === 0 && (
              <p className="ap-muted">
                Aucune fonctionnalité déclarée pour {productLabel(planForm.product)} — créez-en dans
                l’onglet « Fonctionnalités ».
              </p>
            )}
            {Object.entries(matrixFeatures).map(([category, list]) => (
              <div key={category} className="ap-feature-group">
                <h4>{category}</h4>
                {list.map((f) => {
                  const state = matrix[f.id];
                  const checked = Boolean(state?.checked);
                  return (
                    <div key={f.id} className={`ap-feature-row${f.active ? '' : ' disabled'}`}>
                      <label className="ap-check">
                        <input type="checkbox" checked={checked} onChange={() => toggleFeatureInMatrix(f.id)} />
                        <span>
                          {f.label}
                          <code>{f.key}</code>
                          {!f.active && <em className="ap-badge muted">désactivée</em>}
                        </span>
                      </label>
                      {f.kind === 'QUOTA' && checked && (
                        <span className="ap-limit">
                          <input
                            type="number"
                            min="0"
                            placeholder="illimité"
                            value={state?.limit ?? ''}
                            onChange={(e) => setMatrixLimit(f.id, e.target.value)}
                          />
                          <small>vide = illimité</small>
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {canWrite && (
              <div className="ap-actions">
                <button className="ap-btn primary" onClick={savePlan} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                {planForm.id && (
                  <button
                    className="ap-btn danger"
                    onClick={() => deletePlan(plans.find((p) => p.id === planForm.id))}
                    disabled={saving}
                  >
                    Supprimer
                  </button>
                )}
                <button className="ap-btn" onClick={newPlan} disabled={saving}>Annuler</button>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'features' && (
        <div className="ap-layout">
          {/* ————— Catalogue ————— */}
          <aside className="ap-list wide">
            {canWrite && (
              <button className="ap-btn primary block" onClick={() => setFeatureForm(EMPTY_FEATURE)}>
                + Nouvelle fonctionnalité
              </button>
            )}
            {PRODUCTS.map((p) => {
              const list = features.filter((f) => f.product === p.id);
              if (list.length === 0) return null;
              return (
                <section key={p.id}>
                  <h3>{p.label}</h3>
                  {list.map((f) => (
                    <div key={f.id} className="ap-feature-item">
                      <button className="ap-feature-edit" onClick={() => editFeature(f)}>
                        <span className="ap-plan-name">
                          {f.label}
                          {!f.active && <em className="ap-badge muted">inactive</em>}
                          {f.kind === 'QUOTA' && <em className="ap-badge">quota</em>}
                        </span>
                        <span className="ap-plan-meta">
                          <code>{f.key}</code> · {f._count?.plans ?? 0} formule(s)
                        </span>
                      </button>
                      {canWrite && (
                        <button className="ap-icon-btn" title="Supprimer" onClick={() => deleteFeature(f)}>✕</button>
                      )}
                    </div>
                  ))}
                </section>
              );
            })}
          </aside>

          {/* ————— Éditeur ————— */}
          <section className="ap-form">
            <h2>{featureForm.id ? `Modifier « ${featureForm.label} »` : 'Nouvelle fonctionnalité'}</h2>

            <Field as={null} label="Clé technique *">
                {(id) => (
                <input id={id}
                  value={featureForm.key}
                  onChange={setFeatureField('key')}
                  disabled={Boolean(featureForm.id)}
                  placeholder="app.menu.ventes"
                />
                )}
            </Field>
            <p className="ap-hint">
              {featureForm.id
                ? 'La clé est immuable : elle est référencée dans le code (nav, guards).'
                : 'Format « produit.famille.nom ». C’est cette clé que le code interroge.'}
            </p>

            <Field as={null} label="Libellé *">
                {(id) => (
                <input id={id} value={featureForm.label} onChange={setFeatureField('label')} placeholder="Ventes" />
                )}
            </Field>

            <div className="ap-row">
              <div>
                <Field as={null} label="Produit">
                    {(id) => (
                    <select id={id} value={featureForm.product} onChange={setFeatureField('product')}>
                      {PRODUCTS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </select>
                    )}
                </Field>
              </div>
              <div>
                <Field as={null} label="Type">
                    {(id) => (
                    <select id={id} value={featureForm.kind} onChange={setFeatureField('kind')}>
                      {FEATURE_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                    )}
                </Field>
              </div>
              <div>
                <Field as={null} label="Position">
                    {(id) => (
                    <input id={id} type="number" value={featureForm.position} onChange={setFeatureField('position')} />
                    )}
                </Field>
              </div>
            </div>

            <Field as={null} label="Catégorie">
                {(id) => (
                <input id={id} value={featureForm.category} onChange={setFeatureField('category')} placeholder="Menus, Options, Quotas…" />
                )}
            </Field>

            <Field as={null} label="Description (optionnel)">
                {(id) => (
                <textarea id={id} rows={2} value={featureForm.description} onChange={setFeatureField('description')} />
                )}
            </Field>

            <label className="ap-check">
              <input type="checkbox" checked={featureForm.active} onChange={setFeatureField('active')} />
              Active
            </label>
            <p className="ap-hint">
              Désactiver retire le droit de tous les clients sans défaire les rattachements aux
              formules.
            </p>

            {canWrite && (
              <div className="ap-actions">
                <button className="ap-btn primary" onClick={saveFeature} disabled={saving}>
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button className="ap-btn" onClick={() => setFeatureForm(EMPTY_FEATURE)} disabled={saving}>
                  Annuler
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Ré-authentification, affichée uniquement quand l'API la réclame. */}
      {sudoPrompt}
    </div>
  );
}

export { AdminPlansPage };
export default AdminPlansPage;
