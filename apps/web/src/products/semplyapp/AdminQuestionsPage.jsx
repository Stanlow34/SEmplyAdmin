import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../../lib/apiBase.js';
import './AdminQuestionsPage.css';
import { Field } from '../../components/Field.jsx'

const STEPS = [
  { id: 'profil', label: 'Votre activité' },
  { id: 'tva', label: 'TVA' },
  { id: 'urssaf', label: 'URSSAF & cotisations' },
  { id: 'impots', label: 'IS & dividendes' },
  { id: 'irpp', label: 'Impôt sur le revenu' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'fonctionnalites', label: 'Fonctionnalités' },
  { id: 'crm', label: 'CRM' },
];

const TYPES = [
  { id: 'choice', label: 'Choix (cartes)' },
  { id: 'select', label: 'Liste déroulante' },
  { id: 'boolean', label: 'Oui / Non' },
  { id: 'text', label: 'Texte libre' },
  { id: 'number', label: 'Nombre' },
  { id: 'date', label: 'Date' },
];

const EMPTY_FORM = {
  id: null,
  key: '',
  step: 'profil',
  label: '',
  help: '',
  type: 'choice',
  optionsText: '',
  condField: '',
  condValues: '',
  required: false,
  position: 100,
  active: true,
};

/**
 * Options : une par ligne, « valeur | libellé | plan_comptable ».
 * Le 3ᵉ champ (optionnel) rattache l'option à un modèle de plan comptable
 * (ex. BIC, BNC, BA, RF) : le choisir chargera ce plan sur le dossier. Il
 * n'est pas affiché à l'utilisateur.
 */
function parseOptions(text) {
  const lines = (text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  return lines.map((line) => {
    const [a, b, c] = line.split('|').map((s) => s.trim());
    const opt = b ? { value: a, label: b } : { value: a.toLowerCase().replace(/\s+/g, '_'), label: a };
    if (c) opt.plan_code = c.toUpperCase();
    return opt;
  });
}

function optionsToText(options) {
  if (!Array.isArray(options)) return '';
  return options
    .map((o) => `${o.value} | ${o.label}${o.plan_code ? ` | ${o.plan_code}` : ''}`)
    .join('\n');
}

/** Condition simple : « ce champ » a l'une de « ces valeurs » (séparées par des virgules). */
function parseConditions(field, values) {
  const f = field.trim();
  if (!f) return null;
  const vals = values
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '')
    .map((v) => (v === 'true' ? true : v === 'false' ? false : v));
  if (vals.length === 0) return null;
  return [{ field: f, in: vals }];
}

function conditionsToForm(conditions) {
  const first = Array.isArray(conditions) ? conditions[0] : null;
  if (!first || !first.field) return { condField: '', condValues: '' };
  return { condField: first.field, condValues: (first.in ?? []).map(String).join(', ') };
}

/**
 * Page super admin : ajout / édition / activation des questions personnalisées
 * du questionnaire d'onboarding. Accès contrôlé côté serveur (SuperAdminGuard) ;
 * le front vérifie via GET /admin/access pour l'affichage.
 */
