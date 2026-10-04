import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api, setUserId } from '../api/client'
import type { Progress } from '../api/types'
import { winIcon } from '../content/copy'
import { AnimatedNumber, Card, ErrorBox, Header, Skeleton } from '../ui/kit'
import { spring, stagger } from '../ui/motion'

export default function ProgressScreen() {
  const nav = useNavigate()
  const [p, setP] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { api.progress().then(setP).catch((e: Error) => setError(e.message)) }, [])

  return (
    <div className="min-h-full bg-gradient-to-b from-salvia to-salvia-chiaro pb-32">
      <Header title="I tuoi progressi" subtitle="Quello che conta davvero, bilancia esclusa." />
      {error && <ErrorBox message={error} />}
      {!p && !error && <div className="space-y-3 px-5"><Skeleton className="h-52" /><Skeleton className="h-24" /></div>}
      {p && (
        <div className="space-y-4 px-5">
          <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(0)}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-title text-lg">Costanza</h3>
              <span className="text-xs text-inchiostro/55">ultime {p.consistencyHistory.length} settimane</span>
            </div>
            <Chart data={p.consistencyHistory} />
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(1)} className="!p-4">
              <AnimatedNumber value={p.sessionsDone} className="font-title block text-[44px] leading-none text-petrolio" />
              <div className="mt-1 text-sm text-inchiostro/65">sedute fatte</div>
            </Card>
            <Card initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={stagger(2)} className="!p-4">
              <AnimatedNumber value={p.minutesTotal} className="font-title block text-[44px] leading-none text-petrolio" />
              <div className="mt-1 text-sm text-inchiostro/65">minuti di movimento</div>
            </Card>
          </div>
          <div>
            <h3 className="font-title mb-2 mt-2 text-lg">Le tue vittorie</h3>
            <div className="grid grid-cols-2 gap-3">
              {p.wins.map((w, i) => (
                <motion.div key={w.id} initial={{ opacity: 0, scale: 0.85, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={stagger(i + 3, 0.06)}
                  className="rounded-[22px] bg-white/85 p-4 shadow-[0_8px_20px_-14px_rgb(44_105_117/.6)]">
                  <div className="mb-2 grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-b from-sole/80 to-[#fbe3b0] text-2xl">{winIcon(w.icon)}</div>
                  <div className="font-semibold leading-tight text-inchiostro">{w.title}</div>
                  <div className="mt-1 text-xs text-inchiostro/50">{new Date(w.date + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</div>
                </motion.div>
              ))}
              {p.wins.length === 0 && <p className="col-span-2 text-sm text-inchiostro/60">La prima vittoria arriva presto. Anche solo iniziare conta.</p>}
            </div>
          </div>
          <button onClick={() => { setUserId(null); nav('/benvenuto', { replace: true }) }} className="mx-auto block pt-6 text-sm text-petrolio/70 underline decoration-petrolio/30 underline-offset-4">
            Esci e ricomincia da capo
          </button>
        </div>
      )}
    </div>
  )
}

function Chart({ data }: { data: { week: string; value: number }[] }) {
  const W = 320, H = 150, P = 18
  if (data.length === 0) return <p className="py-6 text-sm text-inchiostro/60">I dati arrivano dopo la prima settimana.</p>
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, data.length - 1)
  const y = (v: number) => H - P - (v / 100) * (H - 2 * P)
  const pts = data.map((d, i) => [x(i), y(d.value)] as const)
  const line = pts.map(([a, b], i) => {
    if (i === 0) return `M${a},${b}`
    const [pa, pb] = pts[i - 1]
    const cx = (pa + a) / 2
    return `C${cx},${pb} ${cx},${b} ${a},${b}`
  }).join(' ')
  const area = `${line} L${x(data.length - 1)},${H - P} L${x(0)},${H - P} Z`
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="mt-3 w-full">
      <defs>
        <linearGradient id="chartfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#68B2A0" stopOpacity=".45" /><stop offset="1" stopColor="#68B2A0" stopOpacity="0" /></linearGradient>
      </defs>
      {[25, 50, 75].map((g) => <line key={g} x1={P} x2={W - P} y1={y(g)} y2={y(g)} stroke="#2C6975" strokeOpacity=".08" strokeDasharray="3 4" />)}
      <motion.path d={area} fill="url(#chartfill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.6 }} />
      <motion.path d={line} fill="none" stroke="#2C6975" strokeWidth="3.5" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: 'easeInOut' }} />
      {pts.map(([a, b], i) => (
        <motion.g key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ ...spring.bouncy, delay: 0.2 + i * 0.15 }} style={{ transformOrigin: `${a}px ${b}px` }}>
          <circle cx={a} cy={b} r={i === pts.length - 1 ? 6 : 4} fill="#fff" stroke="#2C6975" strokeWidth="2.5" />
          {i === pts.length - 1 && <text x={a} y={b - 12} textAnchor="end" className="font-title" fontSize="15" fill="#2C6975" fontStyle="italic" fontWeight="800">{data[i].value}</text>}
        </motion.g>
      ))}
      {data.map((d, i) => (
        <text key={d.week} x={x(i)} y={H + 12} textAnchor="middle" fontSize="10" fill="#12313A" fillOpacity=".5">
          {new Date(d.week + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
        </text>
      ))}
    </svg>
  )
}
