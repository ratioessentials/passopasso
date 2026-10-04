import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { explainSession, type ExplainResponse } from '../api/client'
import { spring, stagger } from '../ui/motion'

/** "Perché questa seduta": cosa ha considerato, cosa ha escluso e i 7 controlli superati. */
export function ExplainLink({ sessionId, light = true }: { sessionId: string; light?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`mt-2 text-[12.5px] font-semibold underline decoration-dotted underline-offset-4 ${light ? 'text-white/85' : 'text-petrolio'}`}>
        Come l'ha costruita →
      </button>
      <AnimatePresence>{open && <ExplainSheet sessionId={sessionId} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>
  )
}

const INPUT_LABEL: Record<string, string> = { minutes: 'Tempo', energy: 'Energia', pain: 'Fastidi', readiness: 'Prontezza', impactAllowed: 'Impatto consentito', caution: 'Prudenza', level: 'Livello', track: 'Percorso' }
const fmt = (v: unknown) => Array.isArray(v) ? (v.length ? v.join(', ') : 'nessuno') : typeof v === 'boolean' ? (v ? 'sì' : 'no') : String(v)

export function ExplainSheet({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const [data, setData] = useState<ExplainResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { explainSession(sessionId).then(setData).catch((e: Error) => setError(e.message)) }, [sessionId])
  const passed = data?.checks.filter((c) => c.passed).length ?? 0
  const total = data?.checks.length ?? 7
  return (
    <motion.div className="fixed inset-0 z-40 flex items-end justify-center bg-inchiostro/40 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }} transition={spring.gentle}
        className="safe-bottom max-h-[88%] w-full max-w-[430px] overflow-y-auto rounded-t-[30px] bg-white px-5 pb-8 pt-3 text-inchiostro shadow-2xl">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-inchiostro/15" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-title text-[26px] leading-tight">Perché questa seduta</h2>
            <p className="mt-1 text-[13px] text-inchiostro/65">Il codice decide cosa è sicuro. La seduta viene scelta solo lì dentro. Poi tutto viene ricontrollato.</p>
          </div>
          {data && (
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...spring.bouncy, delay: 0.3 + total * 0.12 }}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold ${passed === total ? 'bg-acqua/25 text-petrolio' : 'bg-sole/40 text-[#7a4f05]'}`}>
              {passed === total ? `Verificata ${passed}/${total}` : `${passed}/${total}`}
            </motion.div>
          )}
        </div>

        {error && <p className="mt-4 rounded-2xl bg-salvia-chiaro p-3 text-sm">{error}</p>}
        {!data && !error && <div className="mt-4 space-y-2"><div className="h-14 animate-pulse rounded-2xl bg-salvia-chiaro" /><div className="h-24 animate-pulse rounded-2xl bg-salvia-chiaro" /></div>}

        {data && (
          <>
            <section className="mt-4">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-acqua">Ha considerato</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(data.inputs).filter(([, v]) => v !== null && v !== undefined && v !== '').map(([k, v]) => (
                  <span key={k} className="rounded-full bg-salvia-chiaro px-3 py-1 text-[12.5px]"><b>{INPUT_LABEL[k] ?? k}:</b> {fmt(v)}</span>
                ))}
              </div>
            </section>

            <section className="mt-4">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-acqua">
                Ha escluso {data.excludedCount ?? data.excluded.length} esercizi{typeof data.candidates === 'number' ? ` · ne restavano ${data.candidates}` : ''}
              </h3>
              {data.excluded.length === 0 ? <p className="text-sm text-inchiostro/65">Nessuna esclusione oggi.</p> : (
                <ul className="space-y-1.5">
                  {data.excluded.slice(0, 6).map((e, i) => (
                    <motion.li key={e.exerciseId + i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={stagger(i, 0.05)} className="flex items-center gap-2 text-[13.5px]">
                      <span className="text-inchiostro/40 line-through">{e.name ?? e.exerciseId}</span>
                      <span className="text-inchiostro/75">· {e.reason}</span>
                    </motion.li>
                  ))}
                  {data.excluded.length > 6 && <li className="text-[12.5px] text-inchiostro/55">e altri {data.excluded.length - 6}</li>}
                </ul>
              )}
            </section>

            <section className="mt-4">
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-acqua">Controlli prima di mostrartela</h3>
              <ul className="space-y-1.5">
                {data.checks.map((c, i) => (
                  <motion.li key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ ...spring.snappy, delay: 0.25 + i * 0.12 }} className="flex items-center gap-2.5 text-[14px]">
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...spring.bouncy, delay: 0.3 + i * 0.12 }}
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-white ${c.passed ? 'bg-acqua' : 'bg-[#e0a070]'}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><path d={c.passed ? 'M5 13l4 4L19 7' : 'M6 6l12 12M18 6L6 18'} /></svg>
                    </motion.span>
                    {c.label}
                  </motion.li>
                ))}
              </ul>
            </section>

            {data.ai && (
              <p className="mt-5 text-[11.5px] text-inchiostro/50">
                {data.ai.fallback ? 'Seduta di riserva costruita a regole' : `Generata in ${((data.ai.latencyMs ?? 0) / 1000).toFixed(1)} s`}
                {data.ai.validFirstTry ? ' · valida al primo tentativo' : data.ai.repaired ? ' · corretta automaticamente' : ''}
                {data.ai.model ? ` · ${data.ai.model}` : ''}
              </p>
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  )
}
