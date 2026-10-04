import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { USE_MOCK } from '../../api/client'
import { inboxApi, TRIGGER_LABELS, type CoachAction, type CoachMessage, type CoachTrigger } from '../../api/inbox'
import type { Me } from '../../api/types'
import { useStore } from '../../lib/store'
import { Button, Skeleton } from '../../ui/kit'
import { press, spring } from '../../ui/motion'
import { clearActions, loadInbox, markRead, prepend, setMessages, useInbox } from './store'

const ENTER = { initial: { opacity: 0, y: -28, scale: 0.9 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } } }

function when(date: string) {
  const d = new Date(date)
  const diffH = (Date.now() - d.getTime()) / 3600_000
  if (diffH < 1) return 'adesso'
  if (diffH < 20) return `${Math.round(diffH)} h fa`
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const days = Math.round((today.getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000)
  if (days <= 1) return 'ieri'
  return d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })
}

const isDemo = () => {
  if (USE_MOCK) return true
  try { return new URLSearchParams(window.location.search).has('demo') || localStorage.getItem('passopasso.demo') === '1' } catch { return false }
}

/**
 * I messaggi che il coach scrive da solo (non a calendario, ma quando succede qualcosa).
 * Da mostrare in cima alla tab Coach, sopra la chat. Niente da mostrare → non occupa spazio.
 */
export function CoachInbox({ max = 3, className = '' }: { max?: number; className?: string }) {
  const { messages, loaded, error } = useInbox()
  const [all, setAll] = useState(false)
  const [sim, setSim] = useState(false)
  const demo = isDemo()
  const shown = all ? messages : messages.slice(0, max)

  if (!loaded && !error) return <div className={`px-4 pt-3 ${className}`}><Skeleton className="h-24" /></div>
  if (messages.length === 0 && !demo) return null

  return (
    <div className={`px-4 pt-3 ${className}`}>
      {messages.length > 0 && (
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-acqua">Dal tuo coach</span>
          {messages.length > max && (
            <motion.button whileTap={press} onClick={() => setAll((x) => !x)} className="text-xs font-semibold text-petrolio/70">
              {all ? 'Mostra meno' : `Tutti (${messages.length})`}
            </motion.button>
          )}
        </div>
      )}
      <LayoutGroup>
        <motion.div layout className="space-y-2.5">
          <AnimatePresence initial={false}>
            {shown.map((m) => <InboxItem key={m.id} m={m} />)}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>
      {messages.length === 0 && demo && (
        <p className="px-1 py-2 text-center text-xs text-inchiostro/45">Nessun messaggio: il coach scrive solo quando succede qualcosa.</p>
      )}
      {demo && (
        <div className="mt-1 flex justify-center">
          <motion.button whileTap={press} onClick={() => setSim(true)} className="rounded-full px-3 py-1.5 text-[11px] font-semibold text-inchiostro/35">
            Simula un messaggio
          </motion.button>
        </div>
      )}
      <AnimatePresence>{sim && <SimulateSheet key="sim" onClose={() => setSim(false)} />}</AnimatePresence>
    </div>
  )
}

