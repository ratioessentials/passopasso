import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { api } from '../api/client'
import type { BodyZone, RedFlag, Session } from '../api/types'
import { copy, RED_FLAGS } from '../content/copy'
import { useStore } from '../lib/store'
import { amountLabel, useSession } from '../lib/useSession'
import { BodyMap } from '../ui/BodyMap'
import { Button, Card, ErrorBox, Header, RotatingText, Skeleton, Typewriter } from '../ui/kit'
import { press, spring, stagger } from '../ui/motion'
import { BonusBadge } from './Home'
import { RPE } from './SegmentPlayer'

const MINUTES = [10, 15, 20, 25, 30]
const ENERGY = [
  { v: 1, face: '😴', label: 'Scarica' },
  { v: 2, face: '😕', label: 'Bassa' },
  { v: 3, face: '🙂', label: 'Normale' },
  { v: 4, face: '😊', label: 'Buona' },
  { v: 5, face: '🤩', label: 'Al top' },
]

type Phase = { k: 'form' } | { k: 'loading' } | { k: 'ready'; session: Session } | { k: 'blocked'; flag: RedFlag }

export default function Checkin() {
  const { id } = useParams()
  const nav = useNavigate()
  const { me, putSession, toast, health } = useStore()
  const suggested = health?.readiness?.suggestedEnergy
  const { session, error } = useSession(id)
  const [minutes, setMinutes] = useState<number | null>(null)
  const [energyPick, setEnergy] = useState<number | null>(null)
  const energy = energyPick ?? suggested ?? 3
  const [pain, setPain] = useState<BodyZone[]>([])
  const [flags, setFlags] = useState<string[]>([])
  const [phase, setPhase] = useState<Phase>({ k: 'form' })
  const [redFlags, setRedFlags] = useState<RedFlag[]>(RED_FLAGS)
  const [flagsOpen, setFlagsOpen] = useState(false)
  useEffect(() => { api.redFlags().then((r) => { if (Array.isArray(r) && r.length) setRedFlags(r) }).catch(() => {}) }, [])

  const mins = minutes ?? nearest(session?.minutes ?? me?.profile?.minutesPerSession ?? 20)

  async function submit() {
    if (!id) return
    setPhase({ k: 'loading' })
    try {
      const r = await api.checkin(id, { minutes: mins, energy, pain, redFlags: flags })
      if (r.status === 'blocked') setPhase({ k: 'blocked', flag: r.redFlag })
      else { putSession(r.session); setPhase({ k: 'ready', session: r.session }) }
    } catch (e) {
      toast((e as Error).message, '🌿')
      setPhase({ k: 'form' })
    }
  }

  if (phase.k === 'blocked') return <Blocked flag={phase.flag} onHome={() => nav('/', { replace: true })} />

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-10">
      <Header title={phase.k === 'ready' ? 'La tua seduta' : 'Come stai oggi?'} subtitle={phase.k === 'form' ? 'Tre tocchi e preparo la seduta giusta per te.' : undefined} onBack={() => (phase.k === 'ready' ? setPhase({ k: 'form' }) : nav(-1))} />
      {error && <ErrorBox message={error} />}

      {session && phase.k !== 'ready' && (
        <motion.div layoutId={`session-${session.id}`} transition={spring.gentle} className="mx-5 mb-4 flex items-center justify-between rounded-[22px] bg-white px-4 py-3 shadow-soft">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-acqua">{session.kind === 'ripartenza' ? 'Ripartenza' : 'Seduta di oggi'}</div>
            <div className="font-title truncate text-lg text-inchiostro">{session.title}</div>
          </div>
          {session.bonusPoints > 0 && <BonusBadge points={session.bonusPoints} />}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {phase.k === 'form' && (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 px-5">
            <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(0)}>
              <h3 className="font-title mb-3 text-lg">Quanto tempo hai?</h3>
              <div className="grid grid-cols-5 gap-2">
                {MINUTES.map((m) => (
                  <motion.button key={m} whileTap={press} onClick={() => setMinutes(m)} className={`relative rounded-2xl py-3 text-center ${mins === m ? 'text-white' : 'bg-white/70 text-petrolio'}`}>
                    {mins === m && <motion.span layoutId="min-pill" transition={spring.snappy} className="absolute inset-0 rounded-2xl bg-gradient-to-b from-petrolio to-acqua" />}
                    <span className="font-title relative block text-2xl leading-none">{m}</span>
                    <span className="relative text-[11px] font-semibold">min</span>
                  </motion.button>
                ))}
              </div>
            </Card>

            <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(1)}>
              <h3 className="font-title mb-3 text-lg">Come va l'energia?</h3>
              {suggested && energyPick === null && (
                <p className="-mt-2 mb-3 text-[12.5px] text-acqua">Suggerito dai tuoi dati di sonno e battito: cambia pure.</p>
              )}
              <div className="flex justify-between">
                {ENERGY.map((e) => {
                  const on = energy === e.v
                  return (
                    <motion.button key={e.v} whileTap={{ scale: 0.88 }} onClick={() => setEnergy(e.v)} className="flex w-[56px] flex-col items-center gap-1">
                      <motion.span animate={{ scale: on ? 1.25 : 1, filter: on ? 'grayscale(0)' : 'grayscale(0.7)', opacity: on ? 1 : 0.6 }} transition={spring.bouncy} className="text-[32px] leading-none">{e.face}</motion.span>
                      <span className={`text-[11px] font-semibold ${on ? 'text-petrolio' : 'text-inchiostro/50'}`}>{e.label}</span>
                    </motion.button>
                  )
                })}
              </div>
            </Card>

            <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(2)}>
              <h3 className="font-title mb-1 text-lg">Ti fa male qualcosa?</h3>
              <BodyMap value={pain} onChange={setPain} />
            </Card>

            <Button className="w-full py-4 text-lg" onClick={submit} disabled={!session}>
              Prepara la mia seduta
            </Button>
            <button onClick={() => setFlagsOpen(true)} className="mx-auto block pb-4 text-sm text-inchiostro/55 underline decoration-inchiostro/20 underline-offset-4">
              {flags.length ? `Hai segnalato ${flags.length === 1 ? 'un sintomo' : `${flags.length} sintomi`}: rivedi` : 'Oggi hai qualche sintomo insolito?'}
            </button>
          </motion.div>
        )}

        {phase.k === 'loading' && <Thinking key="loading" />}

        {phase.k === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-5">
            <SessionPreview s={phase.session} />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.4 + phase.session.items.length * 0.06 }} className="sticky bottom-4 mt-5">
              <Button className="w-full py-4 text-lg" onClick={() => nav(`/seduta/${phase.session.id}`, { replace: true })}>
                Iniziamo
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {flagsOpen && (
          <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-inchiostro/40 backdrop-blur-sm" onClick={() => setFlagsOpen(false)} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.gentle}
              drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 100) setFlagsOpen(false) }}
              className="safe-bottom relative max-h-[85%] w-full overflow-y-auto rounded-t-[34px] bg-white px-6 pt-3 shadow-[0_-20px_60px_-20px_rgb(18_49_58/.5)]">
              <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-inchiostro/15" />
              <h2 className="font-title text-[24px] leading-tight text-inchiostro">Oggi hai qualcuno di questi sintomi?</h2>
              <p className="mt-1 text-sm text-inchiostro/65">Spunta solo se ti riguarda. In quel caso oggi niente allenamento: la tua sicurezza viene prima.</p>
              <div className="mt-4 space-y-2">
                {redFlags.map((f) => {
                  const on = flags.includes(f.id)
                  return (
                    <motion.button key={f.id} whileTap={press} onClick={() => setFlags(on ? flags.filter((x) => x !== f.id) : [...flags, f.id])}
                      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-[14.5px] transition-colors ${on ? 'bg-salvia text-inchiostro' : 'bg-salvia-chiaro/70 text-inchiostro/80'}`}>
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 ${on ? 'border-petrolio bg-petrolio text-white' : 'border-petrolio/25'}`}>
                        {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>}
                      </span>
                      {f.label}
                    </motion.button>
                  )
                })}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-inchiostro/55">Se un sintomo è forte o improvviso, chiama il <a href="tel:112" className="font-semibold text-petrolio underline">112</a>.</p>
              <div className="pb-4 pt-4">
                <Button className="w-full" onClick={() => setFlagsOpen(false)}>{flags.length ? 'Ho capito' : 'Nessuno, sto bene'}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function nearest(m: number) {
  return MINUTES.reduce((a, b) => (Math.abs(b - m) < Math.abs(a - m) ? b : a), 20)
}

