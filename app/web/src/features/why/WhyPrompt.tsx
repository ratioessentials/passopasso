import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '../../ui/kit'
import { press, spring } from '../../ui/motion'

export const WHY_EXAMPLES = [
  'Per giocare con mio figlio senza fiatone',
  'Per salire le scale senza fermarmi',
  'Per sentirmi di nuovo a casa nel mio corpo',
  'Per dormire meglio la notte',
  'Per arrivare in cima al sentiero con gli amici',
  'Per avere energia la sera, non solo la mattina',
]

/**
 * L'ultima domanda dell'onboarding: il perché, a parole sue.
 * `onDone(why)` riceve il testo (chat 1 lo manda al server come un messaggio normale).
 * Campo grande, esempi che ruotano come segnaposto, nessun obbligo di lunghezza.
 */
export function WhyPrompt({ name, onDone, onSkip, busy = false, question }: {
  name?: string
  onDone: (why: string) => void
  onSkip?: () => void
  busy?: boolean
  /** la domanda, se arriva dall'AI; altrimenti quella di riserva */
  question?: string
}) {
  const [text, setText] = useState('')
  const [i, setI] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (text) return
    const t = setInterval(() => setI((x) => (x + 1) % WHY_EXAMPLES.length), 2600)
    return () => clearInterval(t)
  }, [text])
  useEffect(() => { const t = setTimeout(() => ref.current?.focus(), 450); return () => clearTimeout(t) }, [])

  const ok = text.trim().length >= 3

  return (
    <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.gentle}
      className="relative overflow-hidden rounded-[28px] bg-white p-5 shadow-soft">
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-salvia/70 blur-3xl" />
      <div className="relative">
        <span className="text-[11px] font-bold uppercase tracking-wider text-acqua">Ultima cosa{name ? `, ${name}` : ''}</span>
        <h2 className="font-title mt-1 text-[24px] leading-tight text-inchiostro">{question ?? 'Perché vuoi farlo?'}</h2>
        <p className="mt-1 text-sm text-inchiostro/65">A parole tue. Te lo ricorderò nei giorni in cui ti verrà voglia di saltare.</p>

        <div className="relative mt-4">
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 160))}
            rows={3}
            aria-label="Il tuo perché"
            className="font-title w-full resize-none rounded-[22px] border border-petrolio/15 bg-salvia-chiaro/50 px-4 py-3.5 text-[22px] leading-snug text-petrolio outline-none focus:border-acqua"
          />
          <AnimatePresence mode="popLayout" initial={false}>
            {!text && (
              <motion.span key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={spring.gentle}
                className="font-title pointer-events-none absolute left-4 top-3.5 right-4 text-[22px] leading-snug text-petrolio/35">
                {WHY_EXAMPLES[i]}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-1 flex justify-between px-1 text-[11px] text-inchiostro/40">
          <span>Una frase basta.</span>
          <span>{text.length}/160</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {WHY_EXAMPLES.slice(0, 3).map((e, j) => (
            <motion.button key={e} type="button" whileTap={press} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.bouncy, delay: 0.2 + j * 0.06 }}
              onClick={() => setText(e)} className="rounded-full border border-acqua/40 bg-white px-3 py-1.5 text-[12px] font-semibold text-petrolio/80">
              {e}
            </motion.button>
          ))}
        </div>

        <div className="mt-4 space-y-1">
          <Button className="w-full" disabled={!ok || busy} onClick={() => ok && onDone(text.trim())}>{busy ? 'Lo tengo a mente…' : 'È questo'}</Button>
          {onSkip && <Button variant="ghost" className="w-full text-sm" disabled={busy} onClick={onSkip}>Ci penso più avanti</Button>}
        </div>
      </div>
    </motion.div>
  )
}
