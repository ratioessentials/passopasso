import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { Segment, Session } from '../api/types'
import { ExerciseFigure } from '../lib/motionFigure'
import { Button } from '../ui/kit'
import { press, spring, vibrate } from '../ui/motion'

/** Scala dello sforzo percepito, spiegata in una riga */
export const RPE: Record<number, string> = {
  1: 'riposo totale', 2: 'facilissimo, potresti cantare', 3: 'facile, parli senza problemi', 4: 'comodo, parli a frasi intere',
  5: 'medio, parli ma senti il fiato', 6: 'impegnativo, frasi brevi', 7: 'respiro corto, parli a fatica', 8: 'duro, poche parole',
  9: 'quasi al massimo', 10: 'massimo sforzo',
}

type Step = Segment & { rep?: number; of?: number; isRecovery?: boolean }

/** Le ripetute diventano segmenti in fila: Svelto 1/6, Cammina, Svelto 2/6… */
export function flattenSegments(segs: Segment[]): Step[] {
  const out: Step[] = []
  for (const s of segs) {
    const n = Math.max(1, s.repeat ?? 1)
    for (let i = 1; i <= n; i++) {
      out.push({ ...s, rep: n > 1 ? i : undefined, of: n > 1 ? n : undefined })
      if (s.recovery && i < n) out.push({ ...s.recovery, isRecovery: true })
    }
  }
  return out
}

const fmt = (sec: number) => {
  const v = Math.max(0, Math.ceil(sec))
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`
}

export default function SegmentPlayer({ session }: { session: Session }) {
  const nav = useNavigate()
  const steps = useMemo(() => flattenSegments(session.segments ?? []), [session.segments])
  const total = steps.reduce((a, s) => a + s.minutes * 60, 0)
  const [idx, setIdx] = useState(0)
  const [left, setLeft] = useState(steps[0]?.minutes * 60 || 0)
  const [running, setRunning] = useState(false)
  const startedAt = useRef(Date.now())
  const step = steps[idx]

  function finish() {
    const minutes = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000))
    nav(`/feedback/${session.id}`, { replace: true, state: { minutes } })
  }

  function goTo(i: number) {
    vibrate([120, 60, 120])
    if (i >= steps.length) return finish()
    setIdx(i)
    setLeft(steps[i].minutes * 60)
  }

  // conto alla rovescia del segmento
  const idxRef = useRef(idx)
  idxRef.current = idx
  useEffect(() => {
    if (!running) return
    const end = Date.now() + left * 1000
    const t = setInterval(() => {
      const l = (end - Date.now()) / 1000
      if (l <= 0) { clearInterval(t); goTo(idxRef.current + 1) } else setLeft(l)
    }, 200)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, idx])

  if (!step) return null
  const segTotal = step.minutes * 60
  const elapsedBefore = steps.slice(0, idx).reduce((a, s) => a + s.minutes * 60, 0)
  const doneTotal = elapsedBefore + (segTotal - left)
  const size = 250, stroke = 16, r = (size - stroke) / 2, c = 2 * Math.PI * r
  const hard = (step.rpe ?? 0) >= 6

  return (
    <div className={`flex min-h-full flex-col transition-colors duration-700 ${hard ? 'bg-gradient-to-b from-[#255e6b] to-acqua text-white' : 'bg-gradient-to-b from-salvia-chiaro via-white to-salvia-chiaro text-inchiostro'}`}>
      {/* barra dei segmenti */}
      <div className="safe-top flex items-center gap-3 px-5 pb-2">
        <motion.button whileTap={press} onClick={() => nav('/', { replace: true })} aria-label="Esci" className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${hard ? 'glass-dark' : 'glass'}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </motion.button>
        <div className="flex flex-1 gap-[3px]">
          {steps.map((s, i) => (
            <div key={i} className={`h-2 overflow-hidden rounded-full ${hard ? 'bg-white/25' : 'bg-petrolio/15'}`} style={{ flexGrow: s.minutes, flexBasis: 0 }}>
              <motion.div className={`h-full origin-left rounded-full ${(s.rpe ?? 0) >= 6 ? 'bg-sole' : hard ? 'bg-white' : 'bg-gradient-to-r from-petrolio to-acqua'}`}
                initial={false} animate={{ scaleX: i < idx ? 1 : i === idx ? 1 - left / segTotal : 0 }} transition={{ duration: 0.25, ease: 'linear' }} />
            </div>
          ))}
        </div>
      </div>
      <div className={`px-5 text-right text-xs font-semibold ${hard ? 'text-white/80' : 'text-inchiostro/55'}`}>{fmt(total - doneTotal)} alla fine</div>

      <div className="flex flex-1 flex-col items-center px-5 pt-2 text-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={idx} initial={{ x: 200, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -200, opacity: 0 }} transition={spring.gentle} className="w-full">
            <div className={`text-xs font-bold uppercase tracking-[0.16em] ${hard ? 'text-sole' : 'text-acqua'}`}>
              {step.isRecovery ? 'Recupero' : step.of ? `Ripetuta ${step.rep}/${step.of}` : `Segmento ${idx + 1} di ${steps.length}`}
            </div>
            <h1 className="font-title mt-1 text-[36px] leading-none">{step.label}</h1>
            {step.rpe && (
              <p className={`mt-2 text-sm ${hard ? 'text-white/85' : 'text-inchiostro/70'}`}>
                <span className="font-bold">Sforzo {step.rpe}/10</span> · {RPE[step.rpe]}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="relative my-5 grid place-items-center" style={{ width: size, height: size }}>
          <div className={`absolute inset-3 rounded-full ${hard ? 'bg-white/10' : 'bg-white shadow-[0_24px_50px_-20px_rgb(44_105_117/.55)]'}`} />
          <svg width={size} height={size} className="absolute -rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={hard ? 'rgb(255 255 255 / .2)' : 'rgb(44 105 117 / .1)'} strokeWidth={stroke} />
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={hard ? '#F6C76B' : '#2C6975'} strokeWidth={stroke} strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (left / segTotal)} style={{ transition: 'stroke-dashoffset .25s linear' }} />
          </svg>
          <div className="relative flex flex-col items-center">
            <ExerciseFigure key={step.motion ?? 'none'} motion={step.motion} playing={running} size={96} level={session.level} />
            <div className="font-title mt-1 text-[52px] leading-none tabular-nums">{fmt(left)}</div>
          </div>
        </div>

        {idx + 1 < steps.length && (
          <p className={`mb-4 text-sm ${hard ? 'text-white/80' : 'text-inchiostro/60'}`}>Poi: <b>{steps[idx + 1].label}</b> · {steps[idx + 1].minutes} min</p>
        )}
      </div>

      <div className="safe-bottom sticky bottom-0 flex gap-3 px-5 pt-3">
        <Button variant={hard ? 'light' : 'primary'} className="flex-1 py-4 text-lg" onClick={() => setRunning(!running)}>
          {running ? '❚❚ Pausa' : left < segTotal || idx > 0 ? '▶ Riprendi' : '▶ Via'}
        </Button>
        <Button variant="glass" className="px-5" onClick={() => goTo(idx + 1)}>{idx + 1 < steps.length ? 'Avanti ⟶' : 'Fine'}</Button>
      </div>
    </div>
  )
}