/** L'AI ci sta pensando: card che si mescolano con shimmer e microtesti. */
function Thinking() {
  const order = [0, 1, 2, 3]
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-5 pt-4">
      <div className="mb-6 flex flex-col items-center text-center">
        <motion.div className="relative mb-4 h-16 w-16" animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i} className="absolute left-1/2 top-1/2 h-4 w-4 rounded-full" style={{ background: ['#2C6975', '#68B2A0', '#F2A08B'][i], x: '-50%', y: '-50%' }}
              animate={{ x: ['-50%', `${-50 + Math.cos(i * 2.1) * 120}%`, '-50%'], y: ['-50%', `${-50 + Math.sin(i * 2.1) * 120}%`, '-50%'], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }} />
          ))}
        </motion.div>
        <RotatingText items={copy['checkin.loading']} className="w-full text-center font-semibold text-petrolio" />
      </div>
      <div className="relative h-[300px]">
        {order.map((i) => (
          <motion.div key={i} className="absolute inset-x-0 overflow-hidden rounded-[22px] bg-white p-4 shadow-soft"
            style={{ top: i * 72, zIndex: 4 - i }}
            animate={{ y: [0, (i % 2 ? -1 : 1) * 36, 0], x: [0, (i % 2 ? 14 : -14), 0], rotate: [0, i % 2 ? 2 : -2, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}>
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-2/3 rounded-full" />
                <Skeleton className="h-3 w-1/3 rounded-full" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

const CAT_ICON: Record<string, string> = { riscaldamento: '🔥', cardio: '🚶', forza: '💪', mobilita: '🧘', defaticamento: '🌿' }

export function SessionPreview({ s }: { s: Session }) {
  return (
    <div>
      <motion.div layoutId={`session-${s.id}`} transition={spring.gentle} className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-petrolio to-acqua p-5 text-white shadow-soft">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/75">{s.minutes} minuti · {s.segments?.length ? `${s.segments.length} segmenti` : `${s.items.length} esercizi`}</span>
          {s.bonusPoints > 0 && <BonusBadge points={s.bonusPoints} />}
        </div>
        <h2 className="font-title mt-1 text-[26px] leading-tight">{s.title}</h2>
        {s.reason && (
          <div className="mt-3 rounded-2xl bg-white/15 p-3 text-[14.5px] leading-snug">
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/80">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.2 6.3L20 10l-5.8 1.7L12 18l-2.2-6.3L4 10l5.8-1.7z" /></svg>
              Perché questa seduta
            </div>
            <Typewriter text={s.reason} delay={350} />
          </div>
        )}
      </motion.div>
      {s.segments && s.segments.length > 0 && (
        <div className="mt-4 space-y-2.5">
          {s.segments.map((g, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={stagger(i + 2, 0.07)}
              className="flex items-center gap-3 rounded-[20px] bg-white/80 p-3 shadow-[0_6px_16px_-12px_rgb(44_105_117/.6)]">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-title text-lg ${(g.rpe ?? 0) >= 6 ? 'bg-sole/40 text-[#7a4f05]' : 'bg-salvia-chiaro text-petrolio'}`}>{g.rpe ?? '·'}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-inchiostro">{g.repeat && g.repeat > 1 ? `${g.repeat} × ${g.label}` : g.label}</div>
                <div className="text-xs text-inchiostro/60">
                  {g.minutes} min{g.recovery ? ` + ${g.recovery.minutes} min ${g.recovery.label.toLowerCase()}` : ''}{g.rpe ? ` · ${RPE[g.rpe]}` : ''}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <div className="mt-4 space-y-2.5">
        {s.items.map((it, i) => (
          <motion.div key={it.exerciseId + i} initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={stagger(i + 2, 0.07)}
            className="flex items-center gap-3 rounded-[20px] bg-white/80 p-3 shadow-[0_6px_16px_-12px_rgb(44_105_117/.6)]">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-salvia-chiaro text-xl">{CAT_ICON[it.exercise.category] ?? '•'}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold text-inchiostro">{it.exercise.name}</div>
              <div className="text-xs text-inchiostro/60">{amountLabel(it)}{it.note ? ` · ${it.note}` : ''}</div>
            </div>
            <span className="text-[11px] font-semibold capitalize text-acqua">{it.exercise.category === 'mobilita' ? 'mobilità' : it.exercise.category}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function Blocked({ flag, onHome }: { flag: RedFlag; onHome: () => void }) {
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center bg-gradient-to-b from-salvia-chiaro to-white px-8 text-center">
      <motion.div className="relative mb-8 grid h-28 w-28 place-items-center" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.gentle}>
        <motion.div className="absolute inset-0 rounded-full bg-acqua/25" animate={{ scale: [1, 1.18, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute inset-4 rounded-full bg-acqua/35" animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }} />
        <span className="relative text-5xl">🌿</span>
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="font-title text-[30px] leading-tight text-inchiostro">{copy['blocked.title']}</motion.h1>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-4 text-[16px] leading-relaxed text-inchiostro/80">{flag.message}</motion.p>
      {flag.urgent && (
        <motion.a initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} href="tel:112" className="mt-6 inline-flex items-center gap-2 rounded-full border-2 border-petrolio/30 px-5 py-2.5 font-semibold text-petrolio">
          📞 Chiama il 112
        </motion.a>
      )}
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-6 text-sm text-inchiostro/60">Il tuo percorso resta qui. Non perdi niente: riprendiamo quando stai bene.</motion.p>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-10 w-full">
        <Button variant="light" className="w-full" onClick={onHome}>Torna alla home</Button>
      </motion.div>
    </div>
  )
}
