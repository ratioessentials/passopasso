import { motion, type HTMLMotionProps } from 'motion/react'
import { LEVEL_COLORS } from '../../content/copy'
import { spring } from '../../ui/motion'

/**
 * La frase dell'utente, in Archivo corsivo, su una sfumatura del livello.
 * Da mostrare nella ripartenza, nel passaggio di livello e nella card della settimana 3.
 * `tone="light"` per gli sfondi già colorati (passaggio di livello): vetro chiaro invece della sfumatura.
 */
export function WhyCard({ why, level = 1, label = 'Il tuo perché', compact = false, tone = 'level', className = '', ...rest }: {
  why: string
  level?: number
  label?: string | null
  compact?: boolean
  tone?: 'level' | 'light'
  className?: string
} & Omit<HTMLMotionProps<'div'>, 'children'>) {
  const [dark, light] = LEVEL_COLORS[level] ?? LEVEL_COLORS[1]
  const quote = why.trim().replace(/^["“«]+|["”»]+$/g, '')
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={spring.gentle}
      {...rest}
      className={`relative overflow-hidden ${compact ? 'rounded-[20px] px-4 py-3' : 'rounded-[26px] px-5 py-5'} text-white ${tone === 'light' ? 'glass-dark' : 'shadow-soft'} ${className}`}
      style={tone === 'level' ? { background: `linear-gradient(160deg, ${dark} 0%, ${light} 100%)` } : undefined}
    >
      {tone === 'level' && <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/20 blur-2xl" />}
      <div className="relative">
        {label && <div className="text-[11px] font-bold uppercase tracking-wider text-white/75">{label}</div>}
        <p className={`font-title ${compact ? 'mt-0.5 text-[18px]' : 'mt-1.5 text-[24px]'} leading-tight`}>
          <span className="text-white/60">“</span>{quote}<span className="text-white/60">”</span>
        </p>
        {!compact && <div className="mt-2 text-[12px] text-white/70">Lo hai scritto tu, il primo giorno.</div>}
      </div>
    </motion.div>
  )
}
