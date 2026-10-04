import { AnimatePresence, motion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { HealthScreening, Job, PersonCard, Sex } from '../api/types'
import { useStore } from '../lib/store'
import { Button, Header } from '../ui/kit'
import { press, spring } from '../ui/motion'
import { Minor } from './Minor'

const SEX: { v: Sex; label: string }[] = [
  { v: 'f', label: 'Donna' }, { v: 'm', label: 'Uomo' }, { v: 'altro', label: 'Altro' }, { v: 'non_dico', label: 'Preferisco non dirlo' },
]
const JOB: { v: Job; label: string; icon: string }[] = [
  { v: 'seduto', label: 'Seduto', icon: '🪑' }, { v: 'in_piedi', label: 'In piedi', icon: '🧍' }, { v: 'fisico', label: 'Fisico', icon: '🏗️' },
]
const PARQ: { k: Exclude<keyof HealthScreening, 'notes'>; q: string }[] = [
  { k: 'heartCondition', q: 'Un medico ti ha mai detto che hai un problema al cuore o la pressione alta?' },
  { k: 'chestPain', q: 'Senti dolore al petto, a riposo o quando fai fatica?' },
  { k: 'dizziness', q: 'Nell\'ultimo anno hai perso l\'equilibrio per un capogiro o sei svenuto/a?' },
  { k: 'jointIssue', q: 'Hai un problema a ossa o articolazioni che il movimento potrebbe peggiorare?' },
  { k: 'medication', q: 'Prendi farmaci per il cuore o la pressione?' },
  { k: 'pregnancy', q: 'Sei incinta o hai partorito negli ultimi 6 mesi?' },
  { k: 'otherCondition', q: 'C\'è un\'altra ragione per cui non dovresti fare attività fisica?' },
]

export const EMPTY_HEALTH: HealthScreening = { heartCondition: false, chestPain: false, dizziness: false, jointIssue: false, medication: false, pregnancy: false, otherCondition: false, notes: '' }

function cardFromProfile(p: Partial<PersonCard> | undefined): PersonCard {
  return {
    name: p?.name ?? '', age: p?.age ?? 35, sex: p?.sex ?? 'non_dico', heightCm: p?.heightCm ?? 170, weightKg: p?.weightKg ?? 70,
    job: p?.job ?? 'seduto', sleepHours: p?.sleepHours ?? 7, health: { ...EMPTY_HEALTH, ...(p?.health ?? {}) },
  }
}

/** "La tua scheda": chi sei + salute (PAR-Q+). mode "new" prima della chat, "edit" dal Coach. */
export default function Scheda({ mode = 'new' }: { mode?: 'new' | 'edit' }) {
  const nav = useNavigate()
  const { me, loadMe, toast } = useStore()
  const [card, setCard] = useState<PersonCard>(() => cardFromProfile(mode === 'edit' ? me?.profile : undefined))
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [busy, setBusy] = useState(false)
  const [caution, setCaution] = useState<string | null>(null)
  const [minor, setMinor] = useState(false)
  const set = <K extends keyof PersonCard>(k: K, v: PersonCard[K]) => setCard((c) => ({ ...c, [k]: v }))
  const setH = (k: keyof HealthScreening, v: boolean | string) => setCard((c) => ({ ...c, health: { ...c.health, [k]: v } }))

  const canNext = step === 0 ? card.name.trim().length > 0 && card.age > 0 : true

  async function submit() {
    setBusy(true)
    try {
      const payload = { ...card, name: card.name.trim() }
      if (mode === 'edit') {
        const r = await api.patchProfile(payload)
        await loadMe()
        if (r.cautionMessage) { setCaution(r.cautionMessage); return }
        toast('Scheda aggiornata. Il piano ne tiene conto.', '✅')
        nav(-1)
        return
      }
      if (payload.age < 16) { setMinor(true); return }
      const r = await api.profileCard(payload)
      if (r.cautionMessage) setCaution(r.cautionMessage)
      else nav('/onboarding', { replace: true, state: { name: payload.name } })
    } catch (e) {
      toast((e as Error).message, '🌿')
    } finally {
      setBusy(false)
    }
  }

  if (minor) return <Minor />
  if (caution) return <Caution message={caution} onGo={() => (mode === 'edit' ? nav(-1) : nav('/onboarding', { replace: true, state: { name: card.name.trim() } }))} />

  const next = () => { setDir(1); if (step === 0) setStep(1); else void submit() }
  const back = () => { setDir(-1); if (step === 1) setStep(0); else nav(-1) }

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-salvia to-salvia-chiaro">
      <Header title={mode === 'edit' ? 'La mia scheda' : 'La tua scheda'} subtitle={step === 0 ? 'Chi sei' : 'La tua salute'} onBack={back} />
      <div className="mx-5 mb-4 flex gap-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-petrolio/15">
            <motion.div className="h-full origin-left rounded-full bg-gradient-to-r from-petrolio to-acqua" initial={false} animate={{ scaleX: step >= i ? 1 : 0 }} transition={spring.gentle} />
          </div>
        ))}
      </div>

      <div className="relative flex-1 overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div key={step} custom={dir} initial={{ x: 300 * dir, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -300 * dir, opacity: 0 }} transition={spring.gentle} className="space-y-3 px-5 pb-24">
            {step === 0 ? (
              <>
                <Field label="Come ti chiami?">
                  <input value={card.name} onChange={(e) => set('name', e.target.value)} placeholder="Il tuo nome" autoComplete="given-name"
                    className="font-title w-full rounded-2xl border border-petrolio/15 bg-white px-4 py-3 text-2xl text-inchiostro outline-none focus:border-acqua" />
                </Field>
                <Field label="Quanti anni hai?">
                  <Stepper value={card.age} min={10} max={95} onChange={(v) => set('age', v)} unit="anni" />
                </Field>
                <Field label="Sesso">
                  <Chips options={SEX} value={card.sex} onChange={(v) => set('sex', v)} />
                </Field>
                <Field label="Altezza">
                  <Slider value={card.heightCm} min={130} max={210} step={1} unit="cm" onChange={(v) => set('heightCm', v)} />
                </Field>
                <Field label="Peso" hint="Serve solo per tarare il carico. Non lo useremo mai come obiettivo e non te lo rimostreremo.">
                  <Slider value={card.weightKg} min={35} max={180} step={1} unit="kg" onChange={(v) => set('weightKg', v)} />
                </Field>
                <Field label="Il tuo lavoro">
                  <div className="grid grid-cols-3 gap-2">
                    {JOB.map((j) => (
                      <Choice key={j.v} on={card.job === j.v} onClick={() => set('job', j.v)} layoutId="job"><span className="text-2xl">{j.icon}</span>{j.label}</Choice>
                    ))}
                  </div>
                </Field>
                <Field label="Quanto dormi di solito?">
                  <Slider value={card.sleepHours} min={4} max={10} step={0.5} unit="ore" onChange={(v) => set('sleepHours', v)} format={(v) => String(v).replace('.', ',')} />
                </Field>
              </>
            ) : (
              <>
                <p className="px-1 text-sm text-inchiostro/70">Sette domande dello screening PAR-Q+, quello usato dai professionisti. Rispondi sì o no: decidiamo insieme da dove partire, in sicurezza.</p>
                {PARQ.map((p, i) => (
                  <motion.div key={p.k} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: i * 0.04 }}
                    className="flex items-center gap-3 rounded-[20px] bg-white/85 p-4 shadow-[0_8px_20px_-14px_rgb(44_105_117/.6)]">
                    <p className="flex-1 text-[14.5px] leading-snug text-inchiostro">{p.q}</p>
                    <Toggle on={card.health[p.k]} onChange={(v) => setH(p.k, v)} />
                  </motion.div>
                ))}
                <Field label="Qualcosa da aggiungere?" hint="Condizioni, farmaci, interventi: lo teniamo presente.">
                  <textarea value={card.health.notes} onChange={(e) => setH('notes', e.target.value)} rows={3} placeholder="Facoltativo"
                    className="w-full resize-none rounded-2xl border border-petrolio/15 bg-white px-4 py-3 text-[15px] outline-none focus:border-acqua" />
                </Field>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="safe-bottom sticky bottom-0 bg-gradient-to-t from-salvia-chiaro via-salvia-chiaro to-transparent px-5 pt-4">
        <Button className="w-full py-4 text-lg" onClick={next} disabled={!canNext || busy} whileTap={{ scale: 0.94 }} transition={spring.bouncy}>
          {busy ? 'Un attimo…' : step === 0 ? 'Avanti' : mode === 'edit' ? 'Salva' : 'Avanti'}
        </Button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="rounded-[24px] bg-white/60 p-4 shadow-[0_8px_20px_-16px_rgb(44_105_117/.6)]">
      <div className="font-title mb-2 text-[17px] text-inchiostro">{label}</div>
      {children}
      {hint && <p className="mt-2 text-[12.5px] leading-snug text-inchiostro/60">{hint}</p>}
    </div>
  )
}

