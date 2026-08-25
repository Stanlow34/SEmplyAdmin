import React from 'react';
import { Link } from 'react-router-dom';
import { useAdminAccess } from '../hooks/useAdminAccess.js';
import './AdminDashboardPage.css';

/**
 * Dashboard super admin (/admin) : porte d'entrée vers toutes les sous-pages
 * d'administration de la plateforme.
 *
 * Pour ajouter une nouvelle page admin : une entrée dans ADMIN_PAGES suffit.
 * L'affichage est conditionné au flag superadmin (via useAdminAccess) ; la
 * sécurité réelle reste côté serveur (SuperAdminGuard sur chaque endpoint).
 */

const ADMIN_PAGES = [
  {
    to: '/admin/plans',
    title: 'Catalogue commercial',
    description:
      'Formules et fonctionnalités : prix Stripe, matrice des droits et plafonds par formule (SEmplyApp, Previ, Compta).',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <path d="M2 13h20" />
      </svg>
    ),
  },
  {
    to: '/admin/questions',
    title: "Questionnaire d'onboarding",
    description:
      "Questions posées à la création d'une société : ordre, types de réponses et règles de paramétrage automatique.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    to: '/admin/articles',
    title: 'Articles & conseils',
    description:
      'Rubrique éditoriale de l’application : rédaction, publication et mise à jour des articles (dont le comparatif des plateformes agréées).',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Z" />
        <path d="M18 14h-8" />
        <path d="M15 18h-5" />
        <path d="M10 6h8v4h-8z" />
      </svg>
    ),
  },
  {
    to: '/admin/annuaire',
    title: 'Annuaire de liens',
    description:
      'Ce sur quoi les gens cliquent : classement des liens par source (site, extension, application) et liens que personne n’ouvre.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 16v-5" />
        <path d="M12 16V8" />
        <path d="M17 16v-3" />
      </svg>
    ),
  },
  {
    to: '/admin/plans-comptables',
    title: 'Modèles de plan comptable',
    description:
      'Plans proposés à la création d’un dossier : comptes, normes, activation. Les comptes sont copiés dans la société — modifier un modèle ne touche pas les dossiers existants.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 3h16v18H4z" />
        <path d="M8 7h8" />
        <path d="M8 11h8" />
        <path d="M8 15h5" />
      </svg>
    ),
  },
  {
    to: '/admin/support',
    title: 'Session support',
    description:
      "Consulter l'espace d'un client à partir du code qu'il a communiqué : lecture seule, une société, révocable par lui à tout instant.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" />
        <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
      </svg>
    ),
  },
];

function AdminDashboardPage() {
  const { isSuperAdmin } = useAdminAccess();

  if (!isSuperAdmin) {
    return (
      <div className="adb-page">
        <h1>Administration</h1>
        <p>Cette page est réservée au super admin de la plateforme.</p>
      </div>
    );
  }

  return (
    <div className="adb-page">
      <header className="adb-header">
        <h1>Administration de la plateforme</h1>
        <p className="adb-sub">
          Back-office réservé au super admin. Les modifications faites ici s'appliquent
          à l'ensemble des utilisateurs.
        </p>
      </header>

      <div className="adb-grid">
        {ADMIN_PAGES.map((page) => (
          <Link key={page.to} to={page.to} className="adb-card">
            <span className="adb-card__icon">{page.icon}</span>
            <span className="adb-card__body">
              <span className="adb-card__title">{page.title}</span>
              <span className="adb-card__desc">{page.description}</span>
            </span>
            <span className="adb-card__arrow" aria-hidden="true">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export { AdminDashboardPage };
