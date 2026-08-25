import { create } from 'zustand'

// Système de notifications non bloquant (remplace les alert() natifs).
// Usage : import { toast } from './toastStore.js'
//         toast.error(message) / toast.success(message) / toast.info(message)

let nextId = 1

export const useToastStore = create((set, get) => ({
  toasts: [],
  add: (message, type = 'info', duration) => {
    const id = nextId++
    const ttl = duration ?? (type === 'error' ? 7000 : 4000)
    set((s) => ({ toasts: [...s.toasts, { id, message: String(message ?? ''), type }] }))
    if (ttl > 0) setTimeout(() => get().remove(id), ttl)
    return id
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))

export const toast = {
  info: (message, opts) => useToastStore.getState().add(message, 'info', opts?.duration),
  success: (message, opts) => useToastStore.getState().add(message, 'success', opts?.duration),
  warning: (message, opts) => useToastStore.getState().add(message, 'warning', opts?.duration),
  error: (message, opts) => useToastStore.getState().add(message, 'error', opts?.duration),
}
