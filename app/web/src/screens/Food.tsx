import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { MealFeedback } from '../api/types'
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
  const habit = me?.habit
  const [days, setDays] = useState(habit?.doneDays ?? 0)
  const [checked, setChecked] = useState(false)
  const [photo, setPhoto] = useState<string | null>(null)
  const [fb, setFb] = useState<MealFeedback | null>(null)
  const [loading, setLoading] = useState(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => { if (!me) void loadMe() }, [me, loadMe])
  useEffect(() => { if (habit) setDays(habit.doneDays) }, [habit])

  async function check() {
    if (checked) return
    setChecked(true)
    setDays((d) => Math.min(7, d + 1))
    try { const r = await api.habitCheckin(); setDays(r.doneDays); toast('Fatto anche oggi. Bello.', '🌱') } catch (e) { toast((e as Error).message) }
  }

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
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-32">
      <Header title="Cibo" subtitle="Nessuna caloria da contare. Un'abitudine alla volta." />
      <div className="space-y-4 px-5">
        {!habit ? <Skeleton className="h-48" /> : (
          <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(0)}>
            <div className="text-xs font-semibold uppercase tracking-wider text-acqua">Abitudine della settimana {habit.week}</div>
            <h2 className="font-title mt-1 text-[24px] leading-tight text-inchiostro">{habit.title}</h2>
            <p className="mt-2 text-[14.5px] text-inchiostro/75">{habit.why}</p>
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

        <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(1)}>
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
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring.gentle} className="mt-4 space-y-2">
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
      </div>
    </div>
  )
}
