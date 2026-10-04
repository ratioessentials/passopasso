// Stato condiviso dell'inbox (lista e badge della tab bar leggono gli stessi dati).
import { useEffect, useSyncExternalStore } from 'react'
import { inboxApi, type CoachMessage } from '../../api/inbox'
import { getUserId } from '../../api/client'

interface InboxState { messages: CoachMessage[]; unread: number; loaded: boolean; error: string | null }

let state: InboxState = { messages: [], unread: 0, loaded: false, error: null }
const listeners = new Set<() => void>()
let inflight: Promise<void> | null = null
let lastLoad = 0

function set(patch: Partial<InboxState>) {
  state = { ...state, ...patch }
  listeners.forEach((l) => l())
}

const countUnread = (m: CoachMessage[]) => m.filter((x) => !x.read).length

export function setMessages(messages: CoachMessage[]) {
  set({ messages, unread: countUnread(messages), loaded: true, error: null })
}

/** Carica l'inbox (una sola richiesta alla volta; `force` ignora la cache di 30 s). */
export function loadInbox(force = false): Promise<void> {
  if (!getUserId()) return Promise.resolve()
  if (inflight) return inflight
  if (!force && state.loaded && Date.now() - lastLoad < 30_000) return Promise.resolve()
  inflight = inboxApi.list()
    .then((r) => { lastLoad = Date.now(); setMessages(r.messages ?? []) })
    .catch((e: Error) => set({ error: e.message, loaded: true }))
    .finally(() => { inflight = null })
  return inflight
}

export function prepend(m: CoachMessage) {
  setMessages([m, ...state.messages.filter((x) => x.id !== m.id)])
}

export async function markRead(id: string) {
  const m = state.messages.find((x) => x.id === id)
  if (!m || m.read) return
  setMessages(state.messages.map((x) => (x.id === id ? { ...x, read: true } : x)))
  try { await inboxApi.markRead(id) } catch { /* resta letto in locale: non vale un errore */ }
}

export function clearActions(id: string) {
  setMessages(state.messages.map((x) => (x.id === id ? { ...x, read: true, actions: [] } : x)))
}

export function useInbox(): InboxState {
  const s = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb) } }, () => state, () => state)
  useEffect(() => {
    void loadInbox()
    // si ricarica quando /api/me viene riletto (dopo seduta, skip, azioni del coach)
    const onRefresh = () => void loadInbox(true)
    window.addEventListener('passopasso:refresh', onRefresh)
    return () => window.removeEventListener('passopasso:refresh', onRefresh)
  }, [])
  return s
}
