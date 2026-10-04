import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, getUserId } from '../api/client'
import type { CalendarConnectResponse, ChatMessage, RedFlag } from '../api/types'
import { useStore } from '../lib/store'
import { Button, LevelIcon } from '../ui/kit'
import { press, spring } from '../ui/motion'

interface CoachMsg extends ChatMessage {
  applied?: string[]
  redFlag?: RedFlag | null
}

const CAL = 'Collega il calendario'
const SUGGESTIONS = ['Ho un dolore nuovo', 'Questa settimana ho poco tempo', CAL]
const key = () => `passopasso.coach.${getUserId() ?? 'anon'}`

function loadHistory(): CoachMsg[] {
  try { return JSON.parse(localStorage.getItem(key()) ?? '[]') as CoachMsg[] } catch { return [] }
}
function saveHistory(m: CoachMsg[]) {
  try { localStorage.setItem(key(), JSON.stringify(m.slice(-40))) } catch { /* storage pieno o bloccato */ }
}

export default function Coach() {
  const { me, loadMe } = useStore()
  const name = me?.profile?.name
  const hello: CoachMsg = {
    role: 'assistant',
    content: `Ciao${name ? ` ${name}` : ''}! Sono il tuo coach. Raccontami come va: tempo, energia, dolori, impegni. Adatto il piano a te, e ti dico sempre cosa ho cambiato.`,
  }
  const [messages, setMessages] = useState<CoachMsg[]>(() => loadHistory())
  const [quick, setQuick] = useState<string[]>(SUGGESTIONS)
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [calOpen, setCalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => { saveHistory(messages) }, [messages])
  // ritorno dall'OAuth di Strava: /coach?connected=strava
  const navTo = useNavigate()
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('connected')) navTo('/coach/salute?connected=strava', { replace: true })
  }, [navTo])
  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, typing, quick])

  async function send(text: string) {
    const t = text.trim()
    if (!t || typing) return
    if (t === CAL) { setCalOpen(true); return }
    const next: CoachMsg[] = [...messages, { role: 'user', content: t }]
    setMessages(next)
    setQuick([])
    setInput('')
    setError(null)
    setTyping(true)
    try {
      const r = await api.coachMessage(next.map(({ role, content }) => ({ role, content })))
      setMessages([...next, { role: 'assistant', content: r.reply, applied: r.applied ?? [], redFlag: r.redFlag }])
      setQuick(r.quickReplies?.length ? r.quickReplies : SUGGESTIONS)
      if (r.applied?.length) void loadMe()
    } catch (e) {
      setMessages(messages)
      setInput(t)
      setError((e as Error).message)
      setQuick(SUGGESTIONS)
    } finally {
      setTyping(false)
    }
  }

  const all = [hello, ...messages]

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-salvia-chiaro to-white">
      <div className="safe-top flex items-center gap-3 border-b border-petrolio/10 bg-white/60 px-5 pb-3 backdrop-blur-xl">
        <LevelIcon n={me?.level.n ?? 1} size={42} />
        <div className="flex-1">
          <div className="font-title text-xl leading-tight text-inchiostro">Coach</div>
          <div className="text-xs text-acqua">{typing ? 'sta scrivendo…' : 'Adatta il piano a te'}</div>
        </div>
        <motion.button whileTap={press} onClick={() => setCalOpen(true)} aria-label="Collega il calendario" className="glass grid h-10 w-10 place-items-center rounded-full text-lg">📅</motion.button>
        <motion.button whileTap={press} onClick={() => setMenuOpen(true)} aria-label="Impostazioni e dati" className="glass grid h-10 w-10 place-items-center rounded-full text-petrolio">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
        </motion.button>
        {messages.length > 0 && (
          <motion.button whileTap={press} onClick={() => { setMessages([]); setQuick(SUGGESTIONS) }} className="rounded-full px-3 py-1.5 text-xs font-semibold text-petrolio/70">
            Nuova chat
          </motion.button>
        )}
      </div>

      <div ref={scroller} className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 py-5">
        {all.map((m, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 14, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.bouncy}
            style={{ originX: m.role === 'user' ? 1 : 0, originY: 1 }} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[82%] px-4 py-2.5 text-[15px] leading-snug ${m.role === 'user'
              ? 'rounded-[22px] rounded-br-md bg-gradient-to-b from-petrolio to-[#347c84] text-white shadow-[0_8px_18px_-10px_rgb(44_105_117/.9)]'
              : 'rounded-[22px] rounded-bl-md bg-white text-inchiostro shadow-[0_6px_16px_-10px_rgb(44_105_117/.5)]'}`}>
              {m.content}
            </div>
            {m.redFlag && (
              <div className="mt-2 max-w-[86%] rounded-[20px] border border-acqua/40 bg-salvia-chiaro p-3 text-sm text-inchiostro">
                <div className="mb-1 font-semibold">🌿 {m.redFlag.label}</div>
                {m.redFlag.message !== m.content && m.redFlag.message}
                {m.redFlag.urgent && <a href="tel:112" className="mt-2 block font-semibold text-petrolio underline">Chiama il 112</a>}
              </div>
            )}
            {m.applied && m.applied.length > 0 && (
              <div className="mt-1.5 flex max-w-[90%] flex-wrap gap-1.5">
                {m.applied.map((a, j) => (
                  <motion.span key={a + j} initial={{ opacity: 0, scale: 0.6, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ ...spring.bouncy, delay: 0.25 + j * 0.1 }}
                    className="inline-flex items-center gap-1 rounded-full bg-acqua px-2.5 py-1 text-[12px] font-semibold text-white shadow-[0_6px_14px_-8px_rgb(44_105_117/.8)]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                    {a}
                  </motion.span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
        <AnimatePresence>
          {typing && (
            <motion.div key="typing" initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring.bouncy} className="flex" style={{ originX: 0 }}>
              <div className="flex gap-1.5 rounded-[22px] rounded-bl-md bg-white px-4 py-3.5 shadow-[0_6px_16px_-10px_rgb(44_105_117/.5)]">
                {[0, 1, 2].map((d) => (
                  <motion.span key={d} className="h-2 w-2 rounded-full bg-acqua" animate={{ y: [0, -6, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: d * 0.14, ease: 'easeInOut' }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {error && <p className="px-2 text-center text-sm text-petrolio/80">{error}</p>}
      </div>

      <div className="border-t border-petrolio/10 bg-white/70 px-4 pt-3 backdrop-blur-xl" style={{ paddingBottom: 'calc(96px + max(env(safe-area-inset-bottom), var(--frame-bottom, 10px)))' }}>
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          <AnimatePresence>
            {quick.map((q, i) => (
              <motion.button key={q + i}
                initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring.bouncy, delay: 0.1 + i * 0.08 } }} exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                whileTap={press} onClick={() => send(q)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold ${q === CAL ? 'border-petrolio/30 bg-white text-petrolio' : 'border-acqua/50 bg-salvia-chiaro text-petrolio'}`}>
                {q === CAL ? '📅 ' : ''}{q}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(input) }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Scrivi al coach…"
            className="min-w-0 flex-1 rounded-full border border-petrolio/15 bg-white px-4 py-3 text-[15px] outline-none focus:border-acqua" />
          <motion.button whileTap={press} type="submit" disabled={!input.trim() || typing} aria-label="Invia" className="grid h-12 w-12 place-items-center rounded-full bg-petrolio text-white disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </motion.button>
        </form>
      </div>

      <AnimatePresence>
        {menuOpen && <CoachMenu key="menu" onClose={() => setMenuOpen(false)} onCalendar={() => { setMenuOpen(false); setCalOpen(true) }} />}
        {calOpen && <CalendarSheet onClose={() => setCalOpen(false)} onMove={() => { setCalOpen(false); void send('Sì, spostale negli spazi liberi') }} />}
      </AnimatePresence>
    </div>
  )
}

