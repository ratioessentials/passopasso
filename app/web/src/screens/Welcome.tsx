import { motion } from 'motion/react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { api, setUserId } from '../api/client'
import { copy, LEVELS } from '../content/copy'
import { useStore } from '../lib/store'
import { Button, LevelIcon, MeshBackground } from '../ui/kit'
import { spring, stagger } from '../ui/motion'

export default function Welcome() {
  const nav = useNavigate()
  const { loadMe, toast } = useStore()
  const [busy, setBusy] = useState<'new' | 'demo' | null>(null)

  async function start() {
    setBusy('new')
    try {
      const { userId } = await api.createUser()
      setUserId(userId)
      nav('/onboarding')
    } catch (e) {
      toast((e as Error).message, '🌿')
      setBusy(null)
    }
  }

  async function demo() {
    setBusy('demo')
    setUserId('demo')
    // ?reset nell'indirizzo riporta il demo allo stato iniziale (prima di registrare o presentare)
    if (new URLSearchParams(window.location.search).has('reset')) await api.demoReset().catch(() => {})
    await loadMe()
    nav('/', { replace: true })
  }

  return (
    <div className="relative flex min-h-full flex-col text-white">
      <MeshBackground level={3} />
      <div className="safe-top relative flex flex-1 flex-col px-7 pb-10">
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {/* i 5 livelli come una scala che sale */}
          <div className="relative mb-10 h-[170px] w-[310px]">
            {LEVELS.map((l, i) => {
              const size = 46 + i * 8
              return (
                <motion.div
                  key={l.n}
                  className="absolute bottom-0"
                  style={{ left: i * 58 + (4 - i) * 2, marginBottom: i * 22 }}
                  initial={{ opacity: 0, y: 40, scale: 0.5 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ ...stagger(i, 0.12), delay: 0.1 + i * 0.12 }}
                >
                  <div style={{ animation: `floaty ${4 + i * 0.6}s ease-in-out ${i * 0.3}s infinite` }}>
                    <LevelIcon n={l.n} size={size} style={{ opacity: 0.6 + i * 0.1 }} />
                  </div>
                </motion.div>
              )
            })}
          </div>
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.4 }} className="font-title text-[54px] leading-[0.95]">
            PassoPasso
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.5 }} className="font-title mt-3 text-[24px] leading-tight text-white/95">
            {copy['welcome.title']}
          </motion.p>
          <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.6 }} className="mt-4 max-w-[300px] text-[15px] leading-relaxed text-white/85">
            {copy['welcome.subtitle']}
          </motion.p>
        </div>
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.75 }} className="flex flex-col gap-3">
          <Button variant="light" className="py-4 text-lg" onClick={start} disabled={!!busy}>
            {busy === 'new' ? 'Un attimo…' : 'Iniziamo'}
          </Button>
          <Button variant="ghost" className="text-white/90 underline decoration-white/40 underline-offset-4" onClick={demo} disabled={!!busy}>
            {busy === 'demo' ? 'Carico Giulia…' : 'Prova con l\'utente demo'}
          </Button>
        </motion.div>
      </div>
    </div>
  )
}