function InboxItem({ m }: { m: CoachMessage }) {
  const nav = useNavigate()
  const { setMe, loadMe, toast } = useStore()
  const [busy, setBusy] = useState<number | null>(null)

  // dopo qualche secondo in vista il messaggio è letto
  useEffect(() => {
    if (m.read) return
    const t = setTimeout(() => void markRead(m.id), 2500)
    return () => clearTimeout(t)
  }, [m.id, m.read])

  async function act(a: CoachAction, i: number) {
    if (busy !== null) return
    if (a.type === 'open_week') { void markRead(m.id); nav('/settimana'); return }
    if (a.type === 'open_session') { void markRead(m.id); nav('/'); return }
    setBusy(i)
    try {
      const r = await inboxApi.action(m.id, i)
      clearActions(m.id)
      if (r && (r as Me).level) setMe(r as Me)
      else void loadMe()
      toast(a.type === 'move_day' ? 'Settimana riorganizzata' : 'Fatto', '✓')
      void loadInbox(true)
    } catch (e) {
      toast((e as Error).message, '🌿')
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div layout {...ENTER} transition={spring.bouncy} onClick={() => void markRead(m.id)}
      className="relative overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_10px_26px_-16px_rgb(44_105_117/.7)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-salvia/60 blur-2xl" />
      <div className="relative">
        <div className="flex items-start gap-2">
          <AnimatePresence>
            {!m.read && (
              <motion.span key="dot" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0, opacity: 0 }} transition={spring.bouncy}
                className="mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full bg-acqua shadow-[0_0_10px_2px_rgb(104_178_160/.6)]" />
            )}
          </AnimatePresence>
          <p className="min-w-0 flex-1 text-[11.5px] leading-snug text-inchiostro/55">
            Ti scrivo perché {m.because.replace(/^ti scrivo perch[eé]\s*/i, '')}
          </p>
          <span className="shrink-0 text-[11px] text-inchiostro/40">{when(m.date)}</span>
        </div>
        <p className="mt-1.5 text-[15px] leading-snug text-inchiostro">{m.text}</p>
        {m.actions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {m.actions.map((a, i) => (
              <motion.button key={a.label + i} whileTap={press} disabled={busy !== null} onClick={(e) => { e.stopPropagation(); void act(a, i) }}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.15 + i * 0.06 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-petrolio to-[#347c84] px-3.5 py-2 text-[13px] font-semibold text-white shadow-[0_8px_18px_-10px_rgb(44_105_117/.9)] disabled:opacity-60">
                {busy === i ? <motion.span className="h-3.5 w-3.5 rounded-full border-2 border-white/70 border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} /> : null}
                {a.label}
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

const TRIGGERS = Object.keys(TRIGGER_LABELS) as CoachTrigger[]

/** Solo in demo: fa scattare subito un trigger a scelta. */
function SimulateSheet({ onClose }: { onClose: () => void }) {
  const { toast } = useStore()
  const [busy, setBusy] = useState<CoachTrigger | null>(null)

  async function go(t: CoachTrigger) {
    if (busy) return
    setBusy(t)
    try {
      const r = await inboxApi.simulate(t)
      if (r && 'messages' in r && Array.isArray(r.messages)) setMessages(r.messages)
      else if (r && 'id' in r) prepend(r as CoachMessage)
      else await loadInbox(true)
      onClose()
    } catch (e) {
      toast((e as Error).message, '🌿')
    } finally {
      setBusy(null)
    }
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-inchiostro/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.gentle}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 100) onClose() }}
        className="safe-bottom relative max-h-[88%] w-full overflow-y-auto rounded-t-[34px] bg-white px-6 pt-3 shadow-[0_-20px_60px_-20px_rgb(18_49_58/.5)]">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-inchiostro/15" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-acqua">Solo demo</span>
        <h2 className="font-title text-[24px] leading-tight text-inchiostro">Cosa è successo?</h2>
        <p className="mt-1 text-sm text-inchiostro/65">Nella vita vera questi segnali li legge il server ogni 15 minuti. Qui li fai scattare tu.</p>
        <div className="mt-4 flex flex-wrap gap-2 pb-3">
          {TRIGGERS.map((t, i) => (
            <motion.button key={t} whileTap={press} disabled={!!busy} onClick={() => void go(t)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.bouncy, delay: i * 0.03 }}
              className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold ${busy === t ? 'border-petrolio bg-petrolio text-white' : 'border-acqua/50 bg-salvia-chiaro text-petrolio'} disabled:opacity-60`}>
              {busy === t ? 'Il coach scrive…' : TRIGGER_LABELS[t]}
            </motion.button>
          ))}
        </div>
        <div className="pb-4 pt-2"><Button variant="ghost" className="w-full" onClick={onClose}>Chiudi</Button></div>
      </motion.div>
    </motion.div>
  )
}
