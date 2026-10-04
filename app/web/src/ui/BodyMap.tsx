import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import type { BodyZone } from '../api/types'
import { ZONE_LABELS } from '../content/copy'
import { press, spring } from './motion'

type Shape =
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number; rx: number; rot?: number }

type Part = { zone: BodyZone | null; shape: Shape }

const sym = (s: Shape): Shape => s.kind === 'circle' ? { ...s, cx: 200 - s.cx } : { ...s, x: 200 - s.x - s.w, rot: s.rot ? -s.rot : undefined }

function both(zone: BodyZone | null, s: Shape): Part[] { return [{ zone, shape: s }, { zone, shape: sym(s) }] }

// Silhouette semplice costruita dalle zone stesse: ogni parte si tocca.
function parts(side: 'fronte' | 'retro'): Part[] {
  const torsoTop: BodyZone = side === 'fronte' ? 'petto' : 'schiena_alta'
  return [
    { zone: null, shape: { kind: 'circle', cx: 100, cy: 36, r: 23 } },
    { zone: 'collo', shape: { kind: 'rect', x: 89, y: 56, w: 22, h: 20, rx: 8 } },
    ...both('braccia', { kind: 'rect', x: 40, y: 88, w: 20, h: 58, rx: 10, rot: 10 }),
    ...both('braccia', { kind: 'rect', x: 32, y: 142, w: 18, h: 54, rx: 9, rot: 6 }),
    ...both('polsi', { kind: 'circle', cx: 40, cy: 206, r: 9 }),
    { zone: torsoTop, shape: { kind: 'rect', x: 66, y: 78, w: 68, h: 64, rx: 20 } },
    { zone: side === 'retro' ? 'schiena_bassa' : null, shape: { kind: 'rect', x: 70, y: 144, w: 60, h: 40, rx: 14 } },
    ...both('spalle', { kind: 'circle', cx: 62, cy: 90, r: 15 }),
    { zone: 'anche', shape: { kind: 'rect', x: 66, y: 186, w: 68, h: 36, rx: 16 } },
    ...both(null, { kind: 'rect', x: 70, y: 224, w: 27, h: 60, rx: 13 }),
    ...both('ginocchia', { kind: 'circle', cx: 84, cy: 296, r: 13 }),
    ...both(null, { kind: 'rect', x: 73, y: 310, w: 22, h: 52, rx: 11 }),
    ...both('caviglie', { kind: 'circle', cx: 84, cy: 370, r: 9 }),
    ...both(null, { kind: 'rect', x: 68, y: 380, w: 26, h: 12, rx: 6 }),
  ]
}

function ShapeEl({ s, ...rest }: { s: Shape } & Record<string, unknown>) {
  if (s.kind === 'circle') return <motion.circle cx={s.cx} cy={s.cy} r={s.r} {...rest} />
  const r = <motion.rect x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...rest} />
  return s.rot ? <g transform={`rotate(${s.rot} ${s.x + s.w / 2} ${s.y + s.h / 2})`}>{r}</g> : r
}

export function BodyMap({ value, onChange }: { value: BodyZone[]; onChange: (z: BodyZone[]) => void }) {
  const [side, setSide] = useState<'fronte' | 'retro'>('fronte')
  const [hover, setHover] = useState<BodyZone | null>(null)
  const [last, setLast] = useState<BodyZone | null>(null)
  const toggle = (z: BodyZone) => {
    setLast(z)
    onChange(value.includes(z) ? value.filter((x) => x !== z) : [...value, z])
  }
  const label = hover ?? last

  return (
    <div>
      <div className="mb-3 flex justify-center">
        <div className="relative flex rounded-full bg-petrolio/10 p-1">
          {(['fronte', 'retro'] as const).map((s) => (
            <button key={s} onClick={() => setSide(s)} className={`relative z-10 px-5 py-1.5 text-sm font-semibold capitalize ${side === s ? 'text-white' : 'text-petrolio'}`}>
              {side === s && <motion.span layoutId="bodyside" transition={spring.snappy} className="absolute inset-0 -z-10 rounded-full bg-petrolio" />}
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="relative mx-auto h-[300px] w-[180px]" style={{ perspective: 800 }}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.svg
            key={side}
            viewBox="0 0 200 400"
            className="h-full w-full"
            initial={{ rotateY: -90, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} exit={{ rotateY: 90, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {parts(side).map((p, i) => {
              const on = p.zone ? value.includes(p.zone) : false
              const hot = p.zone && hover === p.zone
              return (
                <ShapeEl
                  key={i}
                  s={p.shape}
                  fill={on ? '#F2A08B' : hot ? '#9FD0C1' : p.zone ? '#B9D7C9' : '#D7E7D3'}
                  stroke="#ffffff"
                  strokeWidth={2}
                  style={{ cursor: p.zone ? 'pointer' : 'default', transformBox: 'fill-box', transformOrigin: 'center' }}
                  animate={on ? { scale: [1, 1.08, 1], opacity: [1, 0.85, 1] } : { scale: 1, opacity: 1 }}
                  transition={on ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' } : spring.snappy}
                  onPointerEnter={() => p.zone && setHover(p.zone)}
                  onPointerLeave={() => setHover(null)}
                  onClick={() => p.zone && toggle(p.zone)}
                />
              )
            })}
          </motion.svg>
        </AnimatePresence>
        <AnimatePresence>
          {label && (
            <motion.div key={label} initial={{ opacity: 0, y: 6, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={spring.snappy}
              className="pointer-events-none absolute -top-1 right-[-40px] rounded-full bg-inchiostro px-3 py-1 text-xs font-semibold text-white shadow-soft">
              {ZONE_LABELS[label]}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mt-3 flex min-h-[34px] flex-wrap justify-center gap-2">
        <AnimatePresence>
          {value.length === 0 && <motion.span key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm text-inchiostro/55">Tocca dove senti fastidio. Se va tutto bene, lascia così.</motion.span>}
          {value.map((z) => (
            <motion.button key={z} layout whileTap={press} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={spring.bouncy}
              onClick={() => toggle(z)} className="rounded-full bg-corallo/25 px-3 py-1.5 text-sm font-semibold text-[#9a4a36]">
              {ZONE_LABELS[z]} ×
            </motion.button>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
