import React, { useCallback, useEffect, useState } from 'react';
import { apiFetch, startGoogleReauth, consumeReauthResult } from '@semplyadmin/http'
import './TwoFactorTab.css';

/**
 * Activation / désactivation de la double authentification (TOTP).
 *
 * Trois états : inactive → appairage en cours (QR affiché) → active.
 * Les codes de secours ne sont affichés qu'UNE fois, juste après l'activation
 * ou une régénération : le serveur n'en garde que des empreintes.
 *
 * Le TOTP est obligatoire pour accéder à l'administration de la plateforme :
 * l'API le signale via `required`, ce qui déclenche l'encart d'avertissement.
 *
 * Comptes créés via Google : ils n'ont aucun mot de passe utilisable
 * (`hasUsablePassword` faux). Leur demander « votre mot de passe » pour retirer
 * le second facteur était une impasse — la confirmation passe alors par un
 * aller-retour Google, d'où la redirection et la lecture de `?reauth=` au
 * retour.
 */
function TwoFactorTab() {
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);       // { qrCode, secret, otpauthUrl }
  const [backupCodes, setBackupCodes] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [reauthDone, setReauthDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const call = useCallback(async (path, body) => {
    const res = await apiFetch(path, {
      method: body ? 'POST' : 'GET',
      ...(body && {
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`);
    return data;
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const next = await call('/auth/totp/status');
      setStatus(next);
      // Le cookie de preuve est httpOnly : son état ne peut venir que du
      // serveur. On le relit à chaque chargement pour qu'une preuve expirée ou
      // déjà consommée ramène bien le bouton « Confirmer avec Google ».
      if (next.hasUsablePassword === false) {
        const { confirmed } = await call('/auth/reauth/status');
        setReauthDone(Boolean(confirmed));
      }
    } catch (e) {
      setError(String(e.message ?? e));
    }
  }, [call]);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  /**
   * Retour du tour Google : rouvre le formulaire que la navigation a fermé.
   * `reauthDone` lui-même ne vient PAS de ce paramètre mais de
   * /auth/reauth/status — le cookie de preuve est httpOnly, et lui seul fait foi.
   */
  useEffect(() => {
    const reauth = consumeReauthResult();
    if (!reauth) return;

    if (reauth === 'ok') {
      setDisabling(true);
      setNotice('Identité confirmée. Saisissez votre code pour désactiver.');
    } else {
      setError("La confirmation Google a échoué. Vérifiez d’avoir choisi le compte associé à SEmply.");
    }
  }, []);

  const startSetup = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      setSetup(await call('/auth/totp/setup', {}));
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const confirmSetup = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const { backupCodes: codes } = await call('/auth/totp/enable', { code: code.trim() });
      setBackupCodes(codes);
      setSetup(null);
      setCode('');
      setNotice('Double authentification activée.');
      await loadStatus();
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    if (!window.confirm('Régénérer les codes de secours ? Les anciens seront invalidés.')) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const { backupCodes: codes } = await call('/auth/totp/backup-codes', {});
      setBackupCodes(codes);
      setNotice('Nouveaux codes de secours générés.');
      await loadStatus();
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e) => {
    e.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      // `password` n'est pas envoyé pour un compte Google : la preuve voyage
      // dans le cookie `reauth_token`, posé au retour de la redirection.
      await call('/auth/totp/disable', {
        ...(status?.hasUsablePassword !== false && { password }),
        code: code.trim(),
      });
      setPassword(''); setCode(''); setDisabling(false); setReauthDone(false);
      setNotice('Double authentification désactivée.');
      await loadStatus();
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  if (!status) return <div className="tfa-panel"><p>Chargement…</p></div>;

  return (
    <div className="tfa-panel">
      <h2>Double authentification</h2>
      <p className="tfa-intro">
        Un code à usage unique, généré par votre téléphone, s’ajoute à votre mot de passe.
        Compatible Google Authenticator, Authy, 1Password, Bitwarden…
      </p>

      {status.required && !status.enabled && (
        <div className="tfa-warning">
          <strong>Requis pour votre compte.</strong> L’administration de la plateforme
          reste inaccessible tant que la double authentification n’est pas activée.
        </div>
      )}

      {error && <div className="tfa-error">{error}</div>}
      {notice && <div className="tfa-notice">{notice}</div>}

      {/* ————— Codes de secours (affichés une seule fois) ————— */}
      {backupCodes && (
        <div className="tfa-backup">
          <h3>Vos codes de secours</h3>
          <p>
            Conservez-les hors ligne : chacun ne fonctionne <strong>qu’une fois</strong>, et ils
            ne seront <strong>plus jamais affichés</strong>. Ils permettent de vous connecter si
            vous perdez votre téléphone.
          </p>
          <ul className="tfa-backup-list">
            {backupCodes.map((c) => <li key={c}><code>{c}</code></li>)}
          </ul>
          <div className="tfa-actions">
            <button
              type="button"
              className="tfa-btn"
              onClick={() => navigator.clipboard?.writeText(backupCodes.join('\n'))}
            >
              Copier
            </button>
            <button type="button" className="tfa-btn primary" onClick={() => setBackupCodes(null)}>
              J’ai noté ces codes
            </button>
          </div>
        </div>
      )}

      {/* ————— Appairage en cours ————— */}
      {setup && (
        <div className="tfa-setup">
          <h3>1. Scannez ce QR code</h3>
          <img className="tfa-qr" src={setup.qrCode} alt="QR code d’appairage" />
          <p className="tfa-secret">
            Impossible de scanner ? Saisissez cette clé manuellement :<br />
            <code>{setup.secret}</code>
          </p>

          <h3>2. Saisissez le code affiché</h3>
          <form className="tfa-form" onSubmit={confirmSetup}>
            <input
              required
              autoFocus
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
            <button type="submit" className="tfa-btn primary" disabled={busy}>
              {busy ? 'Vérification…' : 'Activer'}
            </button>
            <button
              type="button"
              className="tfa-btn"
              onClick={() => { setSetup(null); setCode(''); }}
              disabled={busy}
            >
              Annuler
            </button>
          </form>
        </div>
      )}

      {/* ————— État courant ————— */}
      {!setup && (
        status.enabled ? (
          <div className="tfa-state">
            <p className="tfa-status on">
              <span className="tfa-dot" /> Activée
              {status.confirmedAt && ` depuis le ${new Date(status.confirmedAt).toLocaleDateString('fr-FR')}`}
            </p>
            <p className="tfa-muted">
              {status.backupCodesRemaining} code(s) de secours restant(s).
              {status.backupCodesRemaining <= 2 && ' Pensez à les régénérer.'}
            </p>

            {!disabling ? (
              <div className="tfa-actions">
                <button type="button" className="tfa-btn" onClick={regenerate} disabled={busy}>
                  Régénérer les codes de secours
                </button>
                <button type="button" className="tfa-btn danger" onClick={() => setDisabling(true)}>
                  Désactiver
                </button>
              </div>
            ) : (
              <form className="tfa-form column" onSubmit={disable}>
                {status.hasUsablePassword === false ? (
                  <>
                    <p className="tfa-muted">
                      Votre compte se connecte avec Google : confirmez votre identité
                      auprès de Google, puis saisissez un code — une session ouverte
                      ne suffit pas à retirer le second facteur.
                    </p>
                    {reauthDone ? (
                      <p className="tfa-status on">
                        <span className="tfa-dot" /> Identité confirmée avec Google
                      </p>
                    ) : (
                      <button
                        type="button"
                        className="tfa-btn"
                        onClick={() => startGoogleReauth()}
                        disabled={busy}
                      >
                        Confirmer avec Google
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="tfa-muted">
                      Confirmez avec votre mot de passe et un code — une session ouverte
                      ne suffit pas à retirer le second facteur.
                    </p>
                    <input
                      required
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mot de passe"
                    />
                  </>
                )}
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Code à 6 chiffres ou code de secours"
                />
                <div className="tfa-actions">
                  <button
                    type="submit"
                    className="tfa-btn danger"
                    // Sans la confirmation Google, l'API répondrait
                    // REAUTH_REQUIRED : autant ne pas proposer le bouton.
                    disabled={busy || (status.hasUsablePassword === false && !reauthDone)}
                  >
                    {busy ? 'Désactivation…' : 'Confirmer la désactivation'}
                  </button>
                  <button
                    type="button"
                    className="tfa-btn"
                    onClick={() => {
                      setDisabling(false); setPassword(''); setCode(''); setReauthDone(false);
                    }}
                    disabled={busy}
                  >
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="tfa-state">
            <p className="tfa-status off"><span className="tfa-dot" /> Inactive</p>
            <button type="button" className="tfa-btn primary" onClick={startSetup} disabled={busy}>
              {busy ? 'Préparation…' : 'Activer la double authentification'}
            </button>
          </div>
        )
      )}
    </div>
  );
}

export { TwoFactorTab };
