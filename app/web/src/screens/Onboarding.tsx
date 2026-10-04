import { AnimatePresence, motion } from 'motion/react'
import confetti from 'canvas-confetti'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { api } from '../api/client'
import type { ChatMessage, Profile } from '../api/types'
import { levelInfo, LEVEL_COLORS, TRACK_LABELS } from '../content/copy'
import { useStore } from '../lib/store'
import { Button, LevelIcon, MeshBackground } from '../ui/kit'
import { Minor } from './Minor'
import { WhyPrompt } from '../features/why'
import { press, spring } from '../ui/motion'

const GOALS = ['Correre senza fermarmi', 'Sentirmi più forte', 'Meno rigidità e mal di schiena', 'Corro già regolarmente']

export default function Onboarding() {
  const nav = useNavigate()
  const { me, loadMe } = useStore()
  const loc = useLocation()
  const name = (loc.state as { name?: string } | null)?.name ?? me?.profile?.name
  // la scheda ha già nome e dati fisici: la chat parte dall'obiettivo
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: `Piacere${name ? ` ${name}` : ''}! La scheda c'è. Ora dimmi: cosa ti piacerebbe riuscire a fare?` }])
  const [quick, setQuick] = useState<string[]>(GOALS)
  const [minor, setMinor] = useState<string | null>(null)
  const [askWhy, setAskWhy] = useState(false)
  const [typing, setTyping] = useState(false)
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, typing, quick])

  async function send(text: string) {
    const t = text.trim()
    if (!t || typing) return
    const next: ChatMessage[] = [...messages, { role: 'user', content: t }]
    setMessages(next)
    setQuick([])
    setInput('')
    setError(null)
    setTyping(true)
    try {
      const r = await api.onboardingMessage(next)
      setMessages([...next, { role: 'assistant', content: r.reply }])
      setTyping(false)
      if (r.done && r.minor) {
        setTimeout(() => setMinor(r.reply), 900)
      } else if (r.done) {
        setTimeout(() => setProfile(r.profile ?? null), 1100)
        if (!r.profile) setTimeout(() => setProfile({ startLevel: 1 } as Profile), 1100)
      } else {
        setQuick(r.quickReplies ?? [])
        setAskWhy(!!r.askWhy)
      }
    } catch (e) {
      setTyping(false)
      setMessages(messages)
      setInput(t)
      setError((e as Error).message)
    }
  }

  if (minor) return <Minor message={minor} />
  if (profile) return <LevelReveal level={profile.startLevel || 1} name={profile.name} track={profile.track} onGo={async () => { await loadMe(); nav('/', { replace: true }) }} />

  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-salvia-chiaro to-white">
      <div className="safe-top flex items-center gap-3 border-b border-petrolio/10 bg-white/60 px-5 pb-3 backdrop-blur-xl">
        <LevelIcon n={1} size={40} />
        <div>
          <div className="font-title text-lg leading-tight text-inchiostro">Il tuo coach</div>
          <div className="text-xs text-acqua">{typing ? 'sta scrivendo…' : 'PassoPasso · AI'}</div>
        </div>
      </div>

      <div ref={scroller} className="no-scrollbar flex-1 space-y-2.5 overflow-y-auto px-4 py-5">
        <AnimatePresence initial={true}>
          {messages.map((m, i) => (
            <motion.div
              key={i}
              layout="position"
              initial={{ opacity: 0, y: 14, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={spring.bouncy}
              style={{ originX: m.role === 'user' ? 1 : 0, originY: 1 }}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[80%] px-4 py-2.5 text-[15px] leading-snug ${m.role === 'user'
                ? 'rounded-[22px] rounded-br-md bg-gradient-to-b from-petrolio to-[#347c84] text-white shadow-[0_8px_18px_-10px_rgb(44_105_117/.9)]'
                : 'rounded-[22px] rounded-bl-md bg-white text-inchiostro shadow-[0_6px_16px_-10px_rgb(44_105_117/.5)]'}`}>
                {m.content}
              </div>
            </motion.div>
          ))}
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

      <div className="safe-bottom border-t border-petrolio/10 bg-white/70 px-4 pt-3 backdrop-blur-xl">
        {askWhy ? (
          <WhyPrompt name={name} busy={typing} onDone={(w) => { setAskWhy(false); void send(w) }} onSkip={() => { setAskWhy(false); void send('Preferisco non dirlo adesso') }} />
        ) : (
        <>
        <div className="mb-3 flex flex-wrap justify-end gap-2">
          <AnimatePresence>
            {quick.map((q, i) => (
              <motion.button
                key={q + i}
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1, transition: { ...spring.bouncy, delay: 0.15 + i * 0.09 } }}
                exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.12 } }}
                whileTap={press}
                onClick={() => send(q)}
                className="rounded-full border border-acqua/50 bg-salvia-chiaro px-4 py-2 text-sm font-semibold text-petrolio"
              >
                {q}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
        <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); void send(input) }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Scrivi qui…"
            className="min-w-0 flex-1 rounded-full border border-petrolio/15 bg-white px-4 py-3 text-[15px] outline-none focus:border-acqua"
          />
          <motion.button whileTap={press} type="submit" disabled={!input.trim() || typing} aria-label="Invia" className="grid h-12 w-12 place-items-center rounded-full bg-petrolio text-white disabled:opacity-40">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </motion.button>
        </form>
        </>
        )}
      </div>
    </div>
  )
}

function LevelReveal({ level, name, track, onGo }: { level: number; name?: string; track?: string; onGo: () => void }) {
  const info = levelInfo(level, track)
  const title = `${info.name}`
  useEffect(() => {
    const t = setTimeout(() => {
      void confetti({ particleCount: 90, spread: 80, origin: { y: 0.45 }, colors: ['#2C6975', '#68B2A0', '#CDE0C9', '#FFFFFF'], disableForReducedMotion: true })
    }, 700)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="relative flex h-full flex-col items-center justify-center overflow-hidden px-8 text-center text-white">
      <MeshBackground level={level} />
      <div className="relative">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: `radial-gradient(circle, ${LEVEL_COLORS[level][1]} 0%, transparent 70%)` }}
          initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 2.6, opacity: [0, 0.9, 0.5] }} transition={{ duration: 1.4, ease: 'easeOut' }}
        />
        <LevelIcon n={level} size={150} initial={{ scale: 0.2, rotate: -25, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ ...spring.bouncy, delay: 0.2 }} />
      </div>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="relative mt-10 text-lg text-white/90">
        {name ? `${name}, si parte dal` : 'Si parte dal'}
      </motion.p>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="font-title relative text-[30px]">livello {level}</motion.div>
      {track && (
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring.bouncy, delay: 0.9 }} className="relative mt-2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-bold text-petrolio">
          Percorso {TRACK_LABELS[track] ?? track} · Livello {level}
        </motion.div>
      )}
      <h2 className="font-title relative mt-1 text-[52px] leading-none">
        {title.split('').map((ch, i) => (
          <motion.span key={i} className="inline-block" initial={{ opacity: 0, y: 20, rotate: 8 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ ...spring.bouncy, delay: 1 + i * 0.05 }}>
            {ch}
          </motion.span>
        ))}
      </h2>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }} className="relative mt-3 text-white/85">
        {info.verb}. Un passo alla volta.
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.gentle, delay: 1.9 }} className="relative mt-12 w-full">
        <Button variant="light" className="w-full py-4 text-lg" onClick={onGo}>Andiamo</Button>
      </motion.div>
    </div>
  )
}
