import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { FoodProfile, FoodRecap, FoodToday, Habit, MealFeedback, Plate } from '../api/types'
import { copy } from '../content/copy'
import { useStore } from '../lib/store'
import { Button, Card, Header, RotatingText, Skeleton } from '../ui/kit'
import { press, spring, stagger } from '../ui/motion'

/** Ridimensiona l'immagine a circa 1024px sul lato lungo e la restituisce in JPEG base64. */
async function resize(file: File): Promise<{ b64: string; url: string }> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  await new Promise<void>((ok, ko) => { img.onload = () => ok(); img.onerror = () => ko(new Error('Non riesco a leggere la foto.')); img.src = url })
  const max = 1024
  const k = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * k)
  c.height = Math.round(img.height * k)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  const data = c.toDataURL('image/jpeg', 0.85)
  return { b64: data.split(',')[1], url: data }
}

export default function Food() {
  const { me, loadMe, toast } = useStore()
  const [today, setToday] = useState<FoodToday | null>(null)
  const [habit, setHabit] = useState<(Habit & { why?: string }) | null>(null)
  const [days, setDays] = useState(0)
  const [checked, setChecked] = useState(false)
  const [quiz, setQuiz] = useState(false)

  useEffect(() => { if (!me) void loadMe() }, [me, loadMe])
  useEffect(() => {
    api.foodToday().then((t) => { setToday(t); if (t.habit) setHabit(t.habit); setDays(t.doneDays) }).catch(() => {
      // server senza alimentazione 2.0: si usa l'abitudine di /api/me
      if (me?.habit) { setHabit(me.habit); setDays(me.habit.doneDays) }
    })
  }, [me])

  const needsQuiz = !!me && !me.profile.food

  async function check() {
    if (checked) return
    setChecked(true)
    setDays((d) => Math.min(7, d + 1))
    try { const r = await api.habitCheckin(); setDays(r.doneDays); toast('Fatto anche oggi. Bello.', '🌱') } catch (e) { toast((e as Error).message) }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-tabbar">
      <Header title="Cibo" subtitle="Nessuna caloria da contare. Un'abitudine alla volta." />
      <div className="space-y-4 px-5">
        {(needsQuiz || quiz) && <FoodQuiz onDone={(h, why) => { setHabit({ ...h, why }); setQuiz(false); void loadMe() }} />}

        {today?.training && (
          <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(0)}>
            <div className="text-xs font-semibold uppercase tracking-wider text-acqua">Oggi ti alleni alle {today.training.sessionAt}</div>
            <h3 className="font-title mt-1 text-xl text-inchiostro">Prima e dopo</h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="rounded-2xl bg-white/80 p-3">
                <div className="mb-1 text-lg">🍌</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-petrolio">Prima</div>
                <p className="text-sm leading-snug text-inchiostro/80">{today.training.before}</p>
              </div>
              <div className="rounded-2xl bg-white/80 p-3">
                <div className="mb-1 text-lg">🥗</div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-petrolio">Dopo</div>
                <p className="text-sm leading-snug text-inchiostro/80">{today.training.after}</p>
              </div>
            </div>
          </Card>
        )}

        {!habit ? <Skeleton className="h-48" /> : (
          <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(1)}>
            <div className="text-xs font-semibold uppercase tracking-wider text-acqua">L'abitudine di questa settimana</div>
            <h2 className="font-title mt-1 text-[24px] leading-tight text-inchiostro">{habit.title}</h2>
            {habit.why && <p className="mt-2 text-[14.5px] text-inchiostro/75">{habit.why}</p>}
            {habit.tips?.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {habit.tips.map((t, i) => <li key={i} className="flex gap-2 text-sm text-inchiostro/75"><span className="text-acqua">✦</span>{t}</li>)}
              </ul>
            )}
            <div className="mt-4 flex gap-1.5">
              {[...Array(7)].map((_, i) => (
                <motion.div key={i} className="grid h-9 flex-1 place-items-center rounded-xl text-xs font-bold" animate={{ backgroundColor: i < days ? '#68B2A0' : 'rgba(44,105,117,0.08)', color: i < days ? '#fff' : 'rgba(18,49,58,.35)', scale: i === days - 1 && checked ? [1, 1.2, 1] : 1 }} transition={spring.bouncy}>
                  {i < days ? '✓' : i + 1}
                </motion.div>
              ))}
            </div>
            <Button className="mt-4 w-full" onClick={check} disabled={checked}>{checked ? 'Segnato per oggi ✓' : 'Oggi l\'ho fatto'}</Button>
          </Card>
        )}

        <PhotoCard />
        <RecapCard onNewQuiz={() => setQuiz(true)} />
      </div>
    </div>
  )
}

