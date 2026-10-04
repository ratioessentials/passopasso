import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import type { Session } from '../api/types'
import { levelInfo, winIcon } from '../content/copy'
import { useStore } from '../lib/store'
import { AnimatedNumber, Button, Card, ConsistencyRing, ErrorBox, LevelIcon, MeshBackground, Pill, Skeleton } from '../ui/kit'
import { press, spring, stagger } from '../ui/motion'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Buongiorno' : h < 18 ? 'Ciao' : 'Buonasera'
}

export default function Home() {
  const { me, meError, loadMe } = useStore()
  const nav = useNavigate()

  useEffect(() => { void loadMe() }, [loadMe])

  if (!me) {
    return (
      <div className="relative min-h-full pb-tabbar">
        <MeshBackground level={2} />
        <div className="safe-top relative space-y-4 px-5 pt-6">
          {meError ? <ErrorBox message={meError} onRetry={() => void loadMe()} /> : (
            <>
              <Skeleton className="h-10 w-48" />
              <Skeleton className="h-44" />
              <Skeleton className="h-40" />
              <Skeleton className="h-28" />
            </>
          )}
        </div>
      </div>
    )
  }

  const { level, consistency, today, habit, wins, profile } = me
  const date = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="relative min-h-full pb-tabbar">
      <MeshBackground level={level.n} className="h-[620px]" fade />
      <div className="safe-top relative px-5">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={spring.gentle} className="flex items-start justify-between pt-3 text-white">
          <div>
            <p className="text-sm capitalize text-white/80">{date}</p>
            <h1 className="font-title text-[32px] leading-tight">{greeting()}, {profile?.name ?? 'ciao'}</h1>
          </div>
        </motion.div>

        {/* Livello + costanza */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(1)} className="mt-5 flex items-center gap-4">
          <motion.button whileTap={press} onClick={() => nav('/percorso')} className="glass-dark flex flex-1 flex-col items-start gap-3 rounded-[26px] p-4 text-left text-white">
            <LevelIcon n={level.n} size={64} layoutId="level-icon" transition={spring.gentle} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-white/75">Livello {level.n}</div>
              <div className="font-title text-[24px] leading-tight">{level.name}</div>
              <div className="text-sm text-white/80">{level.verb !== levelInfo(level.n).verb ? level.verb : levelInfo(level.n, profile?.track).verb}</div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
              <motion.div className="h-full origin-left rounded-full bg-white" initial={{ scaleX: 0 }} animate={{ scaleX: Math.max(0.04, level.progress) }} transition={{ ...spring.slow, delay: 0.3 }} />
            </div>
          </motion.button>
          <div className="glass-dark flex flex-col items-center rounded-[26px] px-3 py-4 text-white">
            <ConsistencyRing value={consistency} size={128} stroke={12} light>
              <div>
                {consistency > 0 ? (
                  <>
                    <AnimatedNumber value={consistency} className="font-title block text-[40px] leading-none" />
                    <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-white/80">costanza</div>
                  </>
                ) : (
                  <>
                    <div className="font-title text-[20px] leading-tight">Si parte<br />oggi</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">costanza</div>
                  </>
                )}
              </div>
            </ConsistencyRing>
          </div>
        </motion.div>

        {level.ready && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={stagger(2)} className="mt-3">
            <Pill className="bg-white/90 text-petrolio">✨ Sei quasi pront{profile?.name?.endsWith('a') ? 'a' : 'o'} per il livello {level.n + 1}</Pill>
          </motion.div>
        )}

        {/* Seduta di oggi */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={stagger(2)} className="mt-5">
          {today ? <TodayCard s={today} onStart={() => nav(`/checkin/${today.id}`)} /> : (
            <Card>
              <div className="font-title text-xl text-inchiostro">Oggi riposo</div>
              <p className="mt-1 text-sm text-inchiostro/70">Anche il riposo fa parte del percorso. Il corpo si rinforza proprio adesso.</p>
            </Card>
          )}
        </motion.div>

        {/* Abitudine */}
        {habit && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={stagger(3)} className="mt-4">
            <HabitCard title={habit.title} why={habit.why} doneDays={habit.doneDays} />
          </motion.div>
        )}

        {/* Progressi */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={stagger(4)} className="mt-4">
          <Card className="flex items-center gap-4" whileTap={press} onClick={() => nav('/progressi')}>
            <svg width="56" height="40" viewBox="0 0 56 40" className="shrink-0">
              <motion.path d="M3 34 C12 30, 14 22, 22 24 S34 12, 40 14 S50 6, 53 4" fill="none" stroke="#2C6975" strokeWidth="4" strokeLinecap="round"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.6, ease: 'easeInOut' }} />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-acqua">I tuoi progressi</div>
              <div className="font-title text-lg leading-tight text-inchiostro">Costanza, minuti e vittorie</div>
            </div>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2C6975" strokeWidth="2.4" strokeLinecap="round"><path d="M9 6l6 6-6 6" /></svg>
          </Card>
        </motion.div>

        {/* Ultima vittoria */}
        {wins[0] && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={stagger(5)} className="mt-4">
            <Card className="flex items-center gap-4" onClick={() => nav('/progressi')}>
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-b from-sole/80 to-[#fbe3b0] text-3xl shadow-[0_8px_20px_-10px_rgb(200_140_40/.7)]">{winIcon(wins[0].icon)}</div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-acqua">Ultima vittoria</div>
                <div className="font-title text-lg leading-tight text-inchiostro">{wins[0].title}</div>
              </div>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export function TodayCard({ s, onStart }: { s: Session; onStart: () => void }) {
  const restart = s.kind === 'ripartenza'
  return (
    <motion.div layoutId={`session-${s.id}`} transition={spring.gentle} className="relative overflow-hidden rounded-[28px] bg-white p-5 shadow-soft">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-salvia/70 blur-2xl" />
      <div className="relative">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-acqua">{restart ? 'Ripartenza' : 'Seduta di oggi'}</span>
          {s.bonusPoints > 0 && <BonusBadge points={s.bonusPoints} />}
        </div>
        <h2 className="font-title mt-1 text-[26px] leading-tight text-inchiostro">{s.title}</h2>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[...new Set(s.items.map((it) => it.exercise.category))].map((c, i) => (
            <motion.span key={c} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring.bouncy, delay: 0.35 + i * 0.05 }}
              className="rounded-full bg-salvia-chiaro px-2.5 py-1 text-[11px] font-semibold capitalize text-petrolio">
              {c === 'mobilita' ? 'mobilità' : c}
            </motion.span>
          ))}
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="flex gap-5">
            <div>
              <div className="font-title text-[34px] leading-none text-petrolio">{s.minutes}</div>
              <div className="text-xs text-inchiostro/60">minuti</div>
            </div>
            <div>
              <div className="font-title text-[34px] leading-none text-petrolio">{s.items.length}</div>
              <div className="text-xs text-inchiostro/60">esercizi</div>
            </div>
          </div>
          <Button onClick={onStart} className="px-7">
            Inizia
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

export function BonusBadge({ points }: { points: number }) {
  return (
    <motion.span
      initial={{ scale: 0, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={spring.bouncy}
      className="relative inline-flex items-center rounded-full bg-gradient-to-b from-sole to-[#f3b04a] px-2.5 py-0.5 text-xs font-extrabold text-[#5a3a05] shadow-[0_0_18px_2px_rgb(246_199_107/.7)]"
    >
      +{points} bonus
    </motion.span>
  )
}

function HabitCard({ title, why, doneDays }: { title: string; why: string; doneDays: number }) {
  const { toast } = useStore()
  const [days, setDays] = useState(doneDays)
  const [done, setDone] = useState(false)
  const nav = useNavigate()
  async function check() {
    if (done) return
    setDone(true)
    setDays((d) => Math.min(7, d + 1))
    try {
      const r = await api.habitCheckin()
      setDays(r.doneDays)
      toast('Segnato. Un piccolo passo conta.', '💧')
    } catch (e) {
      toast((e as Error).message)
    }
  }
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0" onClick={() => nav('/cibo')}>
          <div className="text-xs font-semibold uppercase tracking-wider text-acqua">Abitudine della settimana</div>
          <div className="font-title mt-1 text-lg leading-tight text-inchiostro">{title}</div>
          <p className="mt-1 line-clamp-2 text-sm text-inchiostro/65">{why}</p>
        </div>
        <motion.button
          whileTap={press} onClick={check} aria-label="Fatto oggi"
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 transition-colors ${done ? 'border-acqua bg-acqua text-white' : 'border-acqua/50 text-acqua'}`}
        >
          <motion.svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5l4.5 4.5L19 7" initial={false} animate={{ pathLength: done ? 1 : 0.999 }} />
          </motion.svg>
        </motion.button>
      </div>
      <div className="mt-4 flex gap-1.5">
        {[...Array(7)].map((_, i) => (
          <motion.div key={i} className="h-2 flex-1 rounded-full" animate={{ backgroundColor: i < days ? '#68B2A0' : 'rgba(44,105,117,0.12)' }} transition={{ delay: i * 0.03 }} />
        ))}
      </div>
      <div className="mt-1.5 text-xs text-inchiostro/60">{days} giorni su 7 questa settimana</div>
    </Card>
  )
}
