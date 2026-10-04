import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { ScienceItem } from '../api/types'
import { ErrorBox, Header, Skeleton } from '../ui/kit'
import { stagger } from '../ui/motion'

/** Perché funziona: le scelte di design con la loro fonte. */
export default function Science() {
  const nav = useNavigate()
  const [items, setItems] = useState<ScienceItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.science().then(setItems).catch((e: Error) => setError(e.message)) }, [])
  return (
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-12">
      <Header title="Perché funziona" subtitle="Ogni scelta dell'app ha una ragione, e una fonte." onBack={() => nav(-1)} />
      {error && <ErrorBox message={error} />}
      <div className="space-y-3 px-5">
        {!items && !error && [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}
        {items?.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(i, 0.05)}
            className="rounded-[22px] bg-white/85 p-4 shadow-[0_8px_20px_-14px_rgb(44_105_117/.6)]">
            <div className="text-[11px] font-bold uppercase tracking-wider text-acqua">Nell'app: {s.inApp}</div>
            <p className="font-title mt-1 text-[18px] leading-snug text-inchiostro">{s.claim}</p>
            <a href={s.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-petrolio underline decoration-petrolio/30 underline-offset-4">
              {s.source} ↗
            </a>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
