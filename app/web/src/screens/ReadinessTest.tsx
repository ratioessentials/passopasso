import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { LevelTestResult, ReadinessTest } from '../api/types'
import { ExerciseFigure } from '../lib/motionFigure'
import { useStore } from '../lib/store'
import { Button, Header, Skeleton } from '../ui/kit'
import { press, spring, vibrate } from '../ui/motion'
import { RPE } from './SegmentPlayer'

type Phase = 'intro' | 'run' | 'enter' | 'sending' | 'result'

const DURATION: Record<string, number> = { sit_to_stand_30s: 30, marcia_1min: 60 }
const MOTION: Record<string, 'squat' | 'marcia'> = { sit_to_stand_30s: 'squat', marcia_1min: 'marcia' }

/** Test di prontezza prima del passaggio di livello: sit-to-stand 30 s e marcia 1 minuto. */
export default function ReadinessTestScreen() {
  const nav = useNavigate()
  const { me, showLevelUp, toast } = useStore()
  const [tests, setTests] = useState<ReadinessTest[] | null>(null)
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState<Phase>('intro')
  const [results, setResults] = useState<Record<string, number | null>>({})
  const [count, setCount] = useState(0)
  const [left, setLeft] = useState(30)
  const [res, setRes] = useState<LevelTestResult | null>(null)

  useEffect(() => { api.levelTests().then(setTests).catch((e: Error) => toast(e.message, '🌿')) }, [toast])

  const t = tests?.[i]
  const isCount = t?.unit !== 'sforzo'
  const dur = t ? DURATION[t.id] ?? 30 : 30

  // timer del test
  const endRef = useRef(0)
  useEffect(() => {
    if (phase !== 'run') return
    endRef.current = Date.now() + dur * 1000
    const iv = setInterval(() => {
      const l = (endRef.current - Date.now()) / 1000
      if (l <= 0) { clearInterval(iv); setLeft(0); vibrate([200, 80, 200]); setPhase('enter') } else setLeft(l)
    }, 100)
    return () => clearInterval(iv)
  }, [phase, dur])

  function start() { setCount(0); setLeft(dur); setPhase('run'); vibrate(80) }

  async function save(v: number | null) {
    if (!t || !tests) return
    const next = { ...results, [t.id]: v }
    setResults(next)
    if (i + 1 < tests.length) { setI(i + 1); setPhase('intro'); return }
    setPhase('sending')
    try { setRes(await api.levelTest(next)); setPhase('result') } catch (e) { toast((e as Error).message, '🌿'); setPhase('enter') }
  }

  if (!tests || !t) return <div className="space-y-4 px-5 pt-24"><Skeleton className="h-60" /><Skeleton className="h-20" /></div>

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-salvia to-salvia-chiaro">
      <Header title="Test di prontezza" subtitle={`Prova ${i + 1} di ${tests.length} · ${t.title}`} onBack={() => nav(-1)} />
      <div className="mx-5 mb-3 flex gap-1.5">
        {tests.map((_, j) => <div key={j} className={`h-1.5 flex-1 rounded-full ${j < i || phase === 'result' ? 'bg-petrolio' : j === i ? 'bg-acqua' : 'bg-petrolio/15'}`} />)}
      </div>

      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div key={'intro' + i} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={spring.gentle} className="flex flex-1 flex-col px-5">
            <div className="flex justify-center py-4"><ExerciseFigure motion={MOTION[t.id]} playing size={170} level={me?.level.n ?? 2} /></div>
            <h2 className="font-title text-[28px] leading-tight text-inchiostro">{t.title}</h2>
            <ol className="mt-3 space-y-2">
              {t.instructions.map((s, k) => (
                <li key={k} className="flex gap-2.5 text-[15px] text-inchiostro/85">
                  <span className="font-title grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-xs text-petrolio">{k + 1}</span>{s}
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-inchiostro/60">{i === 0 ? 'Misura la forza delle gambe: serve per correre e salire le scale.' : 'Misura come risponde il fiato a uno sforzo breve.'} Se senti dolore, fermati: va bene così.</p>
            <div className="flex-1" />
            <div className="safe-bottom space-y-1 pt-4">
              <Button className="w-full py-4 text-lg" onClick={start}>▶ Via, {dur} secondi</Button>
              <Button variant="ghost" className="w-full text-sm" onClick={() => save(null)}>Salta questa prova</Button>
            </div>
          </motion.div>
        )}

        {phase === 'run' && (
          <motion.div key="run" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col items-center px-5 pt-2">
            <div className="font-title text-[64px] leading-none tabular-nums text-petrolio">{Math.ceil(left)}</div>
            <div className="text-sm text-inchiostro/55">secondi</div>
            {isCount ? (
              <motion.button
                whileTap={{ scale: 0.92 }} transition={spring.bouncy}
                onClick={() => { setCount((c) => c + 1); vibrate(25) }}
                className="relative mt-6 grid h-[260px] w-[260px] place-items-center rounded-full bg-gradient-to-b from-petrolio to-acqua text-white shadow-[0_30px_60px_-24px_rgb(44_105_117/.9)]"
              >
                <span className="absolute inset-3 rounded-full border-2 border-white/25" />
                <div className="text-center">
                  <motion.div key={count} initial={{ scale: 1.35, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className="font-title text-[96px] leading-none">{count}</motion.div>
                  <div className="text-sm font-semibold text-white/85">tocca a ogni alzata</div>
                </div>
              </motion.button>
            ) : (
              <div className="mt-6 grid h-[260px] w-[260px] place-items-center rounded-full bg-white shadow-[0_24px_50px_-20px_rgb(44_105_117/.55)]">
                <ExerciseFigure motion="marcia" playing size={160} level={me?.level.n ?? 2} />
              </div>
            )}
            <p className="mt-6 text-center text-inchiostro/70">{isCount ? 'Alzati del tutto e siediti piano. Respira.' : 'Ginocchia su, ritmo svelto e regolare.'}</p>
            <Button variant="ghost" className="mt-2 text-sm" onClick={() => setPhase('enter')}>Ho finito prima</Button>
          </motion.div>
        )}

        {phase === 'enter' && (
          <motion.div key="enter" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-1 flex-col px-5 pt-4">
            {isCount ? (
              <>
                <h2 className="font-title text-[28px] leading-tight text-inchiostro">Quante volte ti sei alzata/o?</h2>
                <div className="mt-6 flex items-center justify-center gap-6">
                  <motion.button whileTap={{ scale: 0.88 }} onClick={() => setCount((c) => Math.max(0, c - 1))} className="grid h-14 w-14 place-items-center rounded-full bg-white text-3xl font-bold text-petrolio shadow-sm">−</motion.button>
                  <motion.span key={count} initial={{ y: -8, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} className="font-title w-28 text-center text-[80px] leading-none text-petrolio">{count}</motion.span>
                  <motion.button whileTap={{ scale: 0.88 }} onClick={() => setCount((c) => c + 1)} className="grid h-14 w-14 place-items-center rounded-full bg-white text-3xl font-bold text-petrolio shadow-sm">+</motion.button>
                </div>
                <div className="flex-1" />
                <div className="safe-bottom pt-4"><Button className="w-full py-4 text-lg" onClick={() => save(count)}>Conferma</Button></div>
              </>
            ) : (
              <>
                <h2 className="font-title text-[28px] leading-tight text-inchiostro">Quanto è stato faticoso?</h2>
                <p className="mt-1 text-sm text-inchiostro/65">Da 1 (riposo) a 10 (massimo sforzo). Non c'è una risposta giusta.</p>
                <div className="mt-4 grid grid-cols-5 gap-2">
                  {[...Array(10)].map((_, k) => {
                    const v = k + 1
                    const hue = v <= 3 ? 'bg-salvia' : v <= 6 ? 'bg-acqua/60' : v <= 8 ? 'bg-sole/70' : 'bg-corallo/70'
                    return (
                      <motion.button key={v} whileTap={press} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.bouncy, delay: k * 0.03 }}
                        onClick={() => setCount(v)} className={`font-title rounded-2xl py-3 text-2xl text-inchiostro ${hue} ${count === v ? 'ring-4 ring-petrolio' : ''}`}>
                        {v}
                      </motion.button>
                    )
                  })}
                </div>
                {count > 0 && <p className="mt-3 text-center text-inchiostro/75"><b>{count}</b> · {RPE[count]}</p>}
                <div className="flex-1" />
                <div className="safe-bottom pt-4"><Button className="w-full py-4 text-lg" disabled={count < 1} onClick={() => save(count)}>Conferma</Button></div>
              </>
            )}
          </motion.div>
        )}

        {phase === 'sending' && (
          <motion.div key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid flex-1 place-items-center">
            <p className="font-semibold text-petrolio">Guardo i risultati…</p>
          </motion.div>
        )}

        {phase === 'result' && res && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={spring.bouncy} className="flex flex-1 flex-col items-center px-6 pt-8 text-center">
            <div className="text-6xl">{res.passed ? '🎉' : '🌱'}</div>
            <h2 className="font-title mt-4 text-[30px] leading-tight text-inchiostro">{res.passed ? 'Test superato' : 'Ci sei quasi'}</h2>
            <p className="mt-3 text-[16px] text-inchiostro/80">{res.message}</p>
            <div className="mt-6 grid w-full grid-cols-2 gap-3">
              {tests.map((tt) => (
                <div key={tt.id} className="rounded-[20px] bg-white/85 p-3">
                  <div className="font-title text-[34px] leading-none text-petrolio">{results[tt.id] ?? '–'}</div>
                  <div className="mt-1 text-xs text-inchiostro/60">{tt.unit === 'sforzo' ? 'sforzo percepito' : tt.unit}</div>
                </div>
              ))}
            </div>
            <div className="flex-1" />
            <div className="safe-bottom w-full pt-6">
              {res.passed && res.levelUp
                ? <Button className="w-full py-4 text-lg" onClick={() => { showLevelUp({ ...res.levelUp!, auto: true }); }}>✨ Passa al livello {res.levelUp.to}</Button>
                : <Button className="w-full py-4 text-lg" onClick={() => nav('/', { replace: true })}>Torna a oggi</Button>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
