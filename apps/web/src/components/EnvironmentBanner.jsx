import React, { useEffect, useState } from 'react';
import { apiFetch } from '@semplyadmin/http';
import './EnvironmentBanner.css';

/**
 * Bandeau permanent indiquant SUR QUEL ENVIRONNEMENT on administre.
 *
 * Le back-office est un build unique déployé sur plusieurs domaines
 * (`admin.semply.fr` → production, `adminv2.semply.fr` → recette appv2). Les
 * deux écrans sont identiques au pixel près alors qu'ils écrivent dans des
 * bases différentes : sans repère, « fermer les inscriptions pour tester »
 * peut fermer les inscriptions des vrais clients.
 *
 * L'information vient de l'API (`/health/environment`), donc du processus qui
 * tient réellement la connexion à la base — pas de l'URL, qui ne dit que le
 * vhost nginx atteint, ni d'une variable de build, qui ne dit que ce qu'on
 * croyait déployer. L'hôte de la base est affiché en clair : c'est lui qui
 * atteste que la recette ne pointe pas sur la production.
 *
 * Monté au-dessus du routeur, il est donc visible AUSSI sur l'écran de
 * connexion — le moment où le repère est le plus utile.
 *
 * Repli : si l'appel échoue, on affiche « environnement inconnu » en rouge.
 * Une panne réseau ne doit jamais produire un écran rassurant.
 */

const UNKNOWN = { env: 'inconnu', label: 'ENVIRONNEMENT INCONNU', production: true };

export function EnvironmentBanner() {
  const [info, setInfo] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/health/environment')
      .then((res) => (res.ok ? res.json() : UNKNOWN))
      .then((data) => {
        if (!cancelled) setInfo(data?.label ? data : UNKNOWN);
      })
      .catch(() => {
        if (!cancelled) setInfo(UNKNOWN);
      });
    return () => { cancelled = true; };
  }, []);

  // Le titre d'onglet aussi : c'est ce qu'on lit quand six onglets sont
  // ouverts, et c'est là qu'on se trompe de fenêtre.
  useEffect(() => {
    if (!info) return;
    document.title = `[${info.label}] SEmply — Administration`;
  }, [info]);

  // Rien tant qu'on ne sait pas : un bandeau qui change de couleur après coup
  // se lit moins bien qu'un bandeau qui apparaît une fois.
  if (!info) return null;

  return (
    <div
      className={`env-banner${info.production ? ' env-banner--prod' : ''}`}
      role="status"
    >
      <span className="env-banner__label">{info.label}</span>
      <span className="env-banner__text">
        {info.production
          ? 'Données réelles : toute modification est visible par les clients.'
          : 'Environnement de recette — sans effet sur la production.'}
      </span>
      {/* L'hôte de la base : le seul élément qui distingue vraiment deux
          back-offices par ailleurs identiques. */}
      {info.database && <code className="env-banner__db">{info.database}</code>}
    </div>
  );
}

export default EnvironmentBanner;
