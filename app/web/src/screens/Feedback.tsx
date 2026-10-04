import { AnimatePresence, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { api } from '../api/client'
import type { CompleteResponse, Feedback } from '../api/types'
import { winIcon } from '../content/copy'
import { useStore } from '../lib/store'
import { AnimatedNumber, Button, ConsistencyRing, MeshBackground } from '../ui/kit'
import { spring } from '../ui/motion'

const OPTIONS: { v: Feedback; face: string; label: string; hint: string }[] = [
  { v: 'facile', face: '😌', label: 'Facile', hint: 'Potevo fare di più' },
  { v: 'giusto', face: '😊', label: 'Giusto', hint: 'Impegnativo il giusto' },
  { v: 'duro', face: '😮‍💨', label: 'Duro', hint: 'Mi ha messo alla prova' },
]

export default function FeedbackScreen() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation()
  const { me, loadMe, showLevelUp, toast } = useStore()
  const before = useRef(me?.consistency ?? 0)
  const [picked, setPicked] = useState<Feedback | null>(null)
  const [result, setResult] = useState<CompleteResponse | null>(null)
  const minutes = (loc.state as { minutes?: number } | null)?.minutes

  async function send(f: Feedback) {
    if (!id || picked) return
    setPicked(f)
    try {
      const r = await api.complete(id, f)
      setResult(r)
      void loadMe()
    } catch (e) {
      toast((e as Error).message, '🌿')
      setPicked(null)
    }
  }

  useEffect(() => {
    if (!result) return
    const t1 = setTimeout(() => void confetti({ particleCount: 70, spread: 70, origin: { y: 0.35 }, colors: ['#2C6975', '#68B2A0', '#CDE0C9', '#F6C76B'], disableForReducedMotion: true }), 500)
    const t2 = result.levelUp ? setTimeout(() => showLevelUp(result.levelUp), 2600) : undefined
    return () => { clearTimeout(t1); if (t2) clearTimeout(t2) }
  }, [result, showLevelUp])

  const level = me?.level.n ?? 2

  return (
    <div className="relative min-h-full overflow-hidden text-white">
      <MeshBackground level={level} />
      <div className="safe-top relative flex min-h-full flex-col px-6 pb-10">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="ask" exit={{ opacity: 0, y: -20 }} className="flex flex-1 flex-col pt-10">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={spring.bouncy} className="text-6xl">🎉</motion.div>
              <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.1 }} className="font-title mt-4 text-[38px] leading-[1.05]">Seduta finita.<br />Bel lavoro{me?.profile?.name ? `, ${me.profile.name}` : ''}.</motion.h1>
              {minutes && <p className="mt-2 text-white/85">{minutes} minuti di movimento in più.</p>}
              <p className="mt-8 text-lg font-semibold">Com'è andata?</p>
              <p className="text-sm text-white/75">Mi serve per regolare la prossima.</p>
              <div className="mt-5 space-y-3">
                {OPTIONS.map((o, i) => (
                  <motion.button
                    key={o.v}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: picked && picked !== o.v ? 0.4 : 1, x: 0, scale: picked === o.v ? 1.03 : 1 }}
                    transition={{ ...spring.gentle, delay: picked ? 0 : 0.2 + i * 0.07 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => send(o.v)}
                    className={`flex w-full items-center gap-4 rounded-[24px] p-4 text-left ${picked === o.v ? 'bg-white text-inchiostro' : 'glass-dark'}`}
                  >
                    <span className="text-4xl">{o.face}</span>
                    <span className="flex-1">
                      <span className="font-title block text-2xl leading-none">{o.label}</span>
                      <span className={`text-sm ${picked === o.v ? 'text-inchiostro/60' : 'text-white/75'}`}>{o.hint}</span>
                    </span>
                    {picked === o.v && <motion.span className="h-5 w-5 rounded-full border-2 border-petrolio border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 flex-col items-center pt-8 text-center">
              <ConsistencyRing value={result.consistency} from={before.current} size={190} stroke={16} light>
                <div>
                  <AnimatedNumber value={result.consistency} from={before.current} className="font-title block text-[60px] leading-none" />
                  <div className="text-xs font-semibold uppercase tracking-wider text-white/80">costanza</div>
                </div>
              </ConsistencyRing>
              {result.consistency > before.current && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring.bouncy, delay: 1 }} className="mt-3 rounded-full bg-white/90 px-3 py-1 text-sm font-bold text-petrolio">
                  +{result.consistency - before.current} punti
                </motion.div>
              )}
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="font-title mt-6 text-[26px] leading-tight">{result.message}</motion.p>

              {result.newWins.length > 0 && (
                <div className="mt-8 w-full">
                  <div className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/80">Nuove vittorie</div>
                  <div className="space-y-2.5">
                    {result.newWins.map((w, i) => (
                      <motion.div key={w.id}
                        initial={{ y: -260, opacity: 0, rotate: i % 2 ? 8 : -8 }} animate={{ y: 0, opacity: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 1.1 + i * 0.25 }}
                        className="flex items-center gap-3 rounded-[22px] bg-white p-3 text-left text-inchiostro shadow-soft">
                        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-b from-sole/80 to-[#fbe3b0] text-2xl">{winIcon(w.icon)}</span>
                        <span className="font-title text-lg leading-tight">{w.title}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-1" />
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="mt-10 w-full space-y-2">
                {result.levelUp && (
                  <Button className="w-full bg-none !bg-sole py-4 text-lg !text-[#5a3a05]" onClick={() => showLevelUp(result.levelUp)}>✨ Hai una proposta: livello {result.levelUp.to}</Button>
                )}
                <Button variant="light" className="w-full py-4 text-lg" onClick={() => nav('/', { replace: true })}>Torna a oggi</Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
