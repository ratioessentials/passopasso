import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { PlansResponse } from '../api/types'
import { ErrorBox, Header, Skeleton } from '../ui/kit'
import { spring, stagger } from '../ui/motion'

/** Il tuo piano: Free e Plus, con le promesse anti-dark-pattern in evidenza. Nessun pagamento nella demo. */
export default function Plans() {
  const nav = useNavigate()
  const [data, setData] = useState<PlansResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.plans().then(setData).catch((e: Error) => setError(e.message)) }, [])

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-12">
      <Header title="Il tuo piano" subtitle="Semplice e onesto, come il resto." onBack={() => nav(-1)} />
      {error && <ErrorBox message={error} />}
      {!data && !error && <div className="space-y-3 px-5"><Skeleton className="h-40" /><Skeleton className="h-56" /></div>}
      {data && (
        <div className="space-y-4 px-5">
          {data.demo && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring.bouncy}
              className="rounded-full bg-white/90 px-4 py-2 text-center text-sm font-bold text-petrolio shadow-sm">✨ Nella demo è tutto sbloccato</motion.div>
          )}

          {data.promises.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(0)}
              className="rounded-[26px] bg-gradient-to-b from-petrolio to-acqua p-5 text-white shadow-soft">
              <div className="font-title text-xl">Le nostre promesse</div>
              <ul className="mt-3 space-y-2">
                {data.promises.map((p, i) => (
                  <motion.li key={p} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={stagger(i + 1)} className="flex gap-2.5 text-[15px]">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-petrolio">✓</span>{p}
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}

          {data.plans.map((p, i) => {
            const plus = /plus/i.test(p.id + p.name)
            return (
              <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(i + 2)}
                className={`relative rounded-[26px] p-5 shadow-[0_8px_20px_-14px_rgb(44_105_117/.6)] ${plus ? 'bg-white ring-2 ring-acqua' : 'bg-white/75'}`}>
                {plus && <span className="absolute -top-3 right-5 rounded-full bg-sole px-3 py-1 text-xs font-bold text-[#5a3a05]">Tutto il percorso</span>}
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-title text-[26px] text-inchiostro">{p.name}</div>
                  {p.price && <div className="text-right text-sm font-semibold text-petrolio">{p.price}</div>}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {p.features.map((f) => <li key={f} className="flex gap-2 text-[14.5px] text-inchiostro/85"><span className="text-acqua">✦</span>{f}</li>)}
                </ul>
              </motion.div>
            )
          })}
          <p className="px-2 text-center text-xs text-inchiostro/55">Nessun pagamento nella demo. Nell'app nativa: abbonamento dagli store, cancellabile in un tocco.</p>
        </div>
      )}
    </div>
  )
}
