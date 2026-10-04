import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { LevelsResponse } from '../api/types'
import { LEVELS, levelInfo, TRACK_LABELS } from '../content/copy'
import { useStore } from '../lib/store'
import { Button, ErrorBox, Header, LevelIcon } from '../ui/kit'
import { spring, stagger } from '../ui/motion'

export default function Path() {
  const { me } = useStore()
  const nav = useNavigate()
  const [data, setData] = useState<LevelsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.levels().then(setData).catch((e: Error) => setError(e.message)) }, [])

  const current = data?.current ?? me?.level.n ?? 1
  const track = me?.profile?.track
  // il server può già mandare i verbi del percorso; altrimenti si usano quelli di riserva
  const verbOf = (n: number, v: string) => (v !== LEVELS[n - 1]?.verb ? v : levelInfo(n, track).verb)
  const levels = data?.levels?.length ? data.levels : LEVELS.map((l) => ({ ...l, goal: '', weeks: [2, 3] as [number, number], sessionsPerWeek: 3 }))

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia via-salvia-chiaro to-white pb-tabbar">
      <Header title={track ? `Percorso ${TRACK_LABELS[track] ?? track}` : 'Il tuo percorso'} subtitle="Si sale per prontezza, non per calendario. E non si torna mai a zero." />
      {error && <ErrorBox message={error} />}
      <div className="relative px-5 pt-2">
        {/* linea del percorso */}
        <div className="absolute bottom-10 left-[57px] top-10 w-1 rounded-full bg-petrolio/10" />
        <motion.div className="absolute left-[57px] top-10 w-1 origin-top rounded-full bg-gradient-to-b from-acqua to-petrolio"
          style={{ height: `calc(${((current - 1) / 4) * 100}% - ${((current - 1) / 4) * 80}px)` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ ...spring.slow, delay: 0.3 }} />
        <div className="space-y-4">
          {levels.map((l, i) => {
            const state = l.n < current ? 'done' : l.n === current ? 'now' : 'next'
            return (
              <motion.div key={l.n} initial={{ opacity: 0, x: -20 }} animate={{ opacity: state === 'next' ? 0.55 : 1, x: 0 }} transition={stagger(i, 0.08)}
                className={`relative flex items-center gap-4 rounded-[26px] p-3 ${state === 'now' ? 'bg-white shadow-soft ring-2 ring-acqua/50' : ''}`}>
                {state === 'now'
                  ? <LevelIcon n={l.n} size={84} layoutId="level-icon" transition={spring.gentle} />
                  : <LevelIcon n={l.n} size={84} style={{ filter: state === 'next' ? 'grayscale(.5)' : undefined }} />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-acqua">Livello {l.n}</span>
                    {state === 'done' && <span className="rounded-full bg-acqua/15 px-2 py-0.5 text-[11px] font-bold text-petrolio">✓ fatto</span>}
                    {state === 'now' && <span className="rounded-full bg-petrolio px-2 py-0.5 text-[11px] font-bold text-white">sei qui</span>}
                  </div>
                  <div className="font-title text-[22px] leading-tight text-inchiostro">{l.name}</div>
                  <div className="text-sm font-semibold text-petrolio">{verbOf(l.n, l.verb)}</div>
                  {l.goal && <p className="mt-1 text-[13px] leading-snug text-inchiostro/65">{l.goal}</p>}
                  {state === 'now' && me && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-petrolio/10">
                      <motion.div className="h-full origin-left rounded-full bg-gradient-to-r from-acqua to-petrolio" initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0.04, me.level.progress) }} transition={{ ...spring.slow, delay: 0.5 }} />
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
      <div className="px-5">
        {me?.level.ready && <Button className="mt-6 w-full" onClick={() => nav('/test')}>✨ Fai il test di prontezza</Button>}
        <Button variant="light" className="mt-3 w-full" onClick={() => nav('/progressi')}>📈 Guarda i tuoi progressi</Button>
        <Button variant="ghost" className="mt-1 w-full" onClick={() => nav('/scienza')}>🔬 Perché funziona</Button>
      </div>
    </div>
  )
}
