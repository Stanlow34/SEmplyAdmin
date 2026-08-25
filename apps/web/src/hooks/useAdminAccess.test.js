import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { configureHttp, resetHttpConfig } from '@semplyadmin/http'
import { useAdminAccess, resetAdminAccessCache } from './useAdminAccess.js'

const API_BASE = 'https://adminv2.test.local/api'

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

/** Réponse type de /admin/access depuis le modèle par rôles (22/08/2026). */
const OWNER_ACCESS = {
  is_superadmin: true,
  role: { key: 'OWNER', name: 'Owner', builtin: true, manage_admins: true },
  menus: ['DASHBOARD', 'TICKETS', 'UTILISATEURS'],
  manage_admins: true,
}

beforeEach(() => {
  resetHttpConfig()
  resetAdminAccessCache()
  configureHttp({ apiBase: API_BASE })
})

afterEach(() => {
  vi.unstubAllGlobals()
  resetAdminAccessCache()
  resetHttpConfig()
})

describe('useAdminAccess', () => {
  it('interroge /admin/access, et non l’ancienne route sans garde', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(OWNER_ACCESS))))

    renderHook(() => useAdminAccess())

    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(fetch.mock.calls[0][0]).toBe(`${API_BASE}/admin/access`)
  })

  it('expose le rôle et ses menus', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(
        jsonResponse({
          is_superadmin: true,
          role: { key: 'SUPPORT', name: 'Support', builtin: true, manage_admins: false },
          menus: ['TICKETS', 'SESSION_SUPPORT', 'SECURITE'],
          manage_admins: false,
        }),
      ),
    ))

    const { result } = renderHook(() => useAdminAccess())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isSuperAdmin).toBe(true)
    expect(result.current.roleName).toBe('Support')
    expect(result.current.hasMenu('TICKETS')).toBe(true)
    expect(result.current.hasMenu('CATALOGUE')).toBe(false)
    expect(result.current.manageAdmins).toBe(false)
    // Compatibilité : dans le modèle par menus, avoir le menu = tout y faire.
    expect(result.current.can('write')).toBe(true)
  })

  /**
   * Le cas qui justifie ce hook plutôt qu'un simple `fetch` : SuperAdminGuard
   * ne renvoie MFA_REQUIRED qu'APRÈS avoir vérifié `is_superadmin`. Le
   * confondre avec un refus afficherait « accès refusé » à quelqu'un qui n'a
   * qu'un appairage TOTP à faire.
   */
  it('distingue « habilité, 2FA manquante » d’un vrai refus', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(jsonResponse({ statusCode: 403, error: 'MFA_REQUIRED', message: '…' }, 403)),
    ))

    const { result } = renderHook(() => useAdminAccess())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.mfaRequired).toBe(true)
    expect(result.current.isSuperAdmin).toBe(false)
    expect(result.current.can('write')).toBe(false)
    expect(result.current.hasMenu('SECURITE')).toBe(false)
  })

  it('traite un 403 ordinaire comme un refus, sans signaler la 2FA', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve(jsonResponse({ statusCode: 403, message: 'Réservé au super admin' }, 403)),
    ))

    const { result } = renderHook(() => useAdminAccess())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.mfaRequired).toBe(false)
    expect(result.current.isSuperAdmin).toBe(false)
  })

  it('ne demande le profil qu’une fois, même monté par plusieurs écrans', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(OWNER_ACCESS))))

    const a = renderHook(() => useAdminAccess())
    const b = renderHook(() => useAdminAccess())

    await waitFor(() => expect(a.result.current.loading).toBe(false))
    await waitFor(() => expect(b.result.current.loading).toBe(false))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ne laisse pas le rôle survivre à une déconnexion', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse(OWNER_ACCESS))))

    const first = renderHook(() => useAdminAccess())
    await waitFor(() => expect(first.result.current.loading).toBe(false))

    resetAdminAccessCache()

    const second = renderHook(() => useAdminAccess())
    await waitFor(() => expect(second.result.current.loading).toBe(false))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('reste silencieux si le réseau tombe, plutôt que de faire planter l’écran', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('réseau'))))

    const { result } = renderHook(() => useAdminAccess())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.isSuperAdmin).toBe(false)
    expect(result.current.menus).toEqual([])
  })
})
