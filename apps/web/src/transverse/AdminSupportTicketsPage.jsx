import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch, apiErrorMessage, errorMessage } from '@semplyadmin/http';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import './AdminSupportTicketsPage.css';

/**
 * File des tickets de support (cf. docs/support-tickets.md).
 *
 * L'écran de travail quotidien du support, distinct de `/admin/support` qui
 * sert à ouvrir une session dans l'espace d'un client. Les deux se répondent :
 * le client colle son code d'accès dans un ticket, et c'est d'ici qu'on part
 * l'utiliser.
 *
 * Trois partis pris :
 *
 *  - **Tri par ancienneté du dernier message, pas par date de création.** Un
 *    ticket ouvert il y a trois semaines mais relancé ce matin n'attend pas
 *    depuis trois semaines. Trier par création ferait remonter en tête ce qui
 *    est déjà traité.
 *  - **Les notes internes sont visibles ICI et nulle part ailleurs.** Elles
 *    sont marquées d'un fond distinct et d'une mention explicite : la seule
 *    chose qui empêche d'en écrire une dans la zone publique par mégarde est de
 *    voir sans ambiguïté dans laquelle on est.
 *  - **`can('write')` neutralise réponse et statut**, sans les masquer. Un
 *    bouton absent se lit comme une panne ; un bouton désactivé avec son motif
 *    se lit comme un droit manquant. Le serveur revérifie de toute façon.
 */

const STATUSES = [
  { value: 'OUVERT', label: 'Ouvert' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'EN_ATTENTE_CLIENT', label: 'En attente client' },
  { value: 'RESOLU', label: 'Résolu' },
  { value: 'CLOS', label: 'Clos' },
];

const STATUS_LABELS = Object.fromEntries(
  STATUSES.map(({ value, label }) => [value, label]),
);

const PRIORITIES = [
  { value: 'BASSE', label: 'Basse' },
  { value: 'NORMALE', label: 'Normale' },
  { value: 'HAUTE', label: 'Haute' },
];

const CATEGORY_LABELS = {
  BUG: 'Dysfonctionnement',
  FACTURATION: 'Facturation',
  FISCAL: 'Fiscal / social',
  AUTRE: 'Autre',
};

const DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

const formatDate = (iso) => (iso ? DATE_FMT.format(new Date(iso)) : '—');

/**
 * Attente depuis le dernier message, en clair.
 *
 * Une date seule oblige à faire la soustraction de tête sur chaque ligne. Ce
 * qu'on cherche dans une file, c'est ce qui traîne.
 */
function waitingFor(iso) {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 1) return "à l'instant";
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return `${days} j`;
}

/** Nom court d'un collaborateur : prénom + nom, à défaut le surnom. */
function agentLabel(agent) {
  if (!agent) return '—';
  const full = [agent.firstname, agent.name].filter(Boolean).join(' ');
  return full || agent.admin_nickname || `#${agent.id}`;
}

