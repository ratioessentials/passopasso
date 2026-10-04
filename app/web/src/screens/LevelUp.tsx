import { AnimatePresence, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { LevelUp } from '../api/types'
import { levelInfo, LEVEL_COLORS } from '../content/copy'
import { useStore } from '../lib/store'
import { Button, LevelIcon } from '../ui/kit'
import { spring } from '../ui/motion'

export function LevelUpOverlay() {
  const { levelUp, showLevelUp, setMe, loadMe, toast } = useStore()
  const [phase, setPhase] = useState<'ask' | 'celebrate'>('ask')
  const [lu, setLu] = useState<LevelUp | null>(null)
  const [busy, setBusy] = useState(false)
  const nav = useNavigate()

  useEffect(() => { if (levelUp) { setLu(levelUp); setPhase('ask') } }, [levelUp])

  async function accept() {
    setBusy(true)
    try {
      const me = await api.acceptLevel()
      if (me && (me as { level?: unknown }).level) setMe(me)
      else void loadMe()
      setPhase('celebrate')
    } catch (e) {
      toast((e as Error).message, '🌿')
    } finally {
      setBusy(false)
    }
  }

  function close() {
    showLevelUp(null)
    if (phase === 'celebrate') { void loadMe(); nav('/', { replace: true }) }
  }

  return (
    <AnimatePresence>
      {levelUp && lu && phase === 'ask' && (
        <motion.div key="ask" className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-inchiostro/45 backdrop-blur-sm" onClick={close} />
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.gentle}
            drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 120) close() }}
            className="safe-bottom relative w-full rounded-t-[34px] bg-white px-6 pt-3 text-center shadow-[0_-20px_60px_-20px_rgb(18_49_58/.5)]">
            <div className="mx-auto mb-6 h-1.5 w-10 rounded-full bg-inchiostro/15" />
            <div className="flex items-center justify-center gap-4">
              <LevelIcon n={lu.from} size={64} style={{ opacity: 0.55 }} />
              <motion.span animate={{ x: [0, 6, 0] }} transition={{ duration: 1.2, repeat: Infinity }} className="text-2xl text-acqua">→</motion.span>
              <LevelIcon n={lu.to} size={84} initial={{ scale: 0.6, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...spring.bouncy, delay: 0.2 }} />
            </div>
            <h2 className="font-title mt-6 text-[28px] leading-tight text-inchiostro">È il momento del livello {lu.to}, {lu.name}?</h2>
            <p className="mt-2 text-inchiostro/70">Le ultime sedute dicono di sì. Il tuo corpo ti ha portato fin qui: ora si passa a {levelInfo(lu.to).verb.toLowerCase()}, sempre col tuo ritmo. Nessuna fretta, puoi anche restare qui ancora un po'.</p>
            <div className="mt-6 space-y-2 pb-4">
              <Button className="w-full py-4 text-lg" onClick={accept} disabled={busy}>{busy ? 'Un attimo…' : 'Sì, andiamo!'}</Button>
              <Button variant="ghost" className="w-full" onClick={close}>Resto ancora un po' qui</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
      {levelUp && lu && phase === 'celebrate' && <Celebrate key="celebrate" lu={lu} onClose={close} />}
    </AnimatePresence>
  )
}

