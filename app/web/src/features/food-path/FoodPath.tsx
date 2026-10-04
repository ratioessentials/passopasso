import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { foodPathApi, PHASE_FALLBACK, type FoodPathResponse, type FoodPhase, type FoodPhaseId, type FoodStep } from '../../api/foodPath'
import { ErrorBox, Header, Skeleton } from '../../ui/kit'
import { press, spring, stagger } from '../../ui/motion'

/**
 * Il percorso alimentare, come il Percorso dei livelli: tre fasi (Sostituire, Aggiungere, Come mangi)
 * con le tappe, "sei qui", le tappe saltate con il motivo. Rotta consigliata: /cibo/percorso.
 */
export function FoodPath() {
  const nav = useNavigate()
  const [data, setData] = useState<FoodPathResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const load = () => foodPathApi.path().then((d) => { setData(d); setError(null) }).catch((e: Error) => setError(e.message))
  useEffect(() => { void load() }, [])

  const phases: FoodPhase[] = data?.phases?.length ? data.phases : (Object.keys(PHASE_FALLBACK) as FoodPhaseId[]).map((id) => ({ id, ...PHASE_FALLBACK[id] }))
  const steps = data?.steps ?? []
  const doneCount = steps.filter((s) => s.status === 'done').length
  const currentIdx = steps.findIndex((s) => s.status === 'current')

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia via-salvia-chiaro to-white pb-tabbar">
      <Header title="Percorso alimentare" subtitle="Niente calorie. Prima togli, poi aggiungi, poi impari come mangi." onBack={() => nav(-1)} />
      {error && <ErrorBox message={error} onRetry={load} />}

      <div className="px-5">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(0)}
          className="relative overflow-hidden rounded-[26px] bg-gradient-to-br from-petrolio to-acqua p-5 text-white shadow-soft">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
          <div className="relative">
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/75">Una cosa sola alla volta</div>
            <p className="font-title mt-1 text-[22px] leading-tight">{data?.intro ?? 'Ora che ti alleni non devi mangiare perfetto. Cambiamo una cosa sola alla volta.'}</p>
            {steps.length > 0 && (
              <div className="mt-4 flex items-end gap-5">
                <div><div className="font-title text-[34px] leading-none">{doneCount}</div><div className="text-xs text-white/80">abitudini tue</div></div>
                <div><div className="font-title text-[34px] leading-none">{steps.filter((s) => s.status !== 'skipped').length}</div><div className="text-xs text-white/80">tappe in tutto</div></div>
                <div className="flex-1" />
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/25">
                  <motion.div className="h-full origin-left rounded-full bg-white" initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0.04, doneCount / Math.max(1, steps.filter((s) => s.status !== 'skipped').length)) }} transition={{ ...spring.slow, delay: 0.4 }} />
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {!data && !error && <div className="mt-5 space-y-3 px-5"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}

      {data && (
        <div className="relative mt-6 px-5">
          {/* linea del percorso */}
          <div className="absolute bottom-6 left-[41px] top-4 w-1 rounded-full bg-petrolio/10" />
          <motion.div className="absolute left-[41px] top-4 w-1 origin-top rounded-full bg-gradient-to-b from-acqua to-petrolio"
            style={{ height: `${Math.max(0, Math.min(100, ((currentIdx < 0 ? steps.length : currentIdx + 0.5) / Math.max(1, steps.length)) * 100))}%` }}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ ...spring.slow, delay: 0.3 }} />

          <div className="space-y-6">
            {phases.map((ph, pi) => {
              const fb = PHASE_FALLBACK[ph.id as FoodPhaseId]
              const mine = steps.filter((s) => (s.phase ?? s.habit.phase ?? phaseOf(s, phases, steps)) === ph.id)
              const phaseState = mine.length === 0 ? 'next' : mine.every((s) => s.status === 'done' || s.status === 'skipped') ? 'done' : mine.some((s) => s.status === 'current') ? 'now' : 'next'
              return (
                <motion.section key={ph.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={stagger(pi, 0.1)}>
                  <div className="relative flex items-center gap-3 pl-[2px]">
                    <span className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-full text-base shadow-[0_6px_14px_-8px_rgb(44_105_117/.8)] ${phaseState === 'done' ? 'bg-gradient-to-b from-petrolio to-acqua' : phaseState === 'now' ? 'bg-white ring-2 ring-acqua' : 'bg-white/80'}`}>
                      {phaseState === 'done' ? <span className="text-sm font-extrabold text-white">✓</span> : fb?.icon ?? '•'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-acqua">Fase {pi + 1} · settimane {ph.weeks}</span>
                        {phaseState === 'now' && <span className="rounded-full bg-petrolio px-2 py-0.5 text-[10px] font-bold text-white">in corso</span>}
                      </div>
                      <div className="font-title text-[22px] leading-tight text-inchiostro">{ph.title}</div>
                      <p className="text-[12.5px] leading-snug text-inchiostro/60">{ph.subtitle ?? ph.note ?? fb?.subtitle}</p>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 pl-12">
                    {mine.map((s, si) => <StepRow key={s.habit.id} s={s} i={si} open={open === s.habit.id} onToggle={() => setOpen(open === s.habit.id ? null : s.habit.id)} />)}
                  </div>
                </motion.section>
              )
            })}
          </div>
        </div>
      )}

      {data && (
        <p className="mt-8 px-8 text-center text-[12px] leading-snug text-inchiostro/50">
          L'ordine è il tuo: le tappe che fai già le saltiamo, e ti diciamo perché. Se hai una condizione medica o una dieta prescritta, valgono le indicazioni di chi ti segue.
        </p>
      )}
    </div>
  )
}

/** Se il server non manda `phase` nell'abitudine, si ricava dalla posizione nelle fasi (quattro tappe ciascuna). */
function phaseOf(s: FoodStep, phases: { id: string }[], steps: FoodStep[]): string {
  const per = Math.ceil(steps.length / Math.max(1, phases.length))
  const idx = steps.indexOf(s)
  return phases[Math.min(phases.length - 1, Math.floor(idx / per))]?.id ?? phases[0]?.id ?? 'sostituire'
}

function StepRow({ s, i, open, onToggle }: { s: FoodStep; i: number; open: boolean; onToggle: () => void }) {
  const st = s.status
  const dim = st === 'next' || st === 'skipped'
  return (
    <motion.button layout whileTap={press} onClick={onToggle} initial={{ opacity: 0, y: 8 }} animate={{ opacity: dim ? 0.72 : 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.05 + i * 0.05 }}
      className={`relative w-full overflow-hidden rounded-[22px] p-3.5 text-left ${st === 'current' ? 'bg-white shadow-soft ring-2 ring-acqua/50' : 'bg-white/75'}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-extrabold ${st === 'done' ? 'bg-gradient-to-b from-petrolio to-acqua text-white' : st === 'current' ? 'bg-petrolio text-white' : st === 'skipped' ? 'bg-salvia text-petrolio/70' : 'bg-petrolio/8 text-petrolio/60'}`}>
          {st === 'done' ? '✓' : st === 'skipped' ? '↷' : s.order}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`font-semibold leading-snug text-inchiostro ${st === 'skipped' ? 'line-through decoration-petrolio/30' : ''}`}>{s.habit.title}</span>
            {st === 'current' && <span className="rounded-full bg-petrolio px-2 py-0.5 text-[10px] font-bold text-white">sei qui</span>}
            {st === 'done' && <span className="rounded-full bg-acqua/15 px-2 py-0.5 text-[10px] font-bold text-petrolio">✓ tua</span>}
          </div>
          {st === 'skipped' && (
            <p className="mt-0.5 text-[12.5px] text-petrolio/80">Saltata: {s.skippedWhy?.trim() || 'la fai già'}. Niente da aggiungere.</p>
          )}
          <AnimatePresence initial={false}>
            {open && (
              <motion.div key="more" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring.gentle} className="overflow-hidden">
                {s.why && <p className="mt-2 text-[13px] font-semibold leading-snug text-petrolio">{s.why}</p>}
                <p className="mt-2 text-[13.5px] leading-snug text-inchiostro/75">{s.habit.why}</p>
                {s.habit.tips?.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {s.habit.tips.map((t, j) => <li key={j} className="flex gap-2 text-[13px] text-inchiostro/70"><span className="text-acqua">✦</span>{t}</li>)}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={spring.snappy} className="mt-1 text-petrolio/60">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
        </motion.span>
      </div>
    </motion.button>
  )
}
