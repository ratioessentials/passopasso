import type { Transition } from 'motion/react'

// Un'unica configurazione delle molle, usata ovunque.
export const spring = {
  snappy: { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 } as Transition,
  gentle: { type: 'spring', stiffness: 170, damping: 26 } as Transition,
  bouncy: { type: 'spring', stiffness: 380, damping: 16 } as Transition,
  slow: { type: 'spring', stiffness: 60, damping: 18 } as Transition,
}

export const press = { scale: 0.96 }

export const stagger = (i: number, base = 0.06) => ({ ...spring.gentle, delay: i * base })

export const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}

export const vibrate = (pattern: number | number[]) => {
  try { navigator.vibrate?.(pattern) } catch { /* non supportato */ }
}
