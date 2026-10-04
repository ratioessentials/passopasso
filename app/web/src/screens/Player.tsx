import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import type { SessionItem } from '../api/types'
import { findExercise } from '../content/catalog'
import { hasFormCheck } from '../lib/formcheck'
import { ExerciseFigure } from '../lib/motionFigure'
import { useStore } from '../lib/store'
import { useSession } from '../lib/useSession'
import { say, setVoiceEnabled, stop as stopVoice, voiceEnabled, voiceSupported } from '../lib/voice'
import { sessionZeroDone } from '../api/client'
import { Button, ErrorBox, Skeleton } from '../ui/kit'
import SegmentPlayer from './SegmentPlayer'
import { press, spring, vibrate } from '../ui/motion'

type Phase = 'work' | 'rest'

export default function Player() {
  const { id } = useParams()
  const nav = useNavigate()
  const { toast } = useStore()
  const { session, error } = useSession(id)
  const [items, setItems] = useState<SessionItem[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [set, setSet] = useState(1)
  const [phase, setPhase] = useState<Phase>('work')
  const [dir, setDir] = useState(1)
  const startedAt = useRef(Date.now())
  const [voice, setVoice] = useState(voiceEnabled())

  useEffect(() => { if (session && !items) setItems(session.items) }, [session, items])

  // Guida vocale: annuncia l'esercizio, il recupero e l'ultima serie.
  useEffect(() => {
    if (!items || !voice) return
    const cur = items[idx]
    if (!cur) return
    if (phase === 'rest') say('Recupero. Respira.')
    else if (set > 1) say(set === cur.sets ? 'Ultima serie.' : `Serie ${set}.`)
    else say(`${cur.exercise.name}. ${cur.exercise.instructions[0] ?? ''}`)
  }, [items, idx, set, phase, voice])
  useEffect(() => () => stopVoice(), [])

  if (error) return <div className="pt-24"><ErrorBox message={error} /></div>
  if (!session || !items) return <div className="space-y-4 px-5 pt-20"><Skeleton className="h-64" /><Skeleton className="h-24" /></div>

  if (session.segments?.length) return <SegmentPlayer session={session} />

  const it = items[idx]
  const total = items.length

  function finish() {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))
    if (voice) say('Fatto. Bravo, ci siamo.')
    if (id === 'zero') {
      // seduta di prova: la vittoria resta anche dopo l'onboarding
      sessionZeroDone().then((r) => nav('/seduta-zero/fatto', { replace: true, state: { win: r.win } })).catch(() => nav('/seduta-zero/fatto', { replace: true }))
      return
    }
    nav(`/feedback/${session!.id}`, { replace: true, state: { minutes } })
  }

  function nextExercise() {
    setDir(1)
    if (idx + 1 >= total) return finish()
    setIdx(idx + 1)
    setSet(1)
    setPhase('work')
  }

  function setDone() {
    vibrate([60, 40, 60])
    if (set < it.sets) {
      if (it.restSec > 0) setPhase('rest')
      setSet(set + 1)
    } else if (it.restSec > 0 && idx + 1 < total && it.restSec >= 20) {
      setPhase('rest')
      setSet(it.sets + 1) // segnala "recupero prima del prossimo esercizio"
    } else nextExercise()
  }

  function afterRest() {
    if (set > it.sets) nextExercise()
    else setPhase('work')
  }

  function easier() {
    const reg = findExercise(it.exercise.regression)
    if (!reg) { toast('Questa è già la versione più semplice. Vai col tuo ritmo.', '🌿'); return }
    const copyItems = [...items!]
    const scale = (n?: number) => (n ? Math.max(5, Math.round(n * 0.8)) : n)
    copyItems[idx] = reg.prescription.type === 'seconds'
      ? { ...it, exerciseId: reg.id, exercise: reg, reps: undefined, seconds: scale(it.seconds ?? reg.prescription.default) }
      : { ...it, exerciseId: reg.id, exercise: reg, seconds: undefined, reps: scale(it.reps ?? reg.prescription.default) }
    setItems(copyItems)
    toast(`Passiamo a: ${reg.name}`, '👍')
  }

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-salvia-chiaro via-white to-salvia-chiaro">
      {/* barra superiore */}
      <div className="safe-top flex items-center gap-3 px-5 pb-2">
        <motion.button whileTap={press} onClick={() => nav('/', { replace: true })} aria-label="Esci" className="glass grid h-10 w-10 place-items-center rounded-full">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </motion.button>
        <div className="flex flex-1 gap-1">
          {items.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-petrolio/15">
              <motion.div className="h-full origin-left rounded-full bg-gradient-to-r from-petrolio to-acqua" initial={false} animate={{ scaleX: i < idx ? 1 : i === idx ? Math.min(1, (set - 1) / it.sets) : 0 }} transition={spring.gentle} />
            </div>
          ))}
        </div>
        <span className="font-title w-10 text-right text-sm text-petrolio">{idx + 1}/{total}</span>
        {voiceSupported && (
          <motion.button whileTap={press} aria-label={voice ? 'Spegni la voce' : 'Accendi la voce'} onClick={() => { setVoiceEnabled(!voice); setVoice(!voice) }}
            className={`glass grid h-10 w-10 place-items-center rounded-full ${voice ? 'text-petrolio' : 'text-inchiostro/40'}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4z" />{voice ? <><path d="M15.5 8.5a5 5 0 010 7" /><path d="M18.5 5.5a9 9 0 010 13" /></> : <path d="M16 9l5 6M21 9l-5 6" />}</svg>
          </motion.button>
        )}
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div
            key={idx + it.exerciseId}
            custom={dir}
            initial={{ x: 320 * dir, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -320 * dir, opacity: 0 }}
            transition={spring.gentle}
            className="px-5 pb-6"
          >
            <ExerciseView key={it.exerciseId + set + phase} level={session.level} it={it} set={Math.min(set, it.sets)} phase={phase} onSetDone={setDone} onRestDone={afterRest} nextName={items[idx + 1]?.exercise.name} restingBeforeNext={set > it.sets} />
          </motion.div>
        </AnimatePresence>
      </div>

      {phase === 'work' && (
        <div className="safe-bottom sticky bottom-0 z-10 flex items-center justify-center gap-3 bg-gradient-to-t from-salvia-chiaro via-salvia-chiaro/90 to-transparent px-5 pt-6">
          <Button variant="glass" className="flex-1 px-3 text-sm" onClick={easier}>🪶 Più facile</Button>
          <Button variant="glass" className="flex-1 px-3 text-sm" onClick={nextExercise}>Salta esercizio ⟶</Button>
        </div>
      )}
    </div>
  )
}

function ExerciseView({ it, level, set, phase, onSetDone, onRestDone, nextName, restingBeforeNext }: {
  it: SessionItem; level: number; set: number; phase: Phase; onSetDone: () => void; onRestDone: () => void; nextName?: string; restingBeforeNext: boolean
}) {
  const nav = useNavigate()
  const ex = it.exercise
  if (phase === 'rest') {
    return <Rest seconds={it.restSec} onDone={onRestDone} label={restingBeforeNext ? `Poi: ${nextName ?? 'ultimo sforzo'}` : `Poi: serie ${set} di ${it.sets}`} />
  }
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-acqua">{ex.category === 'mobilita' ? 'mobilità' : ex.category}{it.sets > 1 ? ` · serie ${set} di ${it.sets}` : ''}</div>
      <h1 className="font-title text-[32px] leading-[1.05] text-inchiostro">{ex.name}</h1>
      {it.note && <p className="mt-1 text-sm font-semibold text-petrolio">{it.note}</p>}

      <div className="my-6 flex justify-center">
        {it.seconds ? <Timer seconds={it.seconds} onDone={onSetDone} /> : <Reps reps={it.reps ?? ex.prescription.default} progress={(set - 1) / it.sets} onDone={onSetDone} />}
      </div>

      <div className="mb-4 flex justify-center">
        <ExerciseFigure motion={ex.motion} playing level={level} size={190} />
      </div>

      {ex.formCheck && hasFormCheck && (
        <Button variant="light" className="mb-4 w-full" onClick={() => nav('/formcheck', { state: { exerciseId: ex.id } })}>📷 Controlla la forma</Button>
      )}

      <div className="rounded-[22px] bg-white/80 p-4 shadow-[0_8px_20px_-14px_rgb(44_105_117/.6)]">
        <h3 className="font-title mb-2 text-base text-inchiostro">Come si fa</h3>
        <ol className="space-y-1.5">
          {ex.instructions.map((s, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring.gentle, delay: 0.1 + i * 0.05 }} className="flex gap-2.5 text-[14.5px] text-inchiostro/85">
              <span className="font-title grid h-6 w-6 shrink-0 place-items-center rounded-full bg-salvia text-xs text-petrolio">{i + 1}</span>{s}
            </motion.li>
          ))}
        </ol>
        {ex.commonMistakes.length > 0 && (
          <>
            <h3 className="font-title mb-1.5 mt-4 text-base text-inchiostro">Occhio a</h3>
            <ul className="space-y-1">
              {ex.commonMistakes.map((m, i) => <li key={i} className="flex gap-2 text-sm text-inchiostro/70"><span className="text-corallo">●</span>{m}</li>)}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}

function Ring({ progress, size = 230, children, pulse = false }: { progress: number; size?: number; children: React.ReactNode; pulse?: boolean }) {
  const stroke = 16
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <motion.div className="relative grid place-items-center" style={{ width: size, height: size }} animate={pulse ? { scale: [1, 1.035, 1] } : { scale: 1 }} transition={pulse ? { duration: 1, repeat: Infinity, ease: 'easeInOut' } : spring.gentle}>
      <div className="absolute inset-3 rounded-full bg-white shadow-[0_24px_50px_-20px_rgb(44_105_117/.55)]" />
      <svg width={size} height={size} className="absolute -rotate-90">
        <defs>
          <linearGradient id="timerg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#68B2A0" /><stop offset="1" stopColor="#2C6975" /></linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(44 105 117 / .1)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#timerg)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - progress)} style={{ transition: 'stroke-dashoffset .25s linear' }} />
      </svg>
      <div className="relative text-center">{children}</div>
    </motion.div>
  )
}

function useCountdown(seconds: number, running: boolean, onDone: () => void) {
  const [left, setLeft] = useState(seconds)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (!running) return
    const end = Date.now() + left * 1000
    const t = setInterval(() => {
      const l = Math.max(0, (end - Date.now()) / 1000)
      setLeft(l)
      if (l <= 0) { clearInterval(t); done.current() }
    }, 200)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  return left
}

const fmt = (s: number) => {
  const v = Math.ceil(s)
  return v >= 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : String(v)
}

function Timer({ seconds, onDone }: { seconds: number; onDone: () => void }) {
  const [running, setRunning] = useState(false)
  const left = useCountdown(seconds, running, onDone)
  return (
    <div className="flex flex-col items-center gap-5">
      <Ring progress={1 - left / seconds}>
        <div className="font-title text-[64px] leading-none text-inchiostro">{fmt(left)}</div>
        <div className="mt-1 text-sm text-inchiostro/55">{seconds >= 60 && left >= 60 ? 'minuti' : 'secondi'}</div>
      </Ring>
      <div className="flex gap-3">
        <Button onClick={() => setRunning(!running)} className="min-w-[150px]">{running ? '❚❚ Pausa' : left < seconds ? '▶ Riprendi' : '▶ Via'}</Button>
        {left < seconds && <Button variant="light" onClick={onDone}>Fatto</Button>}
      </div>
    </div>
  )
}

function Reps({ reps, progress, onDone }: { reps: number; progress: number; onDone: () => void }) {
  return (
    <div className="flex flex-col items-center gap-5">
      <Ring progress={progress}>
        <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className="font-title text-[80px] leading-none text-inchiostro">{reps}</motion.div>
        <div className="mt-1 text-sm text-inchiostro/55">ripetizioni</div>
      </Ring>
      <Button onClick={onDone} className="min-w-[200px] py-4 text-lg">Serie fatta ✓</Button>
    </div>
  )
}

function Rest({ seconds, onDone, label }: { seconds: number; onDone: () => void; label: string }) {
  const left = useCountdown(seconds, true, () => { vibrate(200); onDone() })
  const breath = useMemo(() => (Math.floor((seconds - left) / 4) % 2 === 0 ? 'Inspira…' : 'Espira…'), [left, seconds])
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-acqua">Recupero</div>
      <h1 className="font-title mb-6 text-[30px] text-inchiostro">Respira con calma</h1>
      <Ring progress={left / seconds} pulse>
        <div className="font-title text-[64px] leading-none text-petrolio">{fmt(left)}</div>
        <div className="mt-1 text-sm text-inchiostro/55">{breath}</div>
      </Ring>
      <p className="mt-6 text-inchiostro/70">{label}</p>
      <Button variant="light" className="mt-5" onClick={onDone}>Salta il recupero</Button>
    </div>
  )
}