function Choice({ on, onClick, children, layoutId }: { on: boolean; onClick: () => void; children: ReactNode; layoutId: string }) {
  return (
    <motion.button whileTap={press} onClick={onClick} className={`relative flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-sm font-semibold ${on ? 'text-white' : 'bg-white text-petrolio'}`}>
      {on && <motion.span layoutId={layoutId} transition={spring.snappy} className="absolute inset-0 rounded-2xl bg-gradient-to-b from-petrolio to-acqua" />}
      <span className="relative flex flex-col items-center gap-1">{children}</span>
    </motion.button>
  )
}

function Chips<T extends string>({ options, value, onChange }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <motion.button key={o.v} whileTap={press} onClick={() => onChange(o.v)}
          className={`relative rounded-full px-4 py-2 text-sm font-semibold ${value === o.v ? 'text-white' : 'bg-white text-petrolio'}`}>
          {value === o.v && <motion.span layoutId="sexchip" transition={spring.snappy} className="absolute inset-0 rounded-full bg-gradient-to-b from-petrolio to-acqua" />}
          <span className="relative">{o.label}</span>
        </motion.button>
      ))}
    </div>
  )
}

function Stepper({ value, min, max, onChange, unit }: { value: number; min: number; max: number; onChange: (v: number) => void; unit: string }) {
  const btn = 'grid h-12 w-12 place-items-center rounded-full bg-white text-2xl font-bold text-petrolio shadow-sm'
  return (
    <div className="flex items-center justify-between">
      <motion.button whileTap={{ scale: 0.88 }} className={btn} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Meno">−</motion.button>
      <div className="text-center">
        <motion.span key={value} initial={{ y: -8, opacity: 0.4 }} animate={{ y: 0, opacity: 1 }} transition={spring.snappy} className="font-title inline-block text-[44px] leading-none text-petrolio">{value}</motion.span>
        <span className="ml-1.5 text-sm text-inchiostro/60">{unit}</span>
      </div>
      <motion.button whileTap={{ scale: 0.88 }} className={btn} onClick={() => onChange(Math.min(max, value + 1))} aria-label="Più">+</motion.button>
    </div>
  )
}

