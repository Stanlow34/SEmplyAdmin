import React, { useCallback, useEffect, useId, useState } from 'react';
import { Modal } from '../../components/Modal.jsx';
import { API_BASE } from '../../lib/apiBase.js';
import { useSudo } from '../../hooks/useSudo.jsx';
import { useAdminAccess } from '../../hooks/useAdminAccess.js';
import './AdminDeadlinesPage.css';

/**
 * Back-office super admin — échéances.
 *
 * Deux objets, la même raison d'être en base plutôt qu'en dur : ils changent au
 * rythme de l'administration fiscale, pas à celui des livraisons.
 *
 *  - le **calendrier officiel** : les dates de déclaration des revenus sont
 *    fixées chaque printemps par arrêté. Sans cet écran, poser celles de
 *    l'année suivante supposait une requête SQL en production — c'est-à-dire,
 *    en pratique, un oubli ;
 *  - les **guides d'étapes** : les parcours des sites officiels sont refondus
 *    sans prévenir. Une étape fausse envoie l'utilisateur cliquer là où il n'y
 *    a plus rien, ce qui est pire qu'une étape absente.
 */

const CALENDAR_KINDS = [
  { id: 'IRPP_OPENING', label: 'Ouverture du service en ligne' },
  { id: 'IRPP_PAPER', label: 'Déclaration papier — date nationale' },
  { id: 'IRPP_ONLINE_ZONE1', label: 'En ligne — zone 1 (dép. 01 à 19, non-résidents)' },
  { id: 'IRPP_ONLINE_ZONE2', label: 'En ligne — zone 2 (dép. 20 à 54)' },
  { id: 'IRPP_ONLINE_ZONE3', label: 'En ligne — zone 3 (dép. 55 à 976)' },
  { id: 'TVA_CA12', label: 'TVA — déclaration annuelle (CA12)' },
];

const kindLabel = (id) => CALENDAR_KINDS.find((k) => k.id === id)?.label ?? id;

const isoDate = (value) => String(value ?? '').slice(0, 10);