function CalendarSheet({ onClose, onMove }: { onClose: () => void; onMove: () => void }) {
  const { toast } = useStore()
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [res, setRes] = useState<CalendarConnectResponse | null>(null)

  async function connect() {
    if (!url.trim()) return
    setBusy(true)
    setError(null)
    try { setRes(await api.calendarConnect(url.trim())) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function disconnect() {
    try { await api.calendarDisconnect(); toast('Calendario scollegato', '📅'); onClose() } catch (e) { setError((e as Error).message) }
  }

  const fmtDay = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric' })

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-inchiostro/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.gentle}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 110) onClose() }}
        className="safe-bottom relative max-h-[88%] w-full overflow-y-auto rounded-t-[34px] bg-white px-6 pt-3 shadow-[0_-20px_60px_-20px_rgb(18_49_58/.5)]">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-inchiostro/15" />
        <AnimatePresence mode="wait" initial={false}>
          {!res ? (
            <motion.div key="form" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <div className="mb-1 text-3xl">📅</div>
              <h2 className="font-title text-[26px] leading-tight text-inchiostro">Collega il calendario</h2>
              <p className="mt-1 text-sm text-inchiostro/70">Guardo solo quando sei libero, mai cosa fai. Così le sedute cadono negli spazi giusti.</p>
              <ol className="mt-4 space-y-2 text-sm text-inchiostro/80">
                <li className="flex gap-2"><span className="font-title text-petrolio">1</span><span><b>Google</b>: Impostazioni → il tuo calendario → "Indirizzo segreto in formato iCal".</span></li>
                <li className="flex gap-2"><span className="font-title text-petrolio">2</span><span><b>Apple</b>: app Calendario → info del calendario → "Calendario pubblico" → condividi il link.</span></li>
                <li className="flex gap-2"><span className="font-title text-petrolio">3</span><span>Copia il link (finisce con <code className="rounded bg-salvia-chiaro px-1">.ics</code>) e incollalo qui sotto.</span></li>
              </ol>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/basic.ics" inputMode="url" autoComplete="off"
                className="mt-4 w-full rounded-2xl border border-petrolio/15 bg-salvia-chiaro/50 px-4 py-3 text-[15px] outline-none focus:border-acqua" />
              {error && <p className="mt-2 text-sm text-petrolio">{error}</p>}
              <div className="space-y-1 pb-4 pt-4">
                <Button className="w-full" onClick={connect} disabled={busy || !url.trim()}>{busy ? 'Guardo la tua settimana…' : 'Collega'}</Button>
                <Button variant="ghost" className="w-full text-sm" onClick={disconnect}>Scollega il calendario</Button>
              </div>
            </motion.div>
          ) : (
            <motion.div key="res" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
              <div className="mb-1 text-3xl">✨</div>
              <h2 className="font-title text-[26px] leading-tight text-inchiostro">Ecco i tuoi spazi liberi</h2>
              <p className="mt-1 text-sm text-inchiostro/65">{res.eventsNext7Days} impegni nei prossimi 7 giorni. Ho trovato questi buchi giusti per te:</p>
              <div className="mt-4 space-y-2">
                {res.freeSlots.slice(0, 6).map((f, i) => (
                  <motion.div key={f.date + f.start} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: i * 0.07 }}
                    className="flex items-center justify-between rounded-2xl bg-salvia-chiaro px-4 py-3">
                    <span className="font-semibold capitalize text-inchiostro">{fmtDay(f.date)}</span>
                    <span className="font-title text-petrolio">{f.start}–{f.end}</span>
                  </motion.div>
                ))}
                {res.freeSlots.length === 0 && <p className="text-sm text-inchiostro/70">Settimana piena: teniamo le sedute corte e flessibili.</p>}
              </div>
              <p className="mt-4 rounded-2xl bg-white p-3 text-[15px] text-inchiostro shadow-[0_6px_16px_-10px_rgb(44_105_117/.5)]">{res.suggestion}</p>
              <div className="space-y-1 pb-4 pt-4">
                {res.freeSlots.length > 0 && <Button className="w-full" onClick={onMove}>Sì, sposta</Button>}
                <Button variant="ghost" className="w-full" onClick={onClose}>Non ora</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