function Slider({ value, min, max, step, unit, onChange, format = String }: { value: number; min: number; max: number; step: number; unit: string; onChange: (v: number) => void; format?: (v: number) => string }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="mb-2 text-center">
        <span className="font-title text-[40px] leading-none text-petrolio">{format(value)}</span>
        <span className="ml-1.5 text-sm text-inchiostro/60">{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="pp-range w-full" style={{ background: `linear-gradient(90deg, #2C6975 0%, #68B2A0 ${pct}%, rgb(44 105 117 / .12) ${pct}%)` }} />
    </div>
  )
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex shrink-0 rounded-full bg-petrolio/10 p-1 text-sm font-semibold">
      {[false, true].map((v) => (
        <button key={String(v)} onClick={() => onChange(v)} className={`relative rounded-full px-3.5 py-1.5 ${on === v ? 'text-white' : 'text-petrolio/70'}`}>
          {on === v && <motion.span layout transition={spring.snappy} className={`absolute inset-0 rounded-full ${v ? 'bg-petrolio' : 'bg-acqua'}`} />}
          <span className="relative">{v ? 'Sì' : 'No'}</span>
        </button>
      ))}
    </div>
  )
}

function Caution({ message, onGo }: { message: string; onGo: () => void }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-gradient-to-b from-salvia-chiaro to-white px-8 text-center">
      <motion.div className="relative mb-8 grid h-28 w-28 place-items-center" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.gentle}>
        <motion.div className="absolute inset-0 rounded-full bg-acqua/25" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} />
        <span className="relative text-5xl">🩺</span>
      </motion.div>
      <h1 className="font-title text-[30px] leading-tight text-inchiostro">Partiamo con prudenza</h1>
      <p className="mt-4 text-[16px] leading-relaxed text-inchiostro/80">{message}</p>
      <p className="mt-4 text-sm text-inchiostro/60">Quando il medico ti dà l'ok, dillo al coach: sblocchiamo il resto del percorso.</p>
      <Button className="mt-10 w-full" onClick={onGo}>Ho capito, andiamo avanti</Button>
    </div>
  )
}
