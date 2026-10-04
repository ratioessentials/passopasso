import { animate, AnimatePresence, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useId, useMemo, useState, type ComponentProps, type ReactNode } from 'react'
import levelsJson from '../content/levels.json'
import { LEVEL_COLORS } from '../content/copy'
import { press, spring } from './motion'

const LEVEL_SVGS = (levelsJson as { n: number; svg: string }[]).map((l) => l.svg)

/** Icona del livello inline (id dei gradienti unici per ogni istanza). */
export function LevelIcon({ n, size = 64, className = '', style, ...rest }: { n: number; size?: number; className?: string } & Omit<ComponentProps<typeof motion.div>, 'children'>) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const svg = useMemo(() => LEVEL_SVGS[Math.min(Math.max(n, 1), 5) - 1].replaceAll('{uid}', uid + 'l' + n), [n, uid])
  return (
    <motion.div
      className={`shrink-0 ${className}`}
      {...rest}
      style={{ width: size, height: size, filter: 'drop-shadow(0 10px 18px rgb(29 74 90 / .35))', ...(style ?? {}) }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

type BtnVariant = 'primary' | 'light' | 'ghost' | 'glass'
const BTN: Record<BtnVariant, string> = {
  primary: 'bg-gradient-to-b from-petrolio to-[#347c84] text-white shadow-[0_12px_28px_-12px_rgb(44_105_117/.8)]',
  light: 'bg-white text-petrolio shadow-[0_10px_24px_-14px_rgb(44_105_117/.6)]',
  ghost: 'bg-transparent text-petrolio',
  glass: 'glass text-petrolio',
}

export function Button({ variant = 'primary', className = '', children, ...rest }: { variant?: BtnVariant } & ComponentProps<typeof motion.button>) {
  return (
    <motion.button
      whileTap={press}
      transition={spring.snappy}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold disabled:opacity-50 ${BTN[variant]} ${className}`}
      {...rest}
    >
      {children}
    </motion.button>
  )
}

export function Card({ className = '', children, ...rest }: ComponentProps<typeof motion.div>) {
  return (
    <motion.div className={`glass rounded-[26px] p-5 shadow-soft ${className}`} {...rest}>
      {children}
    </motion.div>
  )
}

/** Numero che sale con una molla. */
export function AnimatedNumber({ value, from = 0, className = '', suffix = '' }: { value: number; from?: number; className?: string; suffix?: string }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? value : from)
  const rounded = useTransform(mv, (v) => Math.round(v) + suffix)
  useEffect(() => {
    const c = animate(mv, value, { type: 'spring', stiffness: 40, damping: 18 })
    return () => c.stop()
  }, [value, mv])
  return <motion.span className={className}>{rounded}</motion.span>
}

/** Anello della costanza: si disegna con una molla. Mai streak. */
export function ConsistencyRing({ value, size = 150, stroke = 14, from = 0, light = false, children }: { value: number; size?: number; stroke?: number; from?: number; light?: boolean; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const uid = useId().replace(/:/g, '')
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`ring${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={light ? '#ffffff' : '#68B2A0'} />
            <stop offset="1" stopColor={light ? '#CDE0C9' : '#2C6975'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={light ? 'rgb(255 255 255 / .22)' : 'rgb(44 105 117 / .12)'} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#ring${uid})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c * (1 - from / 100) }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0.01, value) / 100) }}
          transition={{ type: 'spring', stiffness: 40, damping: 16, delay: 0.15 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}

/** Sfondo che respira: blob sfocati nei colori del livello. */
export function MeshBackground({ level = 2, className = '', fade = false }: { level?: number; className?: string; fade?: boolean }) {
  const [dark, light] = LEVEL_COLORS[level] ?? LEVEL_COLORS[2]
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden style={fade ? { maskImage: 'linear-gradient(180deg, #000 70%, transparent)', WebkitMaskImage: 'linear-gradient(180deg, #000 70%, transparent)' } : undefined}>
      <motion.div className="absolute inset-0" animate={{ background: `linear-gradient(180deg, ${dark} 0%, ${light} 48%, #E0ECDE 100%)` }} transition={{ duration: 1.2 }} />
      <div className="absolute -left-1/4 -top-1/4 h-[70%] w-[90%] rounded-full opacity-70 blur-[60px]" style={{ background: light, animation: 'blob 24s ease-in-out infinite', willChange: 'transform' }} />
      <div className="absolute -right-1/3 top-[10%] h-[55%] w-[80%] rounded-full opacity-60 blur-[70px]" style={{ background: '#CDE0C9', animation: 'blob 29s ease-in-out infinite reverse', willChange: 'transform' }} />
      <div className="absolute -bottom-1/4 left-[5%] h-[50%] w-[90%] rounded-full opacity-60 blur-[70px]" style={{ background: dark, animation: 'blob 21s ease-in-out -7s infinite', willChange: 'transform' }} />
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-2xl ${className}`} />
}

/** Microtesti che si alternano durante l'attesa dell'AI. */
export function RotatingText({ items, className = '', every = 1800 }: { items: readonly string[]; className?: string; every?: number }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % items.length), every)
    return () => clearInterval(t)
  }, [items.length, every])
  return (
    <div className={`relative h-6 overflow-hidden ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div key={i} initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={spring.gentle} className="absolute inset-x-0">
          {items[i]}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/** Testo che si scrive lettera per lettera. */
export function Typewriter({ text, className = '', speed = 18, delay = 0 }: { text: string; className?: string; speed?: number; delay?: number }) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? text.length : 0)
  useEffect(() => {
    if (reduce) { setN(text.length); return }
    setN(0)
    let i = 0
    let iv: ReturnType<typeof setInterval> | undefined
    const start = setTimeout(() => {
      iv = setInterval(() => {
        i += 1
        setN(i)
        if (i >= text.length && iv) clearInterval(iv)
      }, speed)
    }, delay)
    return () => { clearTimeout(start); if (iv) clearInterval(iv) }
  }, [text, speed, delay, reduce])
  return (
    <span className={className}>
      {text.slice(0, n)}
      <span className="opacity-0">{text.slice(n)}</span>
    </span>
  )
}

export function Header({ title, subtitle, onBack, right, light = false }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode; light?: boolean }) {
  return (
    <div className={`safe-top flex items-center gap-3 px-5 pb-3 ${light ? 'text-white' : 'text-inchiostro'}`}>
      {onBack && (
        <motion.button whileTap={press} onClick={onBack} aria-label="Indietro" className={`grid h-10 w-10 place-items-center rounded-full ${light ? 'glass-dark' : 'glass'}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </motion.button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="font-title truncate text-[26px] leading-tight">{title}</h1>
        {subtitle && <p className={`text-sm ${light ? 'text-white/80' : 'text-inchiostro/60'}`}>{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${className}`}>{children}</span>
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card className="mx-5 text-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <p className="mb-3 text-inchiostro/80">{message}</p>
      {onRetry && <Button variant="light" onClick={onRetry}>Riprova</Button>}
    </Card>
  )
}