type Opt = { label: string; v: boolean | number | string }
const Q: { k: keyof FoodProfile; q: string; opts: Opt[] }[] = [
  { k: 'breakfast', q: 'Fai colazione di solito?', opts: [{ label: 'Sì', v: true }, { label: 'Quasi mai', v: false }] },
  { k: 'veggiesPerDay', q: 'Quante volte al giorno mangi verdura?', opts: [{ label: 'Quasi mai', v: 0 }, { label: '1 volta', v: 1 }, { label: '2 volte', v: 2 }, { label: '3 o più', v: 3 }] },
  { k: 'sugaryDrinks', q: 'Bibite zuccherate o succhi?', opts: [{ label: 'Mai', v: 'mai' }, { label: 'A volte', v: 'a_volte' }, { label: 'Spesso', v: 'spesso' }] },
  { k: 'mealsOut', q: 'Quanti pasti fuori casa a settimana?', opts: [{ label: 'Nessuno', v: 0 }, { label: '1-2', v: 2 }, { label: '3-5', v: 4 }, { label: 'Quasi tutti', v: 8 }] },
  { k: 'cooks', q: 'Cucini tu?', opts: [{ label: 'Quasi mai', v: 'mai' }, { label: 'A volte', v: 'a_volte' }, { label: 'Spesso', v: 'spesso' }] },
]

/** Mini-onboarding alimentare: 5 domande a chip, l'AI sceglie l'abitudine da cui partire. */
function FoodQuiz({ onDone }: { onDone: (h: Habit, why: string) => void }) {
  const { toast } = useStore()
  const [i, setI] = useState(0)
  const [ans, setAns] = useState<Record<string, Opt['v']>>({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ habit: Habit; why: string } | null>(null)

  async function pick(v: Opt['v']) {
    const next = { ...ans, [Q[i].k]: v }
    setAns(next)
    if (i + 1 < Q.length) { setI(i + 1); return }
    setBusy(true)
    try { setResult(await api.foodProfile(next as unknown as FoodProfile)) } catch (e) { toast((e as Error).message, '🌿'); setI(0) } finally { setBusy(false) }
  }

  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden">
      {!result && !busy && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-acqua">Come mangi oggi</span>
            <span className="text-xs font-semibold text-inchiostro/50">{i + 1}/{Q.length}</span>
          </div>
          <div className="mb-4 flex gap-1">{Q.map((_, j) => <div key={j} className={`h-1 flex-1 rounded-full ${j <= i ? 'bg-acqua' : 'bg-petrolio/10'}`} />)}</div>
          <AnimatePresence mode="wait">
            <motion.div key={i} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={spring.gentle}>
              <h3 className="font-title text-xl text-inchiostro">{Q[i].q}</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {Q[i].opts.map((o, j) => (
                  <motion.button key={o.label} whileTap={press} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.bouncy, delay: j * 0.05 }}
                    onClick={() => pick(o.v)} className="rounded-full border border-acqua/50 bg-white px-4 py-2.5 text-sm font-semibold text-petrolio">
                    {o.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
          <p className="mt-4 text-xs text-inchiostro/50">Nessun giudizio e nessun numero: serve solo a scegliere da dove partire.</p>
        </>
      )}
      {busy && <div className="py-6 text-center"><RotatingText items={['Guardo le tue risposte…', 'Scelgo l\'abitudine giusta per te…']} className="font-semibold text-petrolio" /></div>}
      {result && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={spring.bouncy}>
          <div className="text-3xl">🌱</div>
          <h3 className="font-title mt-1 text-xl text-inchiostro">Partiamo da qui: {result.habit.title.toLowerCase()}</h3>
          <p className="mt-1 text-sm text-inchiostro/75">{result.why}</p>
          <Button className="mt-4 w-full" onClick={() => onDone(result.habit, result.why)}>Ci sto</Button>
        </motion.div>
      )}
    </Card>
  )
}

