import { createPortal } from 'react-dom'
import { useToastStore } from './toastStore.js'

const STYLES = {
  info: { bg: '#eff6ff', border: 'var(--color-info)', fg: '#1e3a8a' },
  success: { bg: '#f0fdf4', border: '#16a34a', fg: '#14532d' },
  warning: { bg: '#fffbeb', border: 'var(--color-warning)', fg: '#78350f' },
  error: { bg: '#fef2f2', border: 'var(--color-danger)', fg: '#7f1d1d' },
}

// Conteneur d'affichage des toasts, monté une seule fois (via portail body).
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const remove = useToastStore((s) => s.remove)

  if (typeof document === 'undefined') return null

  return createPortal(
    <div
      style={{
        position: 'fixed',
        top: 16,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 380,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const s = STYLES[t.type] ?? STYLES.info
        return (
          <div
            key={t.id}
            role="alert"
            onClick={() => remove(t.id)}
            style={{
              pointerEvents: 'auto',
              cursor: 'pointer',
              background: s.bg,
              color: s.fg,
              border: `1px solid ${s.border}`,
              borderLeft: `4px solid ${s.border}`,
              borderRadius: 8,
              padding: '10px 14px',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '0.875rem',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            }}
            title="Cliquer pour fermer"
          >
            {t.message}
          </div>
        )
      })}
    </div>,
    document.body
  )
}

export default Toaster
