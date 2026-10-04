import { motion } from 'motion/react'
import { NavLink, useLocation } from 'react-router'
import { press, spring } from './motion'

const I = (d: string) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
)

const TABS = [
  { to: '/', label: 'Oggi', icon: I('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>') },
  { to: '/settimana', label: 'Settimana', icon: I('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>') },
  { to: '/percorso', label: 'Percorso', icon: I('<path d="M6 21c0-4 4-4 4-8s-4-4-4-8"/><circle cx="18" cy="5" r="2"/><circle cx="16" cy="19" r="2"/><path d="M10 13h4"/>') },
  { to: '/cibo', label: 'Cibo', icon: I('<path d="M12 21c-5 0-8-3.5-8-8h16c0 4.5-3 8-8 8z"/><path d="M8 9c0-2 1-3 2-4M13 9c0-3 2-4 3-5"/>') },
  { to: '/progressi', label: 'Progressi', icon: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>') },
]
export const TAB_PATHS = TABS.map((t) => t.to)

export function TabBar() {
  const { pathname } = useLocation()
  const active = '/' + (pathname.split('/')[1] ?? '')
  return (
    <motion.nav
      initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} transition={spring.gentle}
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 px-3 pt-2"
    >
      <div className="glass mx-auto flex max-w-[460px] items-stretch justify-between rounded-[28px] p-1.5 shadow-soft">
        {TABS.map((t) => {
          const on = active === t.to
          return (
            <NavLink key={t.to} to={t.to} className="relative flex-1">
              <motion.div whileTap={press} className={`relative z-10 flex flex-col items-center gap-0.5 py-2 text-[10.5px] font-semibold transition-colors ${on ? 'text-white' : 'text-petrolio/70'}`}>
                {t.icon}
                {t.label}
              </motion.div>
              {on && <motion.div layoutId="tab-pill" transition={spring.snappy} className="absolute inset-0 rounded-[22px] bg-gradient-to-b from-petrolio to-acqua shadow-[0_8px_18px_-8px_rgb(44_105_117/.9)]" />}
            </NavLink>
          )
        })}
      </div>
    </motion.nav>
  )
}
