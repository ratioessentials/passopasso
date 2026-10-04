import { AnimatePresence, LayoutGroup, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Session, SkipReason, Week } from '../api/types'
import { copy } from '../content/copy'
import { useStore } from '../lib/store'
import { Button, ErrorBox, Header, Skeleton } from '../ui/kit'
import { press, spring } from '../ui/motion'
import { BonusBadge } from './Home'

const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const REASONS: { v: SkipReason; label: string; icon: string }[] = [
  { v: 'tempo', label: 'Non ho tempo', icon: '⏰' },
  { v: 'stanchezza', label: 'Sono stanco/a', icon: '😴' },
  { v: 'malessere', label: 'Non mi sento bene', icon: '🤒' },
  { v: 'altro', label: 'Altro', icon: '💭' },
]

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const STATUS: Record<Session['status'], { label: string; dot: string; text: string }> = {
  done: { label: 'Fatta', dot: 'bg-gradient-to-b from-petrolio to-acqua', text: 'text-petrolio' },
  planned: { label: 'In programma', dot: 'bg-white border-2 border-acqua', text: 'text-acqua' },
  skipped: { label: 'Saltata, va bene così', dot: 'bg-salvia', text: 'text-inchiostro/50' },
  blocked: { label: 'Riposo per stare bene', dot: 'bg-salvia', text: 'text-inchiostro/50' },
}

export default function WeekScreen() {
  const nav = useNavigate()
  const { putSession, loadMe } = useStore()
  const [week, setWeek] = useState<Week | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [skipFor, setSkipFor] = useState<Session | null>(null)
  const [busy, setBusy] = useState(false)
  const [restart, setRestart] = useState<{ message: string; s: Session } | null>(null)

  const load = () => api.week().then((w) => { setWeek(w); setError(null) }).catch((e: Error) => setError(e.message))
  useEffect(() => { void load() }, [])

  const todayIso = iso(new Date())
  const start = week ? new Date(week.weekStart + 'T12:00:00') : null
  const days = start ? DAYS.map((d, i) => { const x = new Date(start); x.setDate(x.getDate() + i); return { label: d, iso: iso(x), n: x.getDate() } }) : []

  async function skip(reason: SkipReason) {
    if (!skipFor) return
    setBusy(true)
    try {
      const r = await api.skip(skipFor.id, reason)
      setSkipFor(null)
      setWeek(r.week)
      putSession(r.restart)
      setRestart({ message: r.message || copy['skip.title'], s: r.restart })
      void loadMe()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-tabbar">
      <Header title="La tua settimana" subtitle={week ? `${week.sessions.filter((s) => s.status === 'done').length} sedute fatte su ${week.sessions.length}` : undefined} />
      {error && <ErrorBox message={error} onRetry={load} />}
      {!week && !error && <div className="space-y-3 px-5"><Skeleton className="h-24" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}
      {week && (
        <LayoutGroup>
          {/* pallini della settimana */}
          <div className="glass mx-5 grid grid-cols-7 gap-1 rounded-[26px] p-3 shadow-soft">
            {days.map((d) => {
              const ss = week.sessions.filter((s) => s.date === d.iso)
              const isToday = d.iso === todayIso
              return (
                <div key={d.iso} className={`flex flex-col items-center gap-1.5 rounded-2xl py-2 ${isToday ? 'bg-white shadow-sm' : ''}`}>
                  <span className={`text-[11px] font-semibold ${isToday ? 'text-petrolio' : 'text-inchiostro/50'}`}>{d.label}</span>
                  <span className="font-title text-lg leading-none text-inchiostro">{d.n}</span>
                  <div className="flex h-5 items-center gap-0.5">
                    {ss.length === 0 && <span className="h-1.5 w-1.5 rounded-full bg-inchiostro/15" />}
                    {ss.map((s) => (
                      <motion.span key={s.id} layoutId={`dot-${s.id}`} transition={spring.bouncy}
                        className={`relative h-4 w-4 rounded-full ${STATUS[s.status].dot} ${s.kind === 'ripartenza' ? 'shadow-[0_0_12px_3px_rgb(246_199_107/.8)] !bg-sole !border-sole' : ''}`} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <AnimatePresence>
            {restart && (
              <motion.div initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={spring.bouncy} className="mx-5 mt-4">
                <p className="font-title mb-3 text-center text-[22px] leading-tight text-petrolio">{restart.message}</p>
                <div className="relative overflow-hidden rounded-[26px] bg-gradient-to-b from-petrolio to-acqua p-5 text-white shadow-soft">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-white/80">Ripartenza · {new Date(restart.s.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long' })}</span>
                    <BonusBadge points={restart.s.bonusPoints} />
                  </div>
                  <h3 className="font-title mt-1 text-2xl">{restart.s.title}</h3>
                  <p className="mt-1 text-sm text-white/85">{restart.s.minutes} minuti leggeri. {restart.s.reason ?? 'Completala e la costanza sale di più.'}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* elenco sedute */}
          <div className="mt-5 space-y-2.5 px-5">
            {week.sessions.map((s) => {
              const st = STATUS[s.status]
              const canSkip = s.status === 'planned' && s.date <= todayIso && s.kind !== 'ripartenza'
              const canStart = s.status === 'planned' && s.date <= todayIso
              return (
                <motion.div key={s.id} layout transition={spring.gentle} className="rounded-[22px] bg-white/85 p-4 shadow-[0_8px_20px_-14px_rgb(44_105_117/.6)]">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${st.dot}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs capitalize text-inchiostro/55">{new Date(s.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' })}{s.date === todayIso ? ' · oggi' : ''}</div>
                      <div className="truncate font-semibold text-inchiostro">{s.title}</div>
                      <div className={`text-xs font-semibold ${st.text}`}>{st.label} · {s.minutes} min</div>
                    </div>
                    {s.bonusPoints > 0 && <BonusBadge points={s.bonusPoints} />}
                  </div>
                  {(canSkip || canStart) && (
                    <div className="mt-3 flex gap-2">
                      {canStart && <Button className="flex-1 py-2.5 text-sm" onClick={() => nav(`/checkin/${s.id}`)}>Inizia</Button>}
                      {canSkip && <Button variant="light" className="flex-1 py-2.5 text-sm" onClick={() => setSkipFor(s)}>Oggi non ce la faccio</Button>}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </LayoutGroup>
      )}

      <AnimatePresence>
        {skipFor && (
          <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-inchiostro/40 backdrop-blur-sm" onClick={() => !busy && setSkipFor(null)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.gentle}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 100) setSkipFor(null) }}
              className="safe-bottom relative w-full rounded-t-[34px] bg-white px-6 pt-3 shadow-[0_-20px_60px_-20px_rgb(18_49_58/.5)]">
              <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-inchiostro/15" />
              <h2 className="font-title text-[26px] leading-tight text-inchiostro">Nessun problema.</h2>
              <p className="mt-1 text-inchiostro/70">Dimmi solo cosa succede, così riorganizzo la settimana. Non perdi niente.</p>
              <div className="mt-5 grid grid-cols-2 gap-2.5 pb-5">
                {REASONS.map((r) => (
                  <motion.button key={r.v} whileTap={press} disabled={busy} onClick={() => skip(r.v)} className="flex flex-col items-start gap-2 rounded-[20px] bg-salvia-chiaro p-4 text-left font-semibold text-inchiostro disabled:opacity-50">
                    <span className="text-2xl">{r.icon}</span>{r.label}
                  </motion.button>
                ))}
              </div>
              {busy && <p className="pb-4 text-center text-sm text-petrolio">Riorganizzo la settimana…</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
