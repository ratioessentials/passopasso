import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, getUserId } from '../api/client'
import type { HealthSource, HealthSummary } from '../api/types'
import { useStore } from '../lib/store'
import { Button, Card, Header, Skeleton } from '../ui/kit'
import { press, spring, stagger } from '../ui/motion'
import { ReadinessCard } from './Home'

const SOURCES: Record<string, { name: string; icon: string }> = {
  apple_health: { name: 'Apple Salute', icon: '❤️' },
  strava: { name: 'Strava', icon: '🟧' },
  health_connect: { name: 'Google Health Connect', icon: '💚' },
  garmin: { name: 'Garmin', icon: '⌚' },
  fitbit: { name: 'Fitbit', icon: '📟' },
  oura: { name: 'Oura', icon: '💍' },
}
const DEFAULT_SOURCES: HealthSource[] = [
  { id: 'apple_health', connected: false }, { id: 'strava', connected: false },
  { id: 'health_connect', connected: false, comingSoon: true }, { id: 'garmin', connected: false, comingSoon: true },
  { id: 'fitbit', connected: false, comingSoon: true }, { id: 'oura', connected: false, comingSoon: true },
]

const hm = (min?: number) => (min == null ? '–' : `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`)
const ago = (iso?: string | null) => {
  if (!iso) return ''
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  return m < 2 ? 'adesso' : m < 60 ? `${m} min fa` : m < 1440 ? `${Math.round(m / 60)} ore fa` : new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
}

