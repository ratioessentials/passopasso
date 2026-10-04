import { motion } from 'motion/react'
import { afterFoodFallback } from '../../api/foodPath'
import { spring } from '../../ui/motion'

/**
 * "Avere fame adesso è normale…": una riga per la schermata di fine seduta.
 * `text` arriva da `afterFood` di POST /api/sessions/:id/complete; senza, si usa quella per orario.
 * Pensata per lo sfondo colorato del risultato (vetro scuro, testo bianco).
 */
export function AfterFoodNote({ text, delay = 0.9, className = '' }: { text?: string | null; delay?: number; className?: string }) {
  const t = text?.trim() || afterFoodFallback()
  return (
    <motion.div initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...spring.gentle, delay }}
      className={`glass-dark flex items-start gap-3 rounded-[22px] px-4 py-3 text-left text-white ${className}`}>
      <span className="text-2xl leading-none">🍎</span>
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-wider text-white/75">E adesso, a tavola</div>
        <p className="mt-0.5 text-[14px] leading-snug text-white/95">{t}</p>
      </div>
    </motion.div>
  )
}
