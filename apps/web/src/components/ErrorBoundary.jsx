import React from 'react'
import { reportClientError } from '../lib/errorReporter.js'

// Frontière d'erreur : capture les exceptions de rendu d'un sous-arbre React
// et affiche un écran de repli au lieu d'une page blanche.
// Point de branchement prévu pour un service de reporting (Sentry, etc.).
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Remontée vers l'API : sans elle, cette erreur n'existait que dans la
    // console du poste de l'utilisateur. On n'apprenait les pannes que par les
    // clients qui appellent — une fraction d'entre elles, et toujours en retard.
    //
    // `componentStack` accompagne la pile JavaScript : c'est lui qui dit QUEL
    // écran a cassé, là où la pile ne donne que le fichier compilé.
    reportClientError('render', error, { componentStack: info?.componentStack })
    console.error('[ErrorBoundary]', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback({ error: this.state.error, reset: this.handleReset })
        : this.props.fallback
    }

    return (
      <div
        role="alert"
        style={{
          maxWidth: 520,
          margin: '48px auto',
          padding: 24,
          textAlign: 'center',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <h2 style={{ marginBottom: 12 }}>Une erreur est survenue</h2>
        <p style={{ marginBottom: 20, opacity: 0.8 }}>
          Quelque chose s'est mal passé de notre côté. Vous pouvez réessayer ou
          recharger la page.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button type="button" onClick={this.handleReset}>
            Réessayer
          </button>
          <button type="button" onClick={() => window.location.reload()}>
            Recharger la page
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