/** Salute e dispositivi: sorgenti collegate, ultimi dati, grafico di 14 giorni. */
export default function HealthDevices() {
  const nav = useNavigate()
  const { toast, loadHealth } = useStore()
  const [sum, setSum] = useState<HealthSummary | null>(null)
  const [error, setError] = useState(false)
  const [appleOpen, setAppleOpen] = useState(false)

  const load = () => api.healthSummary().then((s) => { setSum(s); setError(false) }).catch(() => setError(true))
  useEffect(() => {
    void load()
    if (new URLSearchParams(window.location.search).get('connected') === 'strava') toast('Strava collegato: importo le tue attività', '🟧')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sources = sum?.sources?.length ? sum.sources : DEFAULT_SOURCES

  async function stravaOff() {
    try { await api.disconnectStrava(); toast('Strava scollegato'); void load(); void loadHealth() } catch (e) { toast((e as Error).message) }
  }

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-12">
      <Header title="Salute e dispositivi" subtitle="I dati del tuo corpo entrano nel check-in." onBack={() => nav(-1)} />
      <div className="space-y-4 px-5">
        {!sum && !error && <><Skeleton className="h-24" /><Skeleton className="h-64" /></>}
        {sum?.readiness && <ReadinessCard r={sum.readiness} />}

        {sum?.today && (
          <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(1)}>
            <h3 className="font-title text-lg">Oggi</h3>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {[
                { v: hm(sum.today.sleepMinutes), l: 'sonno', b: sum.baseline?.sleepMinutes != null ? `di solito ${hm(sum.baseline.sleepMinutes)}` : '' },
                { v: sum.today.restingHr ?? '–', l: 'battito', b: sum.baseline?.restingHr ? `di solito ${sum.baseline.restingHr}` : '' },
                { v: sum.today.hrv ?? '–', l: 'HRV', b: sum.baseline?.hrv ? `di solito ${sum.baseline.hrv}` : '' },
                { v: sum.today.steps != null ? (sum.today.steps / 1000).toFixed(1).replace('.', ',') + 'k' : '–', l: 'passi', b: '' },
              ].map((m) => (
                <div key={m.l} className="rounded-2xl bg-white/80 px-1 py-2.5">
                  <div className="font-title text-[20px] leading-none text-petrolio">{m.v}</div>
                  <div className="mt-1 text-[11px] font-semibold text-inchiostro/60">{m.l}</div>
                  {m.b && <div className="text-[9.5px] text-inchiostro/45">{m.b}</div>}
                </div>
              ))}
            </div>
          </Card>
        )}

        {sum?.history && sum.history.length > 1 && (
          <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(2)}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-title text-lg">Ultimi 14 giorni</h3>
              <div className="flex gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-petrolio"><i className="h-2 w-3 rounded-full bg-acqua/70" />sonno</span>
                <span className="flex items-center gap-1 text-[#b0563f]"><i className="h-0.5 w-3 bg-[#d07a5f]" />battito</span>
              </div>
            </div>
            <HealthChart data={sum.history} />
          </Card>
        )}

        <div>
          <h3 className="font-title mb-2 mt-1 text-lg">Le tue sorgenti</h3>
          <div className="space-y-2">
            {sources.map((s, i) => {
              const meta = SOURCES[s.id] ?? { name: s.name ?? s.id, icon: '📈' }
              return (
                <motion.div key={s.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={stagger(i + 3, 0.05)}
                  className={`flex items-center gap-3 rounded-[20px] p-3.5 ${s.comingSoon ? 'bg-white/45' : 'bg-white/85 shadow-[0_8px_20px_-14px_rgb(44_105_117/.6)]'}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-salvia-chiaro text-xl">{meta.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`font-semibold ${s.comingSoon ? 'text-inchiostro/55' : 'text-inchiostro'}`}>{meta.name}</div>
                    <div className="text-xs text-inchiostro/55">
                      {s.comingSoon ? 'In arrivo nell\'app nativa' : s.connected ? `Collegato${s.lastSync ? ` · ultimo dato ${ago(s.lastSync)}` : ''}` : s.id === 'apple_health' ? 'Con un Comando rapido, in 5 minuti' : 'Importa corse e camminate'}
                    </div>
                  </div>
                  {s.connected && <span className="h-2.5 w-2.5 rounded-full bg-acqua shadow-[0_0_8px_2px_rgb(104_178_160/.7)]" />}
                  {!s.comingSoon && s.id === 'apple_health' && (
                    <Button variant="light" className="px-4 py-2 text-sm" onClick={() => setAppleOpen(true)}>{s.connected ? 'Token' : 'Configura'}</Button>
                  )}
                  {!s.comingSoon && s.id === 'strava' && (
                    s.connected
                      ? <Button variant="ghost" className="px-3 py-2 text-sm" onClick={stravaOff}>Scollega</Button>
                      : <Button variant="light" className="px-4 py-2 text-sm" onClick={() => { window.location.href = `/api/connect/strava?u=${encodeURIComponent(getUserId() ?? '')}` }}>Collega</Button>
                  )}
                </motion.div>
              )
            })}
          </div>
        </div>
        <p className="px-1 text-xs leading-relaxed text-inchiostro/55">Usiamo solo sonno, battito a riposo, HRV, passi e allenamenti, per capire come stai oggi. Niente viene venduto o condiviso.</p>
      </div>

      <AnimatePresence>{appleOpen && <AppleSheet onClose={() => setAppleOpen(false)} />}</AnimatePresence>
    </div>
  )
}

function HealthChart({ data }: { data: { date: string; sleepMinutes?: number; restingHr?: number }[] }) {
  const W = 320, H = 150, P = 14
  const n = data.length
  const bw = (W - 2 * P) / n
  const maxSleep = Math.max(540, ...data.map((d) => d.sleepMinutes ?? 0))
  const hrs = data.map((d) => d.restingHr).filter((x): x is number => x != null)
  const lo = Math.min(...hrs) - 3, hi = Math.max(...hrs) + 3
  const yHr = (v: number) => P + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - 2 * P - 20)
  const line = data.map((d, i) => (d.restingHr == null ? '' : `${i === 0 ? 'M' : 'L'}${P + bw * i + bw / 2},${yHr(d.restingHr)}`)).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="mt-3 w-full">
      {data.map((d, i) => {
        const h = ((d.sleepMinutes ?? 0) / maxSleep) * (H - 2 * P)
        const short = (d.sleepMinutes ?? 999) < 360
        return (
          <motion.rect key={d.date} x={P + bw * i + 2} width={bw - 4} rx={4} y={H - P - h} height={h}
            fill={short ? '#E8B64C' : '#68B2A0'} fillOpacity={i === n - 1 ? 0.95 : 0.55}
            style={{ transformOrigin: `0px ${H - P}px` }} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ ...spring.gentle, delay: i * 0.03 }} />
        )
      })}
      <line x1={P} x2={W - P} y1={H - P - (360 / maxSleep) * (H - 2 * P)} y2={H - P - (360 / maxSleep) * (H - 2 * P)} stroke="#E8B64C" strokeDasharray="3 4" strokeOpacity=".8" />
      <motion.path d={line} fill="none" stroke="#d07a5f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 0.4 }} />
      {data.map((d, i) => ((i % 3 === 0 && i < n - 2) || i === n - 1) && (
        <text key={'t' + d.date} x={P + bw * i + bw / 2} y={H + 10} textAnchor="middle" fontSize="9" fill="#12313A" fillOpacity=".5">
          {i === n - 1 ? 'oggi' : new Date(d.date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'numeric' })}
        </text>
      ))}
    </svg>
  )
}

function AppleSheet({ onClose }: { onClose: () => void }) {
  const { toast } = useStore()
  const [token, setToken] = useState<string | null>(null)
  useEffect(() => { api.healthToken().then((t) => setToken(t.token)).catch((e: Error) => toast(e.message)) }, [toast])
  const url = `${window.location.origin}/api/health/ingest`
  async function copy(text: string, what: string) {
    try { await navigator.clipboard.writeText(text); toast(`${what} copiato`, '📋') } catch { toast('Tieni premuto per copiarlo') }
  }
  const steps = [
    'Apri l\'app Comandi rapidi e crea un nuovo comando "PassoPasso Salute".',
    'Aggiungi "Trova campioni salute" per sonno, battito a riposo, HRV e passi di oggi.',
    'Aggiungi "Ottieni contenuti URL": metodo POST, JSON, all\'indirizzo qui sotto, con l\'header X-Health-Token.',
    'In Automazione, fallo partire ogni mattina alle 7. Fatto: la prontezza arriva da sola.',
  ]
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-inchiostro/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={spring.gentle}
        drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.05, bottom: 0.6 }} onDragEnd={(_, i) => { if (i.offset.y > 110) onClose() }}
        className="safe-bottom relative max-h-[88%] w-full overflow-y-auto rounded-t-[34px] bg-white px-6 pt-3 shadow-[0_-20px_60px_-20px_rgb(18_49_58/.5)]">
        <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-inchiostro/15" />
        <div className="text-3xl">❤️</div>
        <h2 className="font-title text-[26px] leading-tight text-inchiostro">Apple Salute, con un Comando rapido</h2>
        <ol className="mt-4 space-y-2.5">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[14.5px] text-inchiostro/85"><span className="font-title grid h-6 w-6 shrink-0 place-items-center rounded-full bg-salvia text-xs text-petrolio">{i + 1}</span>{s}</li>
          ))}
        </ol>
        <div className="mt-4 space-y-2">
          <motion.button whileTap={press} onClick={() => copy(url, 'Indirizzo')} className="w-full rounded-2xl bg-salvia-chiaro px-4 py-3 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-acqua">Indirizzo</div>
            <div className="break-all font-mono text-[13px] text-inchiostro">{url}</div>
          </motion.button>
          <motion.button whileTap={press} onClick={() => token && copy(token, 'Token')} className="w-full rounded-2xl bg-salvia-chiaro px-4 py-3 text-left">
            <div className="text-[11px] font-bold uppercase tracking-wider text-acqua">Il tuo token personale (tocca per copiarlo)</div>
            <div className="font-mono text-[15px] font-semibold text-petrolio">{token ?? '…'}</div>
          </motion.button>
        </div>
        <p className="mt-3 text-xs text-inchiostro/55">Il token identifica solo te: non condividerlo. Nell'app nativa tutto questo diventa un solo tocco.</p>
        <div className="pb-4 pt-4"><Button className="w-full" onClick={onClose}>Fatto</Button></div>
      </motion.div>
    </motion.div>
  )
}
