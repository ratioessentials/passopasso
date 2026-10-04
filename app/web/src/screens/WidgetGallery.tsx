import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { api, getUserId } from '../api/client'
import type { DayStatus, WidgetData } from '../api/types'
import { LEVEL_COLORS } from '../content/copy'
import { ConsistencyRing, LevelIcon } from '../ui/kit'
import { stagger } from '../ui/motion'

function useWidget() {
  const [d, setD] = useState<WidgetData | null>(null)
  useEffect(() => {
    const load = () => api.widget(getUserId() ?? 'demo').then(setD).catch(() => {})
    void load()
    // si aggiorna quando cambiano i dati dell'utente (seduta completata, livello accettato…)
    window.addEventListener('passopasso:refresh', load)
    return () => window.removeEventListener('passopasso:refresh', load)
  }, [])
  return d
}

const bg = (n: number) => `linear-gradient(180deg, ${LEVEL_COLORS[n]?.[0] ?? '#2C6975'}, ${LEVEL_COLORS[n]?.[1] ?? '#68B2A0'})`
const W = 'rounded-[22px] p-4 text-white shadow-[0_18px_40px_-20px_rgb(0_0_0/.55)] overflow-hidden relative'

const DOT: Record<DayStatus, string> = {
  done: 'bg-white',
  skipped: 'bg-white/25',
  planned: 'border-2 border-white bg-transparent',
  rest: 'bg-white/10',
}

export function SmallWidget({ d }: { d: WidgetData }) {
  return (
    <div className={`${W} flex h-[158px] w-[158px] flex-col justify-between`} style={{ background: bg(d.level.n) }}>
      <div className="flex items-start justify-between">
        <LevelIcon n={d.level.n} size={40} />
        <ConsistencyRing value={d.consistency} size={52} stroke={6} light>
          <span className="font-title text-[15px]">{d.consistency}</span>
        </ConsistencyRing>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-white/75">{d.next ? d.next.label : 'Oggi'}</div>
        <div className="font-title text-[17px] leading-tight">{d.next ? d.next.title : 'Riposo'}</div>
        {d.next && <div className="text-xs text-white/80">{d.next.minutes} min</div>}
      </div>
    </div>
  )
}

export function MediumWidget({ d }: { d: WidgetData }) {
  return (
    <div className={`${W} flex h-[158px] w-[338px] gap-4`} style={{ background: bg(d.level.n) }}>
      <div className="flex w-[120px] flex-col justify-between">
        <LevelIcon n={d.level.n} size={48} />
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/75">Livello {d.level.n}</div>
          <div className="font-title text-lg leading-tight">{d.level.name}</div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${Math.max(4, d.level.progress * 100)}%` }} /></div>
        </div>
      </div>
      <div className="flex flex-1 flex-col justify-between rounded-2xl bg-white/15 p-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/75">{d.next?.label ?? 'Oggi'}</div>
          <div className="font-title text-[17px] leading-tight">{d.next?.title ?? 'Giornata di riposo'}</div>
          {d.next && <div className="text-xs text-white/80">{d.next.minutes} minuti</div>}
        </div>
        {d.next && <div className="self-start rounded-full bg-white px-4 py-1.5 text-sm font-bold text-petrolio">▶ Inizia</div>}
      </div>
    </div>
  )
}

export function LargeWidget({ d }: { d: WidgetData }) {
  return (
    <div className={`${W} flex h-[354px] w-[338px] flex-col gap-3`} style={{ background: bg(d.level.n) }}>
      <div className="flex items-center gap-3">
        <LevelIcon n={d.level.n} size={44} />
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/75">Livello {d.level.n}</div>
          <div className="font-title text-lg leading-tight">{d.level.name}</div>
        </div>
        <div className="text-right">
          <div className="font-title text-[28px] leading-none">{d.consistency}</div>
          <div className="text-[10px] font-semibold uppercase text-white/75">costanza</div>
        </div>
      </div>
      <div className="rounded-2xl bg-white/15 p-3">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/75">Questa settimana</div>
        <div className="flex justify-between">
          {d.week.map((w, i) => (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <span className={`h-6 w-6 rounded-full ${DOT[w.status]}`} />
              <span className="text-[11px] font-semibold text-white/80">{w.day}</span>
            </div>
          ))}
        </div>
      </div>
      {d.habit && (
        <div className="rounded-2xl bg-white/15 p-3">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-white/75">Abitudine · {d.habit.doneDays}/7</div>
          <div className="text-sm font-semibold leading-snug">{d.habit.title}</div>
        </div>
      )}
      {d.lastWin && (
        <div className="mt-auto flex items-center gap-2 rounded-2xl bg-white p-2.5 text-inchiostro">
          <span className="text-lg">⭐</span><span className="text-sm font-semibold leading-tight">{d.lastWin.title}</span>
        </div>
      )}
    </div>
  )
}

export function CircularWidget({ d }: { d: WidgetData }) {
  return (
    <div className="grid h-[76px] w-[76px] place-items-center rounded-full bg-black/35 backdrop-blur-md">
      <ConsistencyRing value={d.consistency} size={68} stroke={6} light>
        <div className="leading-none text-white">
          <div className="font-title text-[22px]">{d.level.n}</div>
          <div className="text-[8px] font-bold uppercase">liv</div>
        </div>
      </ConsistencyRing>
    </div>
  )
}

/** Anteprima per la colonna destra della cornice desktop. */
export function WidgetsPreview({ compact = false }: { compact?: boolean }) {
  const d = useWidget()
  if (!d) return null
  return (
    <div className={`flex flex-col gap-4 ${compact ? 'origin-top-left scale-[0.92]' : ''}`}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={stagger(0)} className="flex items-center gap-4">
        <SmallWidget d={d} />
        <CircularWidget d={d} />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={stagger(1)}><MediumWidget d={d} /></motion.div>
      {!compact && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={stagger(2)}><LargeWidget d={d} /></motion.div>}
    </div>
  )
}

const APPS = ['📷', '🗺️', '🎵', '✉️', '📅', '⚙️', '🌤️', '📝']

/** Schermata Home di iPhone finta con i widget di PassoPasso. */
export default function WidgetGallery() {
  const d = useWidget()
  const time = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
  return (
    <div className="relative min-h-full overflow-hidden" style={{ background: 'linear-gradient(160deg, #1D4A5A 0%, #2C6975 35%, #68B2A0 75%, #CDE0C9 100%)' }}>
      <div className="safe-top relative flex flex-col items-center px-[26px] pb-tabbar text-white">
        <div className="mt-6 text-sm font-semibold text-white/80">{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <div className="font-display text-[64px] font-semibold leading-none tracking-tight">{time}</div>
        {d && <div className="mt-3"><CircularWidget d={d} /></div>}
        {d && (
          <div className="mt-8 flex w-full max-w-[338px] flex-col gap-5">
            <div className="flex gap-[22px]">
              <SmallWidget d={d} />
              <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
                {APPS.slice(0, 4).map((a) => <div key={a} className="grid aspect-square place-items-center rounded-[16px] bg-white/20 text-3xl backdrop-blur-md">{a}</div>)}
              </div>
            </div>
            <MediumWidget d={d} />
            <LargeWidget d={d} />
          </div>
        )}
      </div>
      <div className="fixed inset-x-3 bottom-3 flex justify-around rounded-[30px] bg-white/25 p-3 backdrop-blur-xl">
        {APPS.slice(4).map((a) => <div key={a} className="grid h-14 w-14 place-items-center rounded-[16px] bg-white/30 text-3xl">{a}</div>)}
      </div>
    </div>
  )
}