export const COACH_MENU: { to: string; icon: string; title: string; sub: string }[] = [
  { to: '/coach/scheda', icon: '🪪', title: 'La mia scheda', sub: 'Età, corpo, lavoro, sonno e salute' },
  { to: '/coach/salute', icon: '❤️', title: 'Salute e dispositivi', sub: 'Apple Salute, Strava e altri: sonno e battito nel check-in' },
  { to: '/coach/dati', icon: '🔒', title: 'I miei dati', sub: 'Scarica, aggiungi al calendario, cancella' },
  { to: '/scienza', icon: '🔬', title: 'Perché funziona', sub: 'Le scelte dell\'app, con le fonti' },
]

function CoachMenu({ onClose, onCalendar }: { onClose: () => void; onCalendar: () => void }) {
  const nav = useNavigate()
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-inchiostro/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.gentle}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 100) onClose() }}
        className="safe-bottom relative max-h-[88%] w-full overflow-y-auto rounded-t-[34px] bg-white px-5 pt-3 shadow-[0_-20px_60px_-20px_rgb(18_49_58/.5)]">
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-inchiostro/15" />
        <div className="space-y-1.5 pb-4">
          {[...COACH_MENU, { to: '#cal', icon: '📅', title: 'Calendario', sub: 'Le sedute negli spazi liberi' }].map((m, i) => (
            <motion.button key={m.to} whileTap={press} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: i * 0.04 }}
              onClick={() => (m.to === '#cal' ? onCalendar() : (onClose(), nav(m.to)))}
              className="flex w-full items-center gap-3 rounded-[20px] bg-salvia-chiaro/70 p-3.5 text-left">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-xl">{m.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-inchiostro">{m.title}</span>
                <span className="block text-xs text-inchiostro/60">{m.sub}</span>
              </span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2C6975" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}