/** Il piatto in tre parti: metà verdura, un quarto proteine, un quarto cereali. Gli spicchi si riempiono. */
export function PlateChart({ plate, size = 170 }: { plate: Plate; size?: number }) {
  const R = 46
  const wedge = (a0: number, a1: number) => {
    const p = (a: number) => [50 + R * Math.cos((a - 90) * Math.PI / 180), 50 + R * Math.sin((a - 90) * Math.PI / 180)]
    const [x0, y0] = p(a0), [x1, y1] = p(a1)
    return `M50,50 L${x0},${y0} A${R},${R} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1},${y1} Z`
  }
  const parts = [
    { key: 'veggies', label: 'Verdura', a: [0, 180], color: '#68B2A0', fill: Math.min(1, plate.veggies / 0.5) },
    { key: 'protein', label: 'Proteine', a: [180, 270], color: '#E59A7E', fill: Math.min(1, plate.protein / 0.25) },
    { key: 'grains', label: 'Cereali', a: [270, 360], color: '#E8C66B', fill: Math.min(1, plate.grains / 0.25) },
  ]
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" width={size} height={size} className="shrink-0 drop-shadow-[0_10px_18px_rgb(44_105_117/.25)]">
        <circle cx="50" cy="50" r="49" fill="#fff" />
        {parts.map((p, i) => (
          <g key={p.key}>
            <path d={wedge(p.a[0], p.a[1])} fill={p.color} opacity={0.15} />
            <motion.path d={wedge(p.a[0], p.a[1])} fill={p.color} style={{ transformOrigin: '50px 50px' }}
              initial={{ scale: 0 }} animate={{ scale: Math.max(0.08, Math.sqrt(p.fill)) }} transition={{ type: 'spring', stiffness: 90, damping: 14, delay: 0.3 + i * 0.25 }} />
          </g>
        ))}
        <line x1="50" y1="4" x2="50" y2="96" stroke="#fff" strokeWidth="1.6" />
        <line x1="4" y1="50" x2="50" y2="50" stroke="#fff" strokeWidth="1.6" />
        <circle cx="50" cy="50" r="46" fill="none" stroke="#fff" strokeWidth="2" />
      </svg>
      <div className="space-y-2">
        {parts.map((p, i) => (
          <motion.div key={p.key} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.25 }} className="flex items-center gap-2 text-sm">
            <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
            <span className="font-semibold text-inchiostro">{p.label}</span>
            <span className="text-inchiostro/55">{p.fill >= 0.9 ? 'giusta' : p.fill >= 0.5 ? 'quasi' : 'poca'}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

function PhotoCard() {
  const { toast } = useStore()
  const [photo, setPhoto] = useState<string | null>(null)
  const [fb, setFb] = useState<MealFeedback | null>(null)
  const [loading, setLoading] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const result = useRef<HTMLDivElement>(null)
  useEffect(() => { if (fb) setTimeout(() => result.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 350) }, [fb])

  async function onFile(f: File | undefined) {
    if (!f) return
    setFb(null)
    setLoading(true)
    try {
      const { b64, url } = await resize(f)
      setPhoto(url)
      setFb(await api.mealPhoto(b64, 'image/jpeg'))
    } catch (e) {
      toast((e as Error).message, '🌿')
    } finally {
      setLoading(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(2)}>
      <h3 className="font-title text-lg">Fotografa il piatto</h3>
      <p className="mt-1 text-sm text-inchiostro/65">Ti dico cosa va già bene e un piccolo consiglio. Mai numeri, mai giudizi.</p>
      <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <motion.button whileTap={press} onClick={() => input.current?.click()} disabled={loading}
        className="relative mt-4 grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-[22px] border-2 border-dashed border-acqua/50 bg-white/60 text-petrolio">
        {photo ? <img src={photo} alt="Il tuo piatto" className="absolute inset-0 h-full w-full object-cover" /> : (
          <span className="flex flex-col items-center gap-2 font-semibold"><span className="text-4xl">📷</span>Scatta o scegli una foto</span>
        )}
        {loading && (
          <div className="absolute inset-0 grid place-items-center bg-white/60 backdrop-blur-sm">
            <motion.div className="absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-acqua/50 to-transparent" animate={{ y: ['-150%', '400%'] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }} style={{ top: 0 }} />
            <RotatingText items={copy['meal.loading']} className="relative w-full text-center font-semibold" />
          </div>
        )}
      </motion.button>

      <AnimatePresence>
        {fb && (
          <motion.div ref={result} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.gentle} className="mt-4 scroll-mb-28 space-y-2">
            {fb.plate && <div className="mb-2 rounded-[20px] bg-white/70 p-3"><PlateChart plate={fb.plate} size={140} /></div>}
            {fb.habitMatch && (
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring.bouncy} className="inline-flex rounded-full bg-acqua px-3 py-1 text-xs font-bold text-white">✓ In linea con l'abitudine della settimana</motion.div>
            )}
            {fb.positives.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={stagger(i + 1)} className="flex gap-2.5 rounded-2xl bg-salvia-chiaro px-3 py-2.5 text-[14.5px] text-inchiostro">
                <span>💚</span>{p}
              </motion.div>
            ))}
            <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={stagger(fb.positives.length + 1)} className="flex gap-2.5 rounded-2xl bg-sole/25 px-3 py-2.5 text-[14.5px] text-inchiostro">
              <span>💡</span>{fb.suggestion}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}

function RecapCard({ onNewQuiz }: { onNewQuiz: () => void }) {
  const [recap, setRecap] = useState<FoodRecap | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function load() {
    setBusy(true)
    try { setRecap(await api.foodRecap()) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  return (
    <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(3)}>
      <h3 className="font-title text-lg">La tua settimana a tavola</h3>
      {!recap ? (
        <>
          <p className="mt-1 text-sm text-inchiostro/65">Un riepilogo gentile degli ultimi 7 giorni e la prossima abitudine.</p>
          {err && <p className="mt-2 text-sm text-petrolio">{err}</p>}
          <Button variant="light" className="mt-3 w-full" onClick={load} disabled={busy}>{busy ? 'Ci penso un attimo…' : 'Vedi il riepilogo'}</Button>
          <button onClick={onNewQuiz} className="mx-auto mt-2 block text-xs text-inchiostro/50 underline underline-offset-4">Rifai le 5 domande</button>
        </>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 space-y-3">
          <p className="text-sm text-inchiostro/65">{recap.photos} piatti fotografati questa settimana.</p>
          <div className="space-y-1.5">
            {recap.strengths.map((s, i) => <motion.div key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={stagger(i)} className="flex gap-2 text-sm text-inchiostro"><span>💚</span>{s}</motion.div>)}
            {recap.gaps.map((s, i) => <motion.div key={s} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={stagger(i + recap.strengths.length)} className="flex gap-2 text-sm text-inchiostro/80"><span>🌱</span>Da coltivare: {s.charAt(0).toLowerCase() + s.slice(1)}</motion.div>)}
          </div>
          {recap.nextHabit && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring.bouncy, delay: 0.4 }}
              className="rounded-[20px] bg-gradient-to-b from-petrolio to-acqua p-4 text-white">
              <div className="text-[11px] font-bold uppercase tracking-wider text-white/75">La prossima abitudine</div>
              <div className="font-title text-lg leading-tight">{recap.nextHabit.title}</div>
              <p className="mt-1 text-sm text-white/85">{recap.why}</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </Card>
  )
}
