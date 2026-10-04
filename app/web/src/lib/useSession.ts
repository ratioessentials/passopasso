import { useEffect, useState } from 'react'
import { api, sessionZero } from '../api/client'
import { useStore } from './store'

/** Seduta dalla cache dello store, oppure dal server. */
export function useSession(id: string | undefined) {
  const { sessions, putSession } = useStore()
  const cached = id ? sessions[id] : undefined
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!id || cached) return
    // 'zero' è la seduta di prova da 5 minuti, senza onboarding
    const load = id === 'zero' ? sessionZero().then((s) => ({ ...s, id: 'zero' })) : api.session(id)
    load.then(putSession).catch((e: Error) => setError(e.message))
  }, [id, cached, putSession])
  return { session: cached ?? null, error }
}

export const amountLabel = (it: { reps?: number; seconds?: number; sets: number }) => {
  const a = it.seconds ? (it.seconds >= 120 ? `${Math.round(it.seconds / 60)} min` : `${it.seconds} s`) : `${it.reps ?? 0} ripetizioni`
  return it.sets > 1 ? `${it.sets} × ${a}` : a
}