function StatusBadge({ status }) {
  return (
    <span className={`atk-badge atk-badge--${status.toLowerCase()}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

/** Miroir de `buildRef` côté serveur, pour l'aperçu. */
function previewRef({ prefix, includeYear, separator, digits }) {
  const segments = [prefix || 'SUP'];
  if (includeYear) segments.push(String(new Date().getFullYear()));
  segments.push(String(42).padStart(Number(digits) || 4, '0'));
  return segments.join(separator ?? '-');
}

/**
 * Réglages du support : numérotation et fermetures automatiques.
 *
 * Placés ICI et non sur l'écran « Ouverture », à côté de ce qu'ils gouvernent :
 * on règle le format d'une référence en regardant des références. Ils passent
 * par la même route que les autres réglages de plateforme — le catalogue est
 * unique, et lui ouvrir une seconde porte dupliquerait la validation.
 */
/**
 * Gestion des macros : les générales (équipe) et les personnelles, dans le
 * même panneau. Une macro générale s'entretient à plusieurs — c'est l'outillage
 * commun ; une personnelle n'appartient qu'à son auteur (le serveur l'impose).
 */
function MacroManager({ macros, setMacros, statuses, writable, onError }) {
  const EMPTY = { title: '', body: '', set_status: '', scope: 'MINE' };
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);

  const call = async (path, options) => {
    const res = await apiFetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(await apiErrorMessage(res, 'Opération refusée.'));
    return res.json();
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = {
        title: form.title,
        body: form.body,
        set_status: form.set_status || null,
      };
      const next = editingId
        ? await call(`/admin/support/tickets/macros/${editingId}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          })
        : await call('/admin/support/tickets/macros', {
            method: 'POST',
            body: JSON.stringify({ ...payload, scope: form.scope }),
          });
      setMacros(next);
      setForm(EMPTY);
      setEditingId(null);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const edit = (macro) => {
    setEditingId(macro.id);
    setForm({
      title: macro.title,
      body: macro.body,
      set_status: macro.set_status ?? '',
      scope: macro.scope,
    });
  };

  const remove = async (macro) => {
    if (!window.confirm(`Supprimer la macro « ${macro.title} » ?`)) return;
    setBusy(true);
    try {
      setMacros(await call(`/admin/support/tickets/macros/${macro.id}`, { method: 'DELETE' }));
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="atk-macros">
      <ul className="atk-macro-list">
        {macros.map((macro) => (
          <li key={macro.id}>
            <div className="atk-macro-row">
              <strong>{macro.title}</strong>
              <span className="atk-macro-scope">
                {macro.scope === 'GLOBAL' ? 'équipe' : 'personnelle'}
              </span>
              {macro.set_status && (
                <span className="atk-macro-scope">
                  → {STATUS_LABELS[macro.set_status] ?? macro.set_status}
                </span>
              )}
              {writable && (
                <span className="atk-macro-actions">
                  <button type="button" disabled={busy} onClick={() => edit(macro)}>Modifier</button>
                  <button type="button" disabled={busy} onClick={() => remove(macro)}>Supprimer</button>
                </span>
              )}
            </div>
            <p className="atk-macro-body">{macro.body}</p>
          </li>
        ))}
        {macros.length === 0 && <li className="atk-empty">Aucune macro pour l’instant.</li>}
      </ul>

      {writable && (
        <form className="atk-macro-form" onSubmit={submit}>
          <h3>{editingId ? 'Modifier la macro' : 'Nouvelle macro'}</h3>
          <input
            type="text"
            required
            maxLength={120}
            placeholder="Titre (ex. Demande de précisions)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            required
            rows={4}
            placeholder="Message inséré dans la réponse…"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          <div className="atk-macro-form__row">
            <label>
              <span>Statut posé à l’envoi</span>
              <select
                value={form.set_status}
                onChange={(e) => setForm((f) => ({ ...f, set_status: e.target.value }))}
              >
                <option value="">— ne change rien —</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status] ?? status}
                  </option>
                ))}
              </select>
            </label>
            {!editingId && (
              <label>
                <span>Portée</span>
                <select
                  value={form.scope}
                  onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
                >
                  <option value="MINE">Personnelle</option>
                  <option value="GLOBAL">Équipe (générale)</option>
                </select>
              </label>
            )}
            <button type="submit" disabled={busy}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { setEditingId(null); setForm(EMPTY); }}
              >
                Annuler
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function SupportSettings({ writable, canTuneDelays }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch('/admin/platform/settings');
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Lecture impossible.'));
      const { settings } = await res.json();
      const byKey = Object.fromEntries(settings.map((s) => [s.key, s]));
      setForm({
        supportRefPrefix: byKey['support.ref_prefix']?.value ?? 'SUP',
        supportRefIncludeYear: Boolean(byKey['support.ref_include_year']?.value),
        supportRefSeparator: byKey['support.ref_separator']?.value ?? '-',
        supportRefDigits: byKey['support.ref_digits']?.value ?? 4,
        supportAutoResolveDays: byKey['support.auto_resolve_days']?.value ?? 7,
        supportAutoCloseDays: byKey['support.auto_close_days']?.value ?? 14,
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  /**
   * Chargé au dépliage, pas au montage.
   *
   * Un effet qui déclencherait `load()` en réaction à `open` provoquerait un
   * rendu en cascade (`react-hooks/set-state-in-effect`) ; et charger d'emblée
   * ferait payer une requête de réglages à chaque ouverture de la file, pour un
   * panneau qu'on déplie quelques fois par an.
   */
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !form) load();
  };

  const save = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const res = await apiFetch('/admin/platform/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Enregistrement impossible.'));
      setNotice('Réglages enregistrés. Ils prennent effet en quelques secondes.');
      await load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const set = (key) => (event) => {
    const target = event.target;
    setForm((current) => ({
      ...current,
      [key]: target.type === 'checkbox' ? target.checked : target.value,
    }));
  };

  return (
    <section className="atk-settings">
      <button type="button" className="atk-settings__toggle" onClick={toggle}>
        {open ? '▾' : '▸'} Réglages du support
      </button>

      {open && (
        <div className="atk-settings__body">
          {error && <div className="atk-alert">{error}</div>}
          {notice && <p className="atk-sent">{notice}</p>}

          {!form ? (
            <p className="atk-empty">Chargement…</p>
          ) : (
            <>
              <h3>Numérotation des références</h3>
              <p className="atk-hint">
                Ne s’applique qu’aux demandes <strong>à venir</strong>. Une référence
                déjà attribuée n’est jamais réécrite — le numéro donné au téléphone
                doit continuer de désigner la même demande.
              </p>

              <div className="atk-settings__grid">
                <label>
                  <span>Préfixe</span>
                  <input
                    value={form.supportRefPrefix}
                    maxLength={8}
                    disabled={!writable || busy}
                    onChange={set('supportRefPrefix')}
                  />
                </label>
                <label>
                  <span>Séparateur</span>
                  <select
                    value={form.supportRefSeparator}
                    disabled={!writable || busy}
                    onChange={set('supportRefSeparator')}
                  >
                    <option value="-">Tiret</option>
                    <option value=".">Point</option>
                    <option value="_">Souligné</option>
                    <option value="">Aucun</option>
                  </select>
                </label>
                <label>
                  <span>Chiffres du compteur</span>
                  <input
                    type="number"
                    min={2}
                    max={8}
                    value={form.supportRefDigits}
                    disabled={!writable || busy}
                    onChange={set('supportRefDigits')}
                  />
                </label>
                <label className="atk-check">
                  <input
                    type="checkbox"
                    checked={form.supportRefIncludeYear}
                    disabled={!writable || busy}
                    onChange={set('supportRefIncludeYear')}
                  />
                  Inclure l’année
                </label>
              </div>

              <p className="atk-preview">
                Aperçu : <span className="atk-ref">{previewRef(form)}</span>
                {!form.supportRefIncludeYear && (
                  <span className="atk-hint">
                    {' '}
                    — sans l’année, le compteur ne repart jamais à 1.
                  </span>
                )}
              </p>

              {canTuneDelays && (<>
              <h3>Fermetures automatiques</h3>
              <p className="atk-hint">
                <strong>0 désactive.</strong> Rien ne ferme jamais un ticket « ouvert »
                ou « en cours » : une demande que personne n’a traitée ne doit pas
                disparaître de la file toute seule.
              </p>

              <div className="atk-settings__grid">
                <label>
                  <span>Jours sans réponse → résolu</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={form.supportAutoResolveDays}
                    disabled={!writable || busy}
                    onChange={set('supportAutoResolveDays')}
                  />
                </label>
                <label>
                  <span>Jours en résolu → clos</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    value={form.supportAutoCloseDays}
                    disabled={!writable || busy}
                    onChange={set('supportAutoCloseDays')}
                  />
                </label>
              </div>

              <p className="atk-hint">
                Le client est prévenu par email de la résolution, avec un lien pour
                rouvrir. La clôture, elle, est silencieuse et <strong>définitive</strong> :
                seul le support peut ensuite rouvrir la demande.
              </p>
              </>)}

              <button type="button" onClick={save} disabled={!writable || busy}>
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export function AdminSupportTicketsPage() {
  const { can, loading: accessLoading, hasMenu, manageAdmins } = useAdminAccess();
  const writable = can('write');

  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  /** '' = tous, 'me' = mes tickets, 'none' = à prendre, sinon l'id d'un collègue. */
  const [assigned, setAssigned] = useState('');
  const [agents, setAgents] = useState([]);
  /** '' = tous, 'none' = non triés, sinon une clé du référentiel. */
  const [menuFilter, setMenuFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [options, setOptions] = useState({ menus: [], types: [], macro_statuses: [] });
  const [macros, setMacros] = useState([]);
  const [views, setViews] = useState([]);
  /** Statut que la macro appliquée posera à l'ENVOI de la réponse. */
  const [macroStatus, setMacroStatus] = useState('');
  const [showMacros, setShowMacros] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  // Cochée par défaut : une réponse que le client ne voit pas n'est pas une
  // réponse. On décoche pour un complément mineur, pas l'inverse.
  const [notify, setNotify] = useState(true);
  const [lastNotified, setLastNotified] = useState(null);
  const [resent, setResent] = useState(null);
  const [clientTitle, setClientTitle] = useState('');
  const [internalTitle, setInternalTitle] = useState('');

  const loadList = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (query.trim()) params.set('q', query.trim());
    if (assigned) params.set('assigned', assigned);
    if (menuFilter) params.set('menu', menuFilter);
    if (typeFilter) params.set('type', typeFilter);
    const suffix = params.toString() ? `?${params}` : '';

    const res = await apiFetch(`/admin/support/tickets${suffix}`);
    if (!res.ok) throw new Error(await apiErrorMessage(res, 'Chargement impossible.'));
    return res.json();
  }, [status, query, assigned, menuFilter, typeFilter]);

  // Collaborateurs, référentiels, macros et vues : chargés une fois — rien de
  // tout cela ne bouge pendant qu'on dépile la file.
  useEffect(() => {
    apiFetch('/admin/support/tickets/agents')
      .then((res) => (res.ok ? res.json() : []))
      .then(setAgents)
      .catch(() => {});
    apiFetch('/admin/support/tickets/options')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setOptions(data))
      .catch(() => {});
    apiFetch('/admin/support/tickets/macros')
      .then((res) => (res.ok ? res.json() : []))
      .then(setMacros)
      .catch(() => {});
    apiFetch('/admin/support/tickets/views')
      .then((res) => (res.ok ? res.json() : []))
      .then(setViews)
      .catch(() => {});
  }, []);

  /** Applique une vue enregistrée : chaque filtre reprend sa valeur d'alors. */
  const applyView = (view) => {
    const f = view.filters ?? {};
    setStatus(f.status ?? '');
    setAssigned(f.assigned ?? '');
    setMenuFilter(f.menu ?? '');
    setTypeFilter(f.type ?? '');
    setQuery(f.q ?? '');
  };

  const saveCurrentView = async () => {
    const name = window.prompt('Nom de la vue :');
    if (!name?.trim()) return;
    try {
      const res = await apiFetch('/admin/support/tickets/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          filters: {
            status,
            assigned,
            menu: menuFilter,
            type: typeFilter,
            q: query.trim(),
          },
        }),
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Enregistrement refusé.'));
      setViews(await res.json());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const deleteView = async (view) => {
    try {
      const res = await apiFetch(`/admin/support/tickets/views/${view.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Suppression refusée.'));
      setViews(await res.json());
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  /**
   * Applique une macro : elle REMPLIT la zone de réponse (rien ne part sans
   * relecture) et mémorise le statut à poser à l'envoi. Sur une zone non vide
   * le texte s'ajoute à la suite — une macro ne doit jamais effacer un début
   * de réponse écrit à la main.
   */
  const applyMacro = (macro) => {
    if (!macro) return;
    setReply((current) => (current.trim() ? `${current}\n\n${macro.body}` : macro.body));
    if (macro.set_status) setMacroStatus(macro.set_status);
    setInternal(false);
  };

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await loadList();
        if (!cancelled) setTickets(data);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // Débounce sur la recherche : la file est servie à chaque frappe sinon.
    const timer = setTimeout(run, query ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [loadList, query]);

  const openTicket = async (ref) => {
    setError('');
    setReply('');
    setInternal(false);
    setNotify(true);
    setLastNotified(null);
    setResent(null);
    try {
      const res = await apiFetch(`/admin/support/tickets/${encodeURIComponent(ref)}`);
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Ticket introuvable.'));
      const ticket = await res.json();
      setSelected(ticket);
      setClientTitle(ticket.subject ?? '');
      setInternalTitle(ticket.internal_subject ?? '');
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  /**
   * Enregistre les titres à la sortie du champ.
   *
   * Pas de bouton : un renommage est une correction, pas une décision — et un
   * bouton « Enregistrer » posé là ferait douter de ce qu'il enregistre, à côté
   * d'une zone de réponse qui a le sien. On n'appelle que si quelque chose a
   * réellement changé : sortir d'un champ sans le toucher ne doit pas écrire.
   */
  /**
   * Affecte le ticket sélectionné ('' = personne). La file se recharge dans la
   * foulée : si on vient de s'affecter un ticket en vue « non affectés », il
   * doit en sortir sous nos yeux — c'est ce qui confirme le geste.
   */
  const assignTicket = async (value) => {
    if (!selected || !writable) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch(
        `/admin/support/tickets/${encodeURIComponent(selected.public_ref)}/assign`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ admin_id: value === '' ? null : Number(value) }),
        },
      );
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Affectation refusée.'));
      setSelected(await res.json());
      const data = await loadList();
      setTickets(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /** Classement Menu / Type du ticket sélectionné — mêmes suites qu'une affectation. */
  const triageTicket = async (patch) => {
    if (!selected || !writable) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch(
        `/admin/support/tickets/${encodeURIComponent(selected.public_ref)}/triage`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        },
      );
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Classement refusé.'));
      setSelected(await res.json());
      setTickets(await loadList());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const saveTitles = async () => {
    if (!selected || !writable) return;
    const nextClient = clientTitle.trim();
    const nextInternal = internalTitle.trim();
    const changed =
      nextClient !== (selected.subject ?? '') ||
      nextInternal !== (selected.internal_subject ?? '');
    if (!changed) return;

    if (!nextClient) {
      // Le serveur refuse déjà, mais le dire ici évite un aller-retour et
      // remet la valeur d'origine sous les yeux.
      setError('Le titre client ne peut pas être vide.');
      setClientTitle(selected.subject ?? '');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const res = await apiFetch(
        `/admin/support/tickets/${encodeURIComponent(selected.public_ref)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: nextClient,
            internal_subject: nextInternal,
          }),
        },
      );
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Renommage impossible.'));
      await refreshBoth(await res.json());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const refreshBoth = async (ticket) => {
    setSelected(ticket);
    try {
      setTickets(await loadList());
    } catch {
      // La file peut échouer sans invalider ce qui vient d'être écrit :
      // le fil affiché reste juste, on ne le jette pas pour autant.
    }
  };

  const send = async (event) => {
    event.preventDefault();
    if (!reply.trim() || !selected) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch(
        `/admin/support/tickets/${encodeURIComponent(selected.public_ref)}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body: reply,
            is_internal: internal,
            // Une note interne ne prévient jamais. Le serveur l'impose déjà ;
            // l'envoyer explicitement évite qu'une lecture du code laisse
            // croire le contraire.
            notify_client: internal ? false : notify,
          }),
        },
      );
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Envoi impossible.'));
      const updated = await res.json();
      await refreshBoth(updated);
      // Le serveur dit si l'email est réellement PARTI : la case cochée n'est
      // qu'une intention, un SMTP en panne l'avale en silence.
      setLastNotified(internal ? null : Boolean(updated.notified));
      setReply('');
      setInternal(false);
      setNotify(true);
      // Statut promis par la macro appliquée : posé APRÈS l'envoi réussi —
      // si la réponse n'est pas partie, le ticket ne doit pas changer d'état.
      if (macroStatus && !internal) {
        const wanted = macroStatus;
        setMacroStatus('');
        await changeStatus(wanted, null);
      } else {
        setMacroStatus('');
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Renvoie un lien de suivi au client.
   *
   * Confirmation demandée, parce que l'action a un effet invisible depuis cet
   * écran : elle **périme le lien précédent**. Un clic par curiosité couperait
   * l'accès d'un client qui, lui, avait le sien sous la main.
   */
  const resendLink = async () => {
    if (!selected) return;
    const confirmed = window.confirm(
      `Envoyer un nouveau lien de suivi à ${selected.email} ?\n\n` +
        'Le lien précédent cessera immédiatement de fonctionner.',
    );
    if (!confirmed) return;

    setBusy(true);
    setError('');
    setResent(null);
    try {
      const res = await apiFetch(
        `/admin/support/tickets/${encodeURIComponent(selected.public_ref)}/resend-link`,
        { method: 'POST' },
      );
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Envoi impossible.'));
      setResent(await res.json());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (next, priority) => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch(
        `/admin/support/tickets/${encodeURIComponent(selected.public_ref)}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: next ?? selected.status,
            priority: priority ?? selected.priority,
          }),
        },
      );
      if (!res.ok) throw new Error(await apiErrorMessage(res, 'Changement refusé.'));
      await refreshBoth(await res.json());
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="atk-page">
      <header className="atk-header">
        <div>
          <h1>Tickets de support</h1>
          <p className="atk-sub">
            Les demandes reçues, de la plus ancienne relance à la plus récente. Pour
            entrer dans l’espace d’un client, il faut son code&nbsp;:{' '}
            <Link to="/admin/support">ouvrir une session support</Link>.
          </p>
        </div>
      </header>

      <div className="atk-filters">
        <div className="atk-chips" role="group" aria-label="Filtrer par statut">
          <button
            type="button"
            className={status === '' ? 'active' : ''}
            onClick={() => setStatus('')}
          >
            Tous
          </button>
          {STATUSES.map((option) => (
            <button
              key={option.value}
              type="button"
              className={status === option.value ? 'active' : ''}
              onClick={() => setStatus(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {/* La vue par collaborateur : mes tickets d'abord — c'est le tri
            quotidien —, la file entière et les non-affectés ensuite, puis
            chaque collègue pour couvrir une absence. */}
        <select
          className="atk-assigned"
          value={assigned}
          onChange={(event) => setAssigned(event.target.value)}
          aria-label="Filtrer par collaborateur"
        >
          <option value="">Tous les tickets</option>
          <option value="me">Mes tickets</option>
          <option value="none">Non affectés</option>
          {agents.map((agent) => (
            <option key={agent.id} value={String(agent.id)}>
              {agentLabel(agent)}
            </option>
          ))}
        </select>
        <select
          className="atk-assigned"
          value={menuFilter}
          onChange={(event) => setMenuFilter(event.target.value)}
          aria-label="Filtrer par menu applicatif"
        >
          <option value="">Tous les menus</option>
          <option value="none">Non triés</option>
          {options.menus.map((menu) => (
            <option key={menu.key} value={menu.key}>{menu.label}</option>
          ))}
        </select>
        <select
          className="atk-assigned"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          aria-label="Filtrer par type"
        >
          <option value="">Tous les types</option>
          <option value="none">Non typés</option>
          {options.types.map((type) => (
            <option key={type.key} value={type.key}>{type.label}</option>
          ))}
        </select>
        <input
          type="search"
          className="atk-search"
          placeholder="Référence, sujet ou adresse…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Rechercher un ticket"
        />
      </div>

      {/* Vues enregistrées : une combinaison de filtres sous un nom, propre à
          chaque agent. La vue s'applique d'un clic ; « Enregistrer » fige les
          filtres COURANTS — on compose d'abord, on nomme ensuite. */}
      <div className="atk-views" role="group" aria-label="Vues enregistrées">
        {views.map((view) => (
          <span key={view.id} className="atk-view-chip">
            <button type="button" onClick={() => applyView(view)}>{view.name}</button>
            <button
              type="button"
              className="atk-view-del"
              aria-label={`Supprimer la vue ${view.name}`}
              onClick={() => deleteView(view)}
            >
              ✕
            </button>
          </span>
        ))}
        <button type="button" className="atk-view-save" onClick={saveCurrentView}>
          + Enregistrer la vue courante
        </button>
        <button
          type="button"
          className="atk-view-save"
          onClick={() => setShowMacros((v) => !v)}
        >
          {showMacros ? 'Fermer les macros' : 'Macros…'}
        </button>
      </div>

      {showMacros && (
        <MacroManager
          macros={macros}
          setMacros={setMacros}
          statuses={options.macro_statuses}
          writable={writable}
          onError={(message) => setError(message)}
        />
      )}

      {error && <div className="atk-alert">{error}</div>}

      <div className="atk-layout">
        <section className="atk-list" aria-label="File des tickets">
          {loading ? (
            <p className="atk-empty">Chargement…</p>
          ) : tickets.length === 0 ? (
            <p className="atk-empty">Aucun ticket pour ce filtre.</p>
          ) : (
            <ul>
              {tickets.map((ticket) => (
                <li key={ticket.public_ref}>
                  <button
                    type="button"
                    className={
                      selected?.public_ref === ticket.public_ref ? 'atk-row active' : 'atk-row'
                    }
                    onClick={() => openTicket(ticket.public_ref)}
                  >
                    <span className="atk-row__top">
                      <span className="atk-ref">{ticket.public_ref}</span>
                      <StatusBadge status={ticket.status} />
                    </span>
                    {/* Titre interne AU-DESSUS du titre client : c'est lui qui
                        porte le vocabulaire de classement, donc lui qu'on
                        balaye. Le titre client reste sous les yeux — il faut
                        pouvoir reconnaître la demande telle que le demandeur la
                        nomme quand il appelle. */}
                    {ticket.internal_subject &&
                      ticket.internal_subject !== ticket.subject && (
                        <span className="atk-row__internal">{ticket.internal_subject}</span>
                      )}
                    <span className="atk-row__subject">{ticket.subject}</span>
                    <span className="atk-row__meta">
                      {ticket.email}
                      {' · '}
                      {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                      {ticket.priority === 'HAUTE' && (
                        <span className="atk-high"> · priorité haute</span>
                      )}
                      {' · '}
                      {waitingFor(ticket.last_message_at)}
                      {!ticket.user_id && <span className="atk-anon"> · sans compte</span>}
                      {ticket.assignee && (
                        <span className="atk-assignee"> · {agentLabel(ticket.assignee)}</span>
                      )}
                      {ticket.app_menu && (
                        <span className="atk-triage-tag">
                          {' · '}
                          {options.menus.find((m) => m.key === ticket.app_menu)?.label ?? ticket.app_menu}
                        </span>
                      )}
                      {ticket.ticket_type && (
                        <span className="atk-triage-tag">
                          {' · '}
                          {options.types.find((t) => t.key === ticket.ticket_type)?.label ?? ticket.ticket_type}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="atk-detail" aria-label="Ticket sélectionné">
          {!selected ? (
            <p className="atk-empty">Sélectionnez un ticket.</p>
          ) : (
            <>
              <header className="atk-detail__head">
                <div className="atk-titles">
                  {/* Deux champs, deux publics. Le libellé de chacun le dit,
                      parce que se tromper de champ n'a pas les mêmes suites :
                      renommer le titre client modifie ce qu'il relit. */}
                  <label className="atk-title-field">
                    <span>Titre interne — invisible du client</span>
                    <input
                      value={internalTitle}
                      maxLength={200}
                      placeholder="Non renseigné"
                      disabled={busy || !writable}
                      onChange={(event) => setInternalTitle(event.target.value)}
                      onBlur={() => saveTitles()}
                    />
                  </label>
                  <label className="atk-title-field atk-title-field--client">
                    <span>Titre client — visible de lui</span>
                    <input
                      value={clientTitle}
                      maxLength={200}
                      disabled={busy || !writable}
                      onChange={(event) => setClientTitle(event.target.value)}
                      onBlur={() => saveTitles()}
                    />
                  </label>
                  <p className="atk-detail__meta">
                    <span className="atk-ref">{selected.public_ref}</span>
                    {' · '}
                    {selected.email}
                    {' · '}
                    ouvert le {formatDate(selected.created_at)}
                    {selected.company_id
                      ? ` · société #${selected.company_id}`
                      : ' · aucun dossier rattaché'}
                  </p>
                </div>
                <div className="atk-detail__side">
                  <StatusBadge status={selected.status} />
                  {/* L'affectation vit dans l'en-tête du ticket : c'est une
                      propriété du dossier, pas un message du fil. */}
                  <label className="atk-assign">
                    <span>Affecté à</span>
                    <select
                      value={selected.assigned_admin_id ?? ''}
                      disabled={busy || !writable}
                      onChange={(event) => assignTicket(event.target.value)}
                    >
                      <option value="">— personne —</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={String(agent.id)}>
                          {agentLabel(agent)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="atk-assign">
                    <span>Menu</span>
                    <select
                      value={selected.app_menu ?? ''}
                      disabled={busy || !writable}
                      onChange={(event) => triageTicket({ app_menu: event.target.value || null })}
                    >
                      <option value="">— non trié —</option>
                      {options.menus.map((menu) => (
                        <option key={menu.key} value={menu.key}>{menu.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="atk-assign">
                    <span>Type</span>
                    <select
                      value={selected.ticket_type ?? ''}
                      disabled={busy || !writable}
                      onChange={(event) => triageTicket({ ticket_type: event.target.value || null })}
                    >
                      <option value="">— non typé —</option>
                      {options.types.map((type) => (
                        <option key={type.key} value={type.key}>{type.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </header>

              <ol className="atk-thread">
                {selected.messages?.map((message) => (
                  <li
                    key={message.id}
                    className={[
                      'atk-message',
                      `atk-message--${message.author_type.toLowerCase()}`,
                      message.is_internal ? 'atk-message--internal' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <header>
                      <strong>
                        {message.author_type === 'AGENT' ? 'Support' : 'Client'}
                      </strong>
                      {message.is_internal && (
                        <span className="atk-internal-tag">note interne — non visible du client</span>
                      )}
                      <time dateTime={message.created_at}>{formatDate(message.created_at)}</time>
                    </header>
                    <p>{message.body}</p>
                    {message.attachments?.length > 0 && (
                      <ul className="atk-files">
                        {message.attachments.map((file) => (
                          <li key={file.id}>
                            {file.filename} ({Math.round(file.size_bytes / 1024)} Ko)
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>

              {!writable && !accessLoading && (
                <p className="atk-readonly">
                  Profil de consultation&nbsp;: répondre et changer le statut sont
                  désactivés.
                </p>
              )}

              <form
                className={internal ? 'atk-reply atk-reply--internal' : 'atk-reply'}
                onSubmit={send}
              >
                <div className="atk-reply__head">
                  <label htmlFor="atk-body">
                    {internal ? 'Note interne' : 'Réponse au client'}
                  </label>
                  {macros.length > 0 && (
                    /* La macro REMPLIT la zone — rien ne part sans relecture.
                       Le select revient sur son libellé après application :
                       c'est un geste, pas un état. */
                    <select
                      className="atk-macro-select"
                      value=""
                      disabled={busy || !writable}
                      aria-label="Insérer une macro"
                      onChange={(event) => {
                        const macro = macros.find((m) => String(m.id) === event.target.value);
                        applyMacro(macro);
                      }}
                    >
                      <option value="">Macros…</option>
                      {macros.filter((m) => m.scope === 'GLOBAL').length > 0 && (
                        <optgroup label="Équipe">
                          {macros.filter((m) => m.scope === 'GLOBAL').map((m) => (
                            <option key={m.id} value={String(m.id)}>{m.title}</option>
                          ))}
                        </optgroup>
                      )}
                      {macros.filter((m) => m.scope === 'MINE').length > 0 && (
                        <optgroup label="Mes macros">
                          {macros.filter((m) => m.scope === 'MINE').map((m) => (
                            <option key={m.id} value={String(m.id)}>{m.title}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )}
                </div>
                <textarea
                  id="atk-body"
                  rows={5}
                  value={reply}
                  onChange={(event) => setReply(event.target.value)}
                  disabled={busy || !writable}
                />
                <div className="atk-reply__actions">
                  <div className="atk-checks">
                    <label className="atk-check">
                      <input
                        type="checkbox"
                        checked={internal}
                        onChange={(event) => setInternal(event.target.checked)}
                        disabled={busy || !writable}
                      />
                      Note interne
                    </label>
                    {/* Verrou : une note interne ne prévient jamais. La case est
                        neutralisée plutôt que masquée — la voir décochée et
                        grisée dit POURQUOI aucun email ne partira, alors qu'une
                        case disparue laisse la question ouverte. */}
                    <label className="atk-check">
                      <input
                        type="checkbox"
                        checked={notify && !internal}
                        onChange={(event) => setNotify(event.target.checked)}
                        disabled={busy || !writable || internal}
                      />
                      Prévenir le client
                    </label>
                  </div>
                  <button type="submit" disabled={busy || !writable || !reply.trim()}>
                    {busy ? 'Envoi…' : internal ? 'Enregistrer la note' : 'Répondre'}
                  </button>
                </div>
                {macroStatus && !internal && (
                  <p className="atk-hint atk-macro-status">
                    À l’envoi, la macro passera le ticket en « {STATUS_LABELS[macroStatus] ?? macroStatus} ».{' '}
                    <button type="button" className="atk-link" onClick={() => setMacroStatus('')}>
                      Ne pas changer le statut
                    </button>
                  </p>
                )}
                <p className="atk-hint">
                  {internal
                    ? 'Visible du support uniquement. Ne change ni le statut, ni la place du ticket dans la file, et n’envoie aucun email.'
                    : notify
                      ? 'Le ticket passe en « en attente client », qui reçoit un email l’invitant à consulter sa demande. Le contenu de la réponse n’est pas recopié dans l’email.'
                      : 'Le ticket passe en « en attente client », mais aucun email ne part : il ne verra la réponse qu’en revenant de lui-même.'}
                </p>
                {lastNotified === true && (
                  <p className="atk-sent">Réponse envoyée, client prévenu par email.</p>
                )}
                {lastNotified === false && (
                  <p className="atk-not-sent">
                    Réponse enregistrée, mais l’email n’est pas parti — SMTP indisponible
                    ou adresse d’expédition refusée par le relais. Le client ne sait pas
                    qu’une réponse l’attend.
                  </p>
                )}
              </form>

              <div className="atk-actions">
                <label htmlFor="atk-status">Statut</label>
                <select
                  id="atk-status"
                  value={selected.status}
                  disabled={busy || !writable}
                  onChange={(event) => changeStatus(event.target.value, null)}
                >
                  {STATUSES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <label htmlFor="atk-priority">Priorité</label>
                <select
                  id="atk-priority"
                  value={selected.priority}
                  disabled={busy || !writable}
                  onChange={(event) => changeStatus(null, event.target.value)}
                >
                  {PRIORITIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className="atk-secondary"
                  onClick={resendLink}
                  disabled={busy || !writable}
                  title="Le client ne peut pas le redemander lui-même"
                >
                  Renvoyer le lien de suivi
                </button>

                <p className="atk-hint">
                  Passer à « résolu » ou « clos » fait expirer le lien de suivi du
                  client 30 jours plus tard. Renvoyer un lien périme le précédent.
                </p>

                {resent?.sent === true && (
                  <p className="atk-sent">Nouveau lien envoyé à {resent.email}.</p>
                )}
                {resent?.sent === false && (
                  <p className="atk-not-sent">
                    Le lien a bien été régénéré — donc l’ancien ne fonctionne plus —
                    mais l’email n’est pas parti. Le client n’a plus d’accès tant qu’un
                    envoi n’a pas abouti.
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* La carte lit /admin/platform/settings (menu Ouverture) : un rôle
          Support n'y a pas accès, on ne lui montre pas une carte en erreur.
          Les DÉLAIS d'auto-clôture, eux, n'apparaissent qu'aux owners — le
          serveur le refuse de toute façon (manage_admins). */}
      {hasMenu('OUVERTURE') && (
        <SupportSettings writable={writable} canTuneDelays={manageAdmins} />
      )}
    </div>
  );
}

export default AdminSupportTicketsPage;
