import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { configureHttp, installFetchAuthInterceptor } from '@semplyadmin/http'
import { API_BASE } from './lib/apiBase.js'
import { installErrorReporter } from './lib/errorReporter.js'
import { ErrorBoundary } from './components/ErrorBoundary.jsx'
import { theme } from './theme.js'
import './styles/tailwind.css'
import './styles/styles.css'
import AdminApp from './shell/AdminApp.jsx'

// Point d'entrée du back-office de la suite.
//
// `apiBase` vise le RELAIS et non une API de produit : le navigateur ne
// détient aucun jeton, seul le cookie de session du back-office l'accompagne.
// Aucun `scopeHeaders` n'est passé — le point d'injection n'existe même plus
// dans @semplyadmin/http, un compte d'administration n'ayant pas de société
// active.
configureHttp({ apiBase: API_BASE })

installFetchAuthInterceptor()
// Erreurs hors rendu (promesses rejetées, gestionnaires d'événements) :
// ErrorBoundary ne voit que le rendu, or l'essentiel du code d'une application
// de gestion vit ailleurs.
installErrorReporter()
theme.start()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <AdminApp />
    </ErrorBoundary>
  </StrictMode>
)
