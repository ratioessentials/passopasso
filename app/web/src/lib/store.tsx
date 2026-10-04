import { AnimatePresence, motion } from 'motion/react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { api, getUserId } from '../api/client'
import type { LevelUp, Me, Session } from '../api/types'
import { spring } from '../ui/motion'

interface Toast { id: number; text: string; icon?: string }

interface Store {
  me: Me | null
  meError: string | null
  loadMe: () => Promise<Me | null>
  setMe: (m: Me) => void
  /** Sedute già caricate o rigenerate (così il player non le richiede) */
  sessions: Record<string, Session>
  putSession: (s: Session) => void
  toast: (text: string, icon?: string) => void
  levelUp: LevelUp | null
  showLevelUp: (l: LevelUp | null) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null)
  const [meError, setMeError] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Record<string, Session>>({})
  const [toasts, setToasts] = useState<Toast[]>([])
  const [levelUp, showLevelUp] = useState<LevelUp | null>(null)
  const tid = useRef(0)

  const loadMe = useCallback(async () => {
    if (!getUserId()) return null
    try {
      const m = await api.me()
      setMe(m)
      setMeError(null)
      window.dispatchEvent(new Event('passopasso:refresh'))
      if (m.today) setSessions((s) => ({ ...s, [m.today!.id]: m.today! }))
      return m
    } catch (e) {
      setMeError((e as Error).message)
      return null
    }
  }, [])

  const putSession = useCallback((s: Session) => setSessions((x) => ({ ...x, [s.id]: s })), [])
  const toast = useCallback((text: string, icon?: string) => {
    const id = ++tid.current
    setToasts((t) => [...t, { id, text, icon }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }, [])

  useEffect(() => { void loadMe() }, [loadMe])

  const value = useMemo(() => ({ me, meError, loadMe, setMe, sessions, putSession, toast, levelUp, showLevelUp }),
    [me, meError, loadMe, sessions, putSession, toast, levelUp])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top),var(--frame-top,14px))]">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id} layout
              initial={{ y: -40, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0, scale: 0.95 }}
              transition={spring.bouncy}
              className="glass flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-inchiostro shadow-soft"
            >
              {t.icon && <span>{t.icon}</span>}{t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider mancante')
  return s
}
