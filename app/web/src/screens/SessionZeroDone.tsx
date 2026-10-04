import confetti from 'canvas-confetti'
import { motion } from 'motion/react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button, MeshBackground } from '../ui/kit'
import { spring } from '../ui/motion'

/** Fine della seduta zero: la prima vittoria, prima di qualsiasi domanda. */
export default function SessionZeroDone() {
  const nav = useNavigate()
  const { state } = useLocation() as { state?: { win?: { title: string } } }
  useEffect(() => {
    const t = setTimeout(() => confetti({ particleCount: 90, spread: 70, origin: { y: 0.55 }, colors: ['#2C6975', '#68B2A0', '#CDE0C9', '#ffffff'] }), 500)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="relative flex min-h-full flex-col text-white">
      <MeshBackground level={1} />
      <div className="safe-top relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <motion.div initial={{ scale: 0.4, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={spring.bouncy} className="mb-6 grid h-28 w-28 place-items-center rounded-[32px] bg-white/20 text-6xl shadow-soft backdrop-blur">
          🌱
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="text-xs font-bold uppercase tracking-wider text-white/80">Prima vittoria</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="font-title mt-1 text-[40px] leading-[1]">
          {state?.win?.title ?? 'Primi 5 minuti'}
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mt-4 max-w-[300px] text-[16px] leading-relaxed text-white/90">
          Fatto. Senza compilare niente, ti sei già mosso. Vuoi che costruisca il tuo percorso?
        </motion.p>
      </div>
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.7 }} className="safe-bottom relative flex flex-col gap-3 px-7 pb-10">
        <Button variant="light" className="py-4 text-lg" onClick={() => nav('/scheda', { replace: true })}>Costruisci il mio percorso</Button>
        <Button variant="ghost" className="text-white/90 underline decoration-white/40 underline-offset-4" onClick={() => nav('/benvenuto', { replace: true })}>Più tardi</Button>
      </motion.div>
    </div>
  )
}
