import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { inboxApi, whyOf, type Alternatives } from '../../api/inbox'
import type { Session } from '../../api/types'
import { useStore } from '../../lib/store'
import { Button, Skeleton } from '../../ui/kit'
import { press, spring } from '../../ui/motion'
import { WhyCard } from './WhyCard'

/**
 * Compare quando l'utente tocca "Oggi non ce la faccio", prima della scelta del motivo.
 * Mostra il suo perché e propone 10 minuti invece di niente. Senza colpa, senza rosso.
 * - `onSkip`: l'utente salta davvero → chi la usa prosegue con il flusso di skip esistente (foglio dei motivi).
 * - `onClose`: chiude senza fare nulla.
 */
export function SkipGate({ session, onSkip, onClose }: { session: Session; onSkip: () => void; onClose: () => void }) {
  const nav = useNavigate()
  const { me, putSession } = useStore()
  const [alt, setAlt] = useState<Alternatives | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let on = true
    inboxApi.alternatives(session.id, session)
      .then((a) => { if (on) setAlt(a) })
      .catch(() => { if (on) setFailed(true) })
    return () => { on = false }
  }, [session])

  const why = alt?.why ?? whyOf(me)
  const short = alt?.short ?? null
  const level = me?.level.n ?? session.level ?? 1

  function startShort() {
    if (!short) return
    putSession(short)
    onClose()
    nav(`/seduta/${short.id}`)
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-inchiostro/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.gentle}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 110) onClose() }}
        className="safe-bottom relative w-full overflow-hidden rounded-t-[34px] bg-white px-6 pt-3 shadow-[0_-20px_60px_-20px_rgb(18_49_58/.5)]">
        <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-salvia/60 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-inchiostro/15" />
          <h2 className="font-title text-[26px] leading-tight text-inchiostro">Capita. Prima di decidere…</h2>
          <p className="mt-1 text-inchiostro/70">Ti ricordo solo una cosa che hai scritto tu.</p>

          <div className="mt-4">
            <AnimatePresence mode="wait" initial={false}>
              {why ? (
                <WhyCard key="why" why={why} level={level} />
              ) : !failed && !alt ? (
                <Skeleton key="sk" className="h-28" />
              ) : (
                <motion.div key="nowhy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-[26px] bg-salvia-chiaro px-5 py-5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-acqua">Una cosa sola</div>
                  <p className="font-title mt-1 text-[22px] leading-tight text-petrolio">Il percorso non si azzera. Mai.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="mt-5 space-y-2 pb-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 0.15 }}>
              <Button className="w-full py-4 text-[17px]" disabled={!short && !failed} onClick={startShort}>
                {short ? <>10 minuti invece di niente?</> : failed ? 'Non riesco a preparare la versione corta' : 'Preparo una versione corta…'}
              </Button>
              {short && <p className="mt-1.5 px-2 text-center text-xs text-inchiostro/55">{short.reason ?? 'Una versione corta della seduta di oggi. Conta come fatta.'}</p>}
            </motion.div>
            <motion.button whileTap={press} onClick={onSkip} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
              className="w-full rounded-full px-4 py-2.5 text-sm font-semibold text-inchiostro/55">
              Oggi salto davvero
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
