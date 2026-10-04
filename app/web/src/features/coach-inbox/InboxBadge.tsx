import { AnimatePresence, motion } from 'motion/react'
import { spring } from '../../ui/motion'
import { useInbox } from './store'

/**
 * Pallino dei non letti per la tab "Coach". Da mettere dentro un contenitore `relative`:
 * si posiziona da solo in alto a destra dell'icona.
 */
export function InboxBadge({ className = '' }: { className?: string }) {
  const { unread } = useInbox()
  return (
    <AnimatePresence>
      {unread > 0 && (
        <motion.span
          key="badge"
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }} transition={spring.bouncy}
          className={`pointer-events-none absolute -right-1 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-b from-sole to-[#f3b04a] px-1 text-[10px] font-extrabold leading-none text-[#5a3a05] shadow-[0_0_12px_2px_rgb(246_199_107/.7)] ring-2 ring-white ${className}`}
          aria-label={`${unread} ${unread === 1 ? 'messaggio nuovo' : 'messaggi nuovi'} dal coach`}
        >
          {unread > 9 ? '9+' : unread}
        </motion.span>
      )}
    </AnimatePresence>
  )
}