function Celebrate({ lu, onClose }: { lu: LevelUp; onClose: () => void }) {
  const [step, setStep] = useState(0) // 0 vecchio, 1 trasformazione, 2 nuovo
  const [a1, a2] = LEVEL_COLORS[lu.from]
  const [b1, b2] = LEVEL_COLORS[lu.to]
  const info = levelInfo(lu.to)

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 700)
    const t2 = setTimeout(() => setStep(2), 1500)
    const t3 = setTimeout(() => {
      const colors = ['#2C6975', '#68B2A0', '#CDE0C9', '#E0ECDE', '#FFFFFF']
      void confetti({ particleCount: 120, spread: 100, origin: { y: 0.4 }, colors, disableForReducedMotion: true })
      setTimeout(() => void confetti({ particleCount: 60, angle: 60, spread: 60, origin: { x: 0, y: 0.6 }, colors, disableForReducedMotion: true }), 250)
      setTimeout(() => void confetti({ particleCount: 60, angle: 120, spread: 60, origin: { x: 1, y: 0.6 }, colors, disableForReducedMotion: true }), 400)
    }, 1600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return (
    <motion.div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden px-8 text-center text-white"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0" initial={{ background: `linear-gradient(180deg, ${a1}, ${a2})` }}
        animate={{ background: step >= 1 ? `linear-gradient(180deg, ${b1}, ${b2})` : `linear-gradient(180deg, ${a1}, ${a2})` }} transition={{ duration: 1.2 }} />
      {/* raggi */}
      <motion.div className="absolute left-1/2 top-[38%] h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'repeating-conic-gradient(rgb(255 255 255 / .08) 0deg 10deg, transparent 10deg 20deg)' }}
        initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: step >= 2 ? 1 : 0, scale: 1, rotate: 60 }} transition={{ opacity: { duration: 0.6 }, scale: spring.slow, rotate: { duration: 30, ease: 'linear' } }} />

      <div className="relative mb-10 h-[170px] w-[170px]">
        <motion.div className="absolute inset-[-40%] rounded-full" style={{ background: 'radial-gradient(circle, rgb(255 255 255 / .55), transparent 65%)' }}
          animate={{ scale: step >= 1 ? [0.6, 1.3, 1] : 0.6, opacity: step >= 1 ? 1 : 0 }} transition={{ duration: 1 }} />
        <AnimatePresence>
          {step < 2 ? (
            <motion.div key="old" className="absolute inset-0" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: step === 1 ? 1.15 : 1, opacity: 1, rotate: step === 1 ? -6 : 0 }} exit={{ scale: 0.4, opacity: 0, rotate: 20 }} transition={spring.gentle}>
              <LevelIcon n={lu.from} size={170} />
            </motion.div>
          ) : (
            <motion.div key="new" className="absolute inset-0" initial={{ scale: 1.6, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={spring.bouncy}>
              <LevelIcon n={lu.to} size={170} />
            </motion.div>
          )}
        </AnimatePresence>
        {/* scie di velocità che entrano da sinistra */}
        {step >= 2 && [0, 1, 2].map((i) => (
          <motion.span key={i} className="absolute h-[7px] rounded-full bg-white/80" style={{ top: 64 + i * 22, left: -30 - i * 6, width: 46 - i * 6 }}
            initial={{ x: -140, opacity: 0, scaleX: 0.3 }} animate={{ x: 0, opacity: [0, 1, 0.75], scaleX: 1 }} transition={{ ...spring.gentle, delay: 0.25 + i * 0.08 }} />
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: step >= 2 ? 1 : 0 }} className="relative text-sm font-bold uppercase tracking-[0.2em] text-white/85">Nuovo livello</motion.div>
      <h1 className="font-title relative mt-2 leading-[1.05]">
        <motion.span className="block text-[26px] text-white/90" initial={{ opacity: 0, y: 16 }} animate={step >= 2 ? { opacity: 1, y: 0 } : {}} transition={{ ...spring.gentle, delay: 0.2 }}>Livello {lu.to}</motion.span>
        <span className="block text-[46px]">
          {info.name.split('').map((ch, i) => (
            <motion.span key={i} className="inline-block" initial={{ opacity: 0, y: 24, rotate: 10 }} animate={step >= 2 ? { opacity: 1, y: 0, rotate: 0 } : {}} transition={{ ...spring.bouncy, delay: 0.35 + i * 0.04 }}>
              {ch}
            </motion.span>
          ))}
        </span>
      </h1>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={step >= 2 ? { opacity: 1, y: 0 } : {}} transition={{ delay: 1.1 }} className="relative mt-3 text-lg text-white/90">
        Adesso si va di {info.verb.toLowerCase()}. Te lo sei guadagnato, passo dopo passo.
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={step >= 2 ? { opacity: 1, y: 0 } : {}} transition={{ ...spring.gentle, delay: 1.5 }} className="relative mt-12 w-full">
        <Button variant="light" className="w-full py-4 text-lg" onClick={onClose}>Continua</Button>
      </motion.div>
    </motion.div>
  )
}