export function AdminDeadlinesPage() {
  const [tab, setTab] = useState('calendar');
  const [guides, setGuides] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [missing, setMissing] = useState([]);
  const [targetYear, setTargetYear] = useState(new Date().getFullYear() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [draftEntry, setDraftEntry] = useState({
    year: new Date().getFullYear() + 1,
    kind: 'IRPP_ONLINE_ZONE1',
    due_date: '',
    label: '',
  });

  /** Guide en cours d'édition, copié pour ne pas écrire dans la liste. */
  const [editing, setEditing] = useState(null);
  const editTitleId = useId();

  const { run: withSudo, prompt: sudoPrompt } = useSudo();
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
      err.code = body?.error;
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [g, c, m] = await Promise.all([
        call('/admin/deadlines/guides'),
        call('/admin/deadlines/calendar'),
        call(`/admin/deadlines/calendar/missing?year=${targetYear}`),
      ]);
      setGuides(g);
      setCalendar(c);
      setMissing(m);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [call, targetYear]);

  useEffect(() => {
    void load();
  }, [load]);

  // ─── Calendrier ──────────────────────────────────────────────────────────

  const saveEntry = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      await withSudo(() =>
        call('/admin/deadlines/calendar', {
          method: 'PUT',
          body: JSON.stringify({
            year: Number(draftEntry.year),
            kind: draftEntry.kind,
            due_date: draftEntry.due_date,
            label: draftEntry.label || undefined,
          }),
        }),
      );
      setNotice(`${kindLabel(draftEntry.kind)} ${draftEntry.year} enregistrée.`);
      setDraftEntry((current) => ({ ...current, due_date: '', label: '' }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const removeEntry = async (entry) => {
    if (!window.confirm(`Supprimer ${kindLabel(entry.kind)} ${entry.year} ?`)) return;
    try {
      await withSudo(() => call(`/admin/deadlines/calendar/${entry.id}`, { method: 'DELETE' }));
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  // ─── Guides ──────────────────────────────────────────────────────────────

  const openGuide = (guide) => {
    setEditing({
      id: guide.id,
      title: guide.title,
      intro: guide.intro ?? '',
      url: guide.url ?? '',
      active: guide.active,
      steps: guide.steps.map((s) => ({ title: s.title, body: s.body ?? '', url: s.url ?? '' })),
    });
  };

  const setStep = (index, field, value) => {
    setEditing((current) => {
      const steps = [...current.steps];
      steps[index] = { ...steps[index], [field]: value };
      return { ...current, steps };
    });
  };

  const moveStep = (index, delta) => {
    setEditing((current) => {
      const steps = [...current.steps];
      const target = index + delta;
      if (target < 0 || target >= steps.length) return current;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...current, steps };
    });
  };

  const saveGuide = async () => {
    setError('');
    setNotice('');
    try {
      await withSudo(() =>
        call(`/admin/deadlines/guides/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title: editing.title,
            intro: editing.intro,
            url: editing.url,
            active: editing.active,
          }),
        }),
      );
      // Les étapes partent dans un second appel : elles sont remplacées en bloc,
      // et l'ordre du tableau fait foi — les positions sont réécrites côté serveur.
      await withSudo(() =>
        call(`/admin/deadlines/guides/${editing.id}/steps`, {
          method: 'PUT',
          body: JSON.stringify({ steps: editing.steps }),
        }),
      );
      setNotice(`Guide « ${editing.title} » enregistré.`);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="adl-page"><p>Chargement…</p></div>;

  return (
    <div className="adl-page">
      <header className="adl-header">
        <div>
          <h1>Échéances</h1>
          <p className="adl-intro">
            Le calendrier officiel et les marches à suivre. Tout ce qui change au
            rythme de l’administration vit ici, pas dans le code.
          </p>
        </div>
        {profileLabel && <span className="adl-badge">{profileLabel}</span>}
      </header>

      {!canWrite && (
        <p className="adl-readonly">
          Votre profil d’administration est en consultation : les modifications ne
          vous sont pas proposées.
        </p>
      )}
      {error && <p className="adl-error">{error}</p>}
      {notice && <p className="adl-notice">{notice}</p>}

      <div className="adl-tabs">
        <button
          type="button"
          className={tab === 'calendar' ? 'active' : ''}
          onClick={() => setTab('calendar')}
        >
          Calendrier officiel
        </button>
        <button
          type="button"
          className={tab === 'guides' ? 'active' : ''}
          onClick={() => setTab('guides')}
        >
          Guides d’étapes
        </button>
      </div>

      {tab === 'calendar' && (
        <section>
          {/* Une année incomplète est pire qu'une année absente : la page cliente
              n'affiche alors de rappel qu'à une partie des utilisateurs, selon
              leur département, et rien ne le signale côté SEmply. */}
          <div className="adl-missing">
            <label>
              <span>Vérifier l’année</span>
              <input
                type="number"
                value={targetYear}
                onChange={(e) => setTargetYear(Number(e.target.value))}
              />
            </label>
            {missing.length === 0 ? (
              <p className="adl-missing-ok">
                ✓ Les quatre dates de déclaration des revenus {targetYear} sont posées.
              </p>
            ) : (
              <p className="adl-missing-ko">
                ⚠ {missing.length} date(s) manquante(s) pour {targetYear} :{' '}
                {missing.map(kindLabel).join(', ')}. Les utilisateurs concernés ne
                verront aucun rappel.
              </p>
            )}
          </div>

          {canWrite && (
            <form className="adl-form" onSubmit={saveEntry}>
              <label>
                <span>Année</span>
                <input
                  type="number"
                  value={draftEntry.year}
                  onChange={(e) => setDraftEntry({ ...draftEntry, year: e.target.value })}
                  required
                />
              </label>
              <label className="adl-form-wide">
                <span>Nature</span>
                <select
                  value={draftEntry.kind}
                  onChange={(e) => setDraftEntry({ ...draftEntry, kind: e.target.value })}
                >
                  {CALENDAR_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>{k.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Date limite</span>
                <input
                  type="date"
                  value={draftEntry.due_date}
                  onChange={(e) => setDraftEntry({ ...draftEntry, due_date: e.target.value })}
                  required
                />
              </label>
              <label className="adl-form-wide">
                <span>Libellé affiché (facultatif)</span>
                <input
                  type="text"
                  value={draftEntry.label}
                  onChange={(e) => setDraftEntry({ ...draftEntry, label: e.target.value })}
                  placeholder="Déclaration en ligne — départements 01 à 19"
                />
              </label>
              <button type="submit">Enregistrer</button>
            </form>
          )}

          <table className="adl-table">
            <thead>
              <tr>
                <th>Année</th>
                <th>Nature</th>
                <th>Date limite</th>
                <th>Libellé</th>
                {canWrite && <th />}
              </tr>
            </thead>
            <tbody>
              {calendar.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.year}</td>
                  <td>{kindLabel(entry.kind)}</td>
                  <td>{isoDate(entry.due_date)}</td>
                  <td className="adl-muted">{entry.label ?? '—'}</td>
                  {canWrite && (
                    <td>
                      <button
                        type="button"
                        className="adl-link adl-link-danger"
                        onClick={() => removeEntry(entry)}
                      >
                        Supprimer
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {calendar.length === 0 && (
                <tr><td colSpan={5} className="adl-muted">Aucune date enregistrée.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === 'guides' && (
        <section className="adl-guides">
          {guides.map((guide) => (
            <article key={guide.id} className="adl-guide-card">
              <header>
                <div>
                  <strong>{guide.title}</strong>
                  <span className="adl-muted"> · {guide.key} · {guide.steps.length} étapes</span>
                  {!guide.active && <span className="adl-tag">masqué</span>}
                </div>
                {canWrite && (
                  <button type="button" className="adl-link" onClick={() => openGuide(guide)}>
                    Modifier
                  </button>
                )}
              </header>
              {guide.intro && <p className="adl-muted">{guide.intro}</p>}
              <ol className="adl-steps-preview">
                {guide.steps.map((step) => <li key={step.id}>{step.title}</li>)}
              </ol>
            </article>
          ))}
        </section>
      )}

      {editing && (
        <Modal
          onClose={() => setEditing(null)}
          overlayClassName="adl-overlay"
          className="adl-modal"
          labelledBy={editTitleId}
        >
            <button type="button" className="adl-modal-close" onClick={() => setEditing(null)} aria-label="Fermer">✕</button>
            <h2 id={editTitleId}>Modifier le guide</h2>

            <label className="adl-field">
              <span>Titre</span>
              <input
                type="text"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
            </label>
            <label className="adl-field">
              <span>Introduction</span>
              <textarea
                rows={3}
                value={editing.intro}
                onChange={(e) => setEditing({ ...editing, intro: e.target.value })}
              />
            </label>
            <label className="adl-field">
              <span>Adresse du service officiel</span>
              <input
                type="url"
                value={editing.url}
                onChange={(e) => setEditing({ ...editing, url: e.target.value })}
              />
            </label>
            <label className="adl-toggle">
              <input
                type="checkbox"
                checked={editing.active}
                onChange={(e) => setEditing({ ...editing, active: e.target.checked })}
              />
              <span>Guide visible par les utilisateurs</span>
            </label>

            <h3>Étapes</h3>
            <p className="adl-muted adl-hint">
              L’ordre du tableau fait foi. Une étape vidée de son titre est retirée
              à l’enregistrement.
            </p>

            {editing.steps.map((step, index) => (
              <div key={index} className="adl-step-edit">
                <div className="adl-step-head">
                  <span className="adl-step-num">{index + 1}</span>
                  <input
                    type="text"
                    value={step.title}
                    placeholder="Titre de l’étape"
                    onChange={(e) => setStep(index, 'title', e.target.value)}
                  />
                  <button type="button" onClick={() => moveStep(index, -1)} title="Monter">↑</button>
                  <button type="button" onClick={() => moveStep(index, 1)} title="Descendre">↓</button>
                </div>
                <textarea
                  rows={2}
                  value={step.body}
                  placeholder="Précision (facultatif)"
                  onChange={(e) => setStep(index, 'body', e.target.value)}
                />
              </div>
            ))}

            <button
              type="button"
              className="adl-add-step"
              onClick={() =>
                setEditing({ ...editing, steps: [...editing.steps, { title: '', body: '', url: '' }] })
              }
            >
              + Ajouter une étape
            </button>

            <div className="adl-modal-actions">
              <button type="button" className="adl-primary" onClick={saveGuide}>
                Enregistrer
              </button>
              <button type="button" onClick={() => setEditing(null)}>Annuler</button>
            </div>
        </Modal>
      )}

      {sudoPrompt}
    </div>
  );
}

export default AdminDeadlinesPage;