function AdminQuestionsPage() {
  const [allowed, setAllowed] = useState(null); // null = vérification en cours
  const [questions, setQuestions] = useState([]);
  const [core, setCore] = useState({ steps: [], questions: [] });
  const [plans, setPlans] = useState([]);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const headers = () => ({ 'Content-Type': 'application/json' });

  const loadPlans = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/accounting-plans/templates`, { headers: {} });
      if (res.ok) setPlans(await res.json());
    } catch { /* liste des plans optionnelle */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/onboarding/questions`, { headers: {} });
      if (res.status === 403) { setAllowed(false); return; }
      if (!res.ok) throw new Error();
      setAllowed(true);
      setQuestions(await res.json());
    } catch {
      setError('Chargement impossible.');
    }
  }, []);

  const loadCore = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/onboarding/core-questions`, { headers: {} });
      if (res.ok) setCore(await res.json());
    } catch { /* catalogue cœur optionnel à l'affichage */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/access`, { headers: {} });
        const data = res.ok ? await res.json() : { is_superadmin: false };
        if (!data.is_superadmin) { setAllowed(false); return; }
        await load();
        await loadPlans();
        await loadCore();
      } catch {
        setAllowed(false);
      }
    })();
  }, [load, loadPlans, loadCore]);

  const seedPlans = async () => {
    setSeeding(true);
    setError('');
    setNotice('');
    try {
      const res = await fetch(`${API_BASE}/admin/accounting-plans/seed`, { method: 'POST', headers: headers() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await loadPlans();
      setNotice('Plans comptables par défaut chargés (BIC, BNC, BA, RF).');
    } catch (e) {
      setError(`Chargement des plans impossible : ${String(e.message ?? e)}`);
    } finally {
      setSeeding(false);
    }
  };

  const set = (key) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const edit = (q) => {
    setNotice('');
    setForm({
      id: q.id,
      key: q.key,
      step: q.step,
      label: q.label,
      help: q.help ?? '',
      type: q.type,
      optionsText: optionsToText(q.options),
      ...conditionsToForm(q.conditions),
      required: q.required,
      position: q.position,
      active: q.active,
    });
  };

  const reset = () => { setForm(EMPTY_FORM); setError(''); setNotice(''); };

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    const payload = {
      key: form.key.trim() || undefined,
      step: form.step,
      label: form.label.trim(),
      help: form.help.trim() || null,
      type: form.type,
      options: ['choice', 'select'].includes(form.type) ? parseOptions(form.optionsText) : null,
      conditions: parseConditions(form.condField, form.condValues),
      required: form.required,
      position: Number(form.position) || 100,
      active: form.active,
    };
    try {
      const res = await fetch(
        form.id
          ? `${API_BASE}/admin/onboarding/questions/${form.id}`
          : `${API_BASE}/admin/onboarding/questions`,
        { method: form.id ? 'PATCH' : 'POST', headers: headers(), body: JSON.stringify(payload) },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `HTTP ${res.status}`);
      }
      setNotice(form.id ? 'Question mise à jour.' : 'Question ajoutée au questionnaire.');
      reset();
      await load();
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (q) => {
    await fetch(`${API_BASE}/admin/onboarding/questions/${q.id}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ active: !q.active }),
    });
    await load();
  };

  const remove = async (q) => {
    if (!window.confirm(`Supprimer la question « ${q.label} » ? Les réponses déjà données seront conservées.`)) return;
    await fetch(`${API_BASE}/admin/onboarding/questions/${q.id}`, {
      method: 'DELETE',
      headers: {},
    });
    await load();
  };

  if (allowed === null) return <div className="oa-page"><p>Vérification des droits…</p></div>;
  if (allowed === false) {
    return (
      <div className="oa-page">
        <h1>Administration</h1>
        <p>Cette page est réservée au super admin de la plateforme.</p>
      </div>
    );
  }

  const needsOptions = ['choice', 'select'].includes(form.type);

  return (
    <div className="oa-page">
      <h1>Questions du questionnaire d'onboarding</h1>
      <p className="oa-muted">
        Les questions cœur (TVA, URSSAF, IS…) sont gérées par l'application. Vous pouvez ajouter
        ici des questions personnalisées, insérées dans l'étape de votre choix pour toutes les
        nouvelles configurations.
      </p>

      <div className="oa-layout">
        {/* ————— Formulaire ————— */}
        <section className="oa-form">
          <h2>{form.id ? `Modifier « ${form.key} »` : 'Nouvelle question'}</h2>

          <Field as={null} label="Libellé de la question *">
              {(id) => (
              <input id={id} value={form.label} onChange={set('label')} placeholder="Ex. Comment nous avez-vous connu ?" />
              )}
          </Field>

          <Field as={null} label="Texte d'aide (optionnel)">
              {(id) => (
              <input id={id} value={form.help} onChange={set('help')} placeholder="Affiché sous la question" />
              )}
          </Field>

          <div className="oa-row">
            <div>
              <Field as={null} label="Étape">
                  {(id) => (
                  <select id={id} value={form.step} onChange={set('step')}>
                    {STEPS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  )}
              </Field>
            </div>
            <div>
              <Field as={null} label="Type de réponse">
                  {(id) => (
                  <select id={id} value={form.type} onChange={set('type')}>
                    {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                  )}
              </Field>
            </div>
            <div>
              <Field as={null} label="Position">
                  {(id) => (
                  <input id={id} type="number" value={form.position} onChange={set('position')} />
                  )}
              </Field>
            </div>
          </div>

          {needsOptions && (
            <>
              <Field as={null} label="Options (une par ligne, « valeur | libellé | plan comptable »)">
                  {(id) => (
                  <textarea id={id}
                    rows={5}
                    value={form.optionsText}
                    onChange={set('optionsText')}
                    placeholder={'medical | Médical | BNC\nservices | Services | BIC\nagricole | Agricole | BA'}
                  />
                  )}
              </Field>
              <p className="oa-hint">
                3ᵉ champ optionnel : le <strong>code d'un plan comptable</strong> chargé sur le
                dossier quand l'option est choisie (invisible pour l'utilisateur).
                {plans.length > 0 && (
                  <> Plans disponibles : {plans.map((p) => p.code).join(', ')}.</>
                )}
              </p>
            </>
          )}

          <details className="oa-details" open={Boolean(form.condField)}>
            <summary>Condition d'affichage (optionnel)</summary>
            <div className="oa-row">
              <div>
                <Field as={null} label="Si la réponse à…">
                    {(id) => (
                    <input id={id} value={form.condField} onChange={set('condField')} placeholder="clé, ex. company_kind" />
                    )}
                </Field>
              </div>
              <div>
                <Field as={null} label="vaut l'une de…">
                    {(id) => (
                    <input id={id} value={form.condValues} onChange={set('condValues')} placeholder="ex. societe, auto_entrepreneur" />
                    )}
                </Field>
              </div>
            </div>
          </details>

          <div className="oa-row oa-checks">
            <label><input type="checkbox" checked={form.required} onChange={set('required')} /> Obligatoire</label>
            <label><input type="checkbox" checked={form.active} onChange={set('active')} /> Active</label>
          </div>

          {form.id === null && (
            <>
              <Field as={null} label="Clé technique (optionnel — générée sinon)">
                  {(id) => (
                  <input id={id} value={form.key} onChange={set('key')} placeholder="ex. custom_source_acquisition" />
                  )}
              </Field>
            </>
          )}

          {error && <p className="oa-error">{error}</p>}
          {notice && <p className="oa-notice">{notice}</p>}

          <div className="oa-actions">
            {form.id && <button type="button" className="oa-btn" onClick={reset}>Annuler</button>}
            <button type="button" className="oa-btn oa-btn-primary" onClick={save} disabled={saving || !form.label.trim()}>
              {saving ? 'Enregistrement…' : form.id ? 'Mettre à jour' : 'Ajouter la question'}
            </button>
          </div>
        </section>

        {/* ————— Liste ————— */}
        <section className="oa-list">
          <div className="oa-plans">
            <div className="oa-plans-head">
              <h2>Plans comptables ({plans.length})</h2>
              <button type="button" className="oa-btn" onClick={seedPlans} disabled={seeding}>
                {seeding ? 'Chargement…' : 'Charger les plans par défaut'}
              </button>
            </div>
            {plans.length === 0 ? (
              <p className="oa-muted">
                Aucun modèle chargé. Cliquez sur « Charger les plans par défaut » pour importer
                BIC, BNC, BA et RF (norme ANC 2022-06).
              </p>
            ) : (
              <ul className="oa-plans-list">
                {plans.map((p) => (
                  <li key={p.code}>
                    <code>{p.code}</code> — {p.name}
                    <span className="oa-muted"> · {p.account_count} comptes</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <details className="oa-core-block">
            <summary className="oa-core-summary">
              Questions cœur du questionnaire ({core.questions.length}) — lecture seule
            </summary>
            <p className="oa-muted">
              Définies dans l'application (logique fiscale, URSSAF, TVA…). Non modifiables ici ;
              elles s'affichent aux clients en plus de vos questions personnalisées.
            </p>
            {STEPS.map((s) => {
              const qs = core.questions.filter((q) => q.step === s.id);
              if (qs.length === 0) return null;
              return (
                <div key={s.id} className="oa-core-step">
                  <h3>{s.label} <span className="oa-muted">({qs.length})</span></h3>
                  <ul className="oa-core-list">
                    {qs.map((q) => (
                      <li key={q.key}>
                        <strong>{q.label}</strong>
                        <span className="oa-muted">
                          {' · '}{TYPES.find((t) => t.id === q.type)?.label ?? q.type}
                          {q.required ? ' · obligatoire' : ''}
                          {q.conditional ? ' · conditionnelle' : ''}
                          {q.optionCount ? ` · ${q.optionCount} option(s)` : ''}
                          {q.requiresEntitlement ? ` · ${q.requiresEntitlement}` : ''}
                          {' · clé '}<code>{q.key}</code>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </details>

          <h2>Questions personnalisées ({questions.length})</h2>
          {questions.length === 0 && <p className="oa-muted">Aucune question personnalisée pour le moment.</p>}
          {questions.map((q) => (
            <article key={q.id} className={`oa-card${q.active ? '' : ' inactive'}`}>
              <div className="oa-card-main">
                <strong>{q.label}</strong>
                <span className="oa-muted">
                  {STEPS.find((s) => s.id === q.step)?.label ?? q.step} · {TYPES.find((t) => t.id === q.type)?.label ?? q.type}
                  {q.required ? ' · obligatoire' : ''} · clé <code>{q.key}</code>
                  {!q.active && ' · désactivée'}
                </span>
              </div>
              <div className="oa-card-actions">
                <button type="button" className="oa-btn" onClick={() => edit(q)}>Modifier</button>
                <button type="button" className="oa-btn" onClick={() => toggleActive(q)}>
                  {q.active ? 'Désactiver' : 'Activer'}
                </button>
                <button type="button" className="oa-btn oa-btn-danger" onClick={() => remove(q)}>Supprimer</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}

export { AdminQuestionsPage };
export default AdminQuestionsPage;
