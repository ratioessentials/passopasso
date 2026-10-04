import { NEUTRAL, type Interp, type Pose } from './skeleton'

export const ARCHETYPES = [
  'marcia', 'camminata_veloce', 'corsetta', 'corsa', 'scatto', 'squat', 'affondo', 'ponte', 'plank',
  'flessioni_muro', 'polpacci', 'rotazioni_braccia', 'rotazioni_anche', 'allungamento', 'respirazione',
  'jumping_jack', 'step',
] as const
export type Archetype = (typeof ARCHETYPES)[number]

export type Prop = 'wall' | 'step' | 'mat'
type Key = Pose & { t?: number }
export type Clip = {
  label: string
  duration: number // ms per ciclo
  interp: Interp
  anchor?: 'hip' | 'foot' // a terra: anca fissa (andature) o piede vicino fisso (esercizi sul posto)
  anchorX?: number
  props?: Prop[]
  still: number // fase mostrata quando è fermo (o con prefers-reduced-motion)
  keys?: Key[]
  fn?: (phase: number) => Pose
}

const P = (p: Partial<Key>): Key => ({ ...NEUTRAL, ...p })
const HANDS_ON_HIPS = { aF: -30, eF: 57, aB: -26, eB: 55 }

function walk(s: number, elbow: number, torso: number): Key[] {
  const arms = (sw: number) => ({ aF: sw, eF: elbow, aB: -sw, eB: elbow })
  return [
    P({ torso, hF: 22 * s, kF: 4, hB: -18 * s, kB: 8, ...arms(-22 * s) }),
    P({ torso, hF: 2, kF: 8, hB: 12 * s, kB: 45 * s, ...arms(0) }),
    P({ torso, hF: -18 * s, kF: 8, hB: 22 * s, kB: 4, ...arms(22 * s) }),
    P({ torso, hF: 12 * s, kF: 45 * s, hB: 2, kB: 8, ...arms(0) }),
  ]
}

function run(s: number, torso: number): Key[] {
  const knee = Math.min(130, 105 * s)
  return [
    P({ torso, hF: 35 * s, kF: 22, hB: -28 * s, kB: 38 * s, aF: -38 * s, eF: 88, aB: 42 * s, eB: 88, lift: 2.5 * s }),
    P({ torso, hF: 2, kF: 28, hB: 24 * s, kB: knee, aF: 0, eF: 90, aB: 0, eB: 90 }),
    P({ torso, hF: -28 * s, kF: 38 * s, hB: 35 * s, kB: 22, aF: 42 * s, eF: 88, aB: -38 * s, eB: 88, lift: 2.5 * s }),
    P({ torso, hF: 24 * s, kF: knee, hB: 2, kB: 28, aF: 0, eF: 90, aB: 0, eB: 90 }),
  ]
}

const STAND = P({})
const SQUAT_DOWN = P({ torso: 38, hF: 82, kF: 105, hB: 80, kB: 103, aF: 88, eF: 0, aB: 84, eB: 0 })
const LUNGE_UP = P({ hF: 30, kF: 5, hB: -30, kB: 5, aF: -8, eF: 20, aB: 8, eB: 20 })
const LUNGE_DOWN = P({ hF: 80, kF: 90, hB: -10, kB: 90, aF: -8, eF: 20, aB: 8, eB: 20 })

// Ponte: sdraiato sulla schiena, testa a sinistra, piedi a terra
const BRIDGE_ARMS = { aF: 88, eF: 0, aB: 86, eB: 0 }
const BRIDGE_DOWN = P({ hip: [62, 95], torso: -90, head: -90, footF: [80, 101], footB: [77, 101], ...BRIDGE_ARMS })
const BRIDGE_UP = P({ hip: [62, 78], torso: -125, head: -96, footF: [80, 101], footB: [77, 101], ...BRIDGE_ARMS })

// Plank sugli avambracci, testa a destra
const PLANK = (dy: number, tilt: number) =>
  P({ hip: [52, 89 - dy], torso: 80 - tilt, head: 84 - tilt, footF: [22, 98], footB: [24, 98], aF: 0, eF: 90, aB: 2, eB: 88 })

// Piegamenti al muro: corpo dritto dai piedi alla testa, mani sul muro
function wallPush(theta: number): Key {
  const r = (theta * Math.PI) / 180
  const hip: [number, number] = [40 + 31 * Math.sin(r), 101 - 31 * Math.cos(r)]
  return P({ hip, torso: theta, head: theta - 4, footF: [40, 101], footB: [38, 101], handF: [86, 52], handB: [85, 55] })
}

// Step: un gradino da x 62 a 96
const STEP_KEYS: Key[] = [
  P({ t: 0, hip: [46, 70.5], footF: [50, 101], footB: [44, 101], torso: 4 }),
  P({ t: 0.1, hip: [48, 70], footF: [60, 84], footB: [44, 101], torso: 8, aF: -15, eF: 30, aB: 15, eB: 30 }),
  P({ t: 0.2, hip: [51, 69], footF: [70, 89], footB: [45, 101], torso: 12, aF: -20, eF: 30, aB: 20, eB: 30 }),
  P({ t: 0.4, hip: [68, 58], footF: [72, 89], footB: [66, 89], torso: 4 }),
  P({ t: 0.55, hip: [68, 58], footF: [72, 89], footB: [66, 89], torso: 4 }),
  P({ t: 0.72, hip: [53, 68], footF: [72, 89], footB: [46, 101], torso: 6, aF: 15, eF: 30, aB: -15, eB: 30 }),
  P({ t: 0.82, hip: [49, 70], footF: [60, 85], footB: [45, 101], torso: 5 }),
  P({ t: 0.9, hip: [46, 70.5], footF: [50, 101], footB: [44, 101], torso: 4 }),
]

export const CLIPS: Record<Archetype, Clip> = {
  marcia: {
    label: 'Marcia', duration: 2000, interp: 'spline', still: 0,
    keys: [
      P({ hF: 70, kF: 100, hB: 0, kB: 3, aF: -30, eF: 45, aB: 40, eB: 55 }),
      P({ hF: 5, kF: 8, hB: 5, kB: 8, aF: 0, eF: 25, aB: 0, eB: 25 }),
      P({ hF: 0, kF: 3, hB: 70, kB: 100, aF: 40, eF: 55, aB: -30, eB: 45 }),
      P({ hF: 5, kF: 8, hB: 5, kB: 8, aF: 0, eF: 25, aB: 0, eB: 25 }),
    ],
  },
  camminata_veloce: { label: 'Camminata veloce', duration: 1100, interp: 'spline', still: 0, keys: walk(1.25, 85, 6) },
  corsetta: { label: 'Corsetta', duration: 860, interp: 'spline', still: 0, keys: run(0.75, 5) },
  corsa: { label: 'Corsa', duration: 700, interp: 'spline', still: 0, keys: run(1.05, 9) },
  scatto: { label: 'Scatto', duration: 540, interp: 'spline', still: 0, keys: run(1.35, 15) },
  squat: {
    label: 'Squat', duration: 2800, interp: 'ease', anchor: 'foot', anchorX: 60, still: 0.45,
    keys: [{ ...STAND, t: 0 }, { ...SQUAT_DOWN, t: 0.4 }, { ...SQUAT_DOWN, t: 0.55 }, { ...STAND, t: 0.9 }],
  },
  affondo: {
    label: 'Affondo', duration: 3000, interp: 'ease', anchor: 'foot', anchorX: 78, still: 0.45,
    keys: [{ ...LUNGE_UP, t: 0 }, { ...LUNGE_DOWN, t: 0.4 }, { ...LUNGE_DOWN, t: 0.55 }, { ...LUNGE_UP, t: 0.9 }],
  },
  ponte: {
    label: 'Ponte', duration: 3200, interp: 'ease', props: ['mat'], still: 0.5,
    keys: [{ ...BRIDGE_DOWN, t: 0 }, { ...BRIDGE_UP, t: 0.4 }, { ...BRIDGE_UP, t: 0.6 }, { ...BRIDGE_DOWN, t: 0.9 }],
  },
  plank: {
    label: 'Plank', duration: 3000, interp: 'spline', props: ['mat'], still: 0,
    keys: [PLANK(0, 0), PLANK(1.5, 1)],
  },
  flessioni_muro: {
    label: 'Piegamenti al muro', duration: 2600, interp: 'ease', props: ['wall'], still: 0,
    keys: [{ ...wallPush(20), t: 0 }, { ...wallPush(31), t: 0.45 }, { ...wallPush(31), t: 0.55 }, { ...wallPush(20), t: 0.9 }],
  },
  polpacci: {
    label: 'Polpacci', duration: 2000, interp: 'ease', still: 0.5,
    keys: [
      P({ t: 0, ...HANDS_ON_HIPS }),
      P({ t: 0.4, ...HANDS_ON_HIPS, lift: 7 }),
      P({ t: 0.6, ...HANDS_ON_HIPS, lift: 7 }),
      P({ t: 0.95, ...HANDS_ON_HIPS }),
    ],
  },
  rotazioni_braccia: {
    label: 'Rotazioni delle braccia', duration: 2000, interp: 'spline', still: 0.3,
    fn: (ph) => {
      const a = ph * 360
      return P({ aF: a, eF: 4, aB: a - 18, eB: 4 })
    },
  },
  rotazioni_anche: {
    label: 'Rotazioni delle anche', duration: 2400, interp: 'spline', anchor: 'foot', anchorX: 62, still: 0,
    fn: (ph) => {
      const s = Math.sin(ph * 2 * Math.PI)
      const c = Math.cos(ph * 2 * Math.PI)
      return P({ ...HANDS_ON_HIPS, hF: -9 * s, kF: 6 + 4 * c, hB: -9 * s - 2, kB: 6 + 4 * c, torso: 2 + 9 * s })
    },
  },
  allungamento: {
    label: 'Allungamento', duration: 3600, interp: 'ease', anchor: 'foot', anchorX: 54, still: 0.15,
    keys: [
      P({ t: 0, torso: -4, head: -8, aF: 158, eF: 0, aB: 152, eB: 0, lift: 2 }),
      P({ t: 0.3, torso: -4, head: -8, aF: 158, eF: 0, aB: 152, eB: 0, lift: 2 }),
      P({ t: 0.5, torso: 62, head: 80, hF: 8, kF: 10, hB: 6, kB: 10, aF: 22, eF: 0, aB: 18, eB: 0 }),
      P({ t: 0.8, torso: 62, head: 80, hF: 8, kF: 10, hB: 6, kB: 10, aF: 22, eF: 0, aB: 18, eB: 0 }),
    ],
  },
  respirazione: {
    label: 'Respirazione', duration: 4000, interp: 'ease', still: 0.5,
    keys: [
      P({ t: 0, aF: 4, eF: 10, aB: 0, eB: 10 }),
      P({ t: 0.45, torso: -3, head: -6, aF: 150, eF: 5, aB: 146, eB: 5, lift: 1 }),
      P({ t: 0.55, torso: -3, head: -6, aF: 150, eF: 5, aB: 146, eB: 5, lift: 1 }),
      P({ t: 0.95, aF: 4, eF: 10, aB: 0, eB: 10 }),
    ],
  },
  jumping_jack: {
    label: 'Jumping jack', duration: 1100, interp: 'ease', still: 0.45,
    keys: [
      P({ t: 0, kF: 20, kB: 20, hF: 8, hB: 6, aF: 10, eF: 10, aB: 6, eB: 10 }),
      P({ t: 0.45, lift: 8, hF: 6, kF: 3, hB: -6, kB: 3, aF: 176, eF: 0, aB: 170, eB: 0 }),
      P({ t: 0.8, kF: 12, kB: 12, hF: 5, hB: 4, aF: 60, eF: 5, aB: 56, eB: 5 }),
    ],
  },
  step: { label: 'Step', duration: 3200, interp: 'ease', props: ['step'], still: 0.45, keys: STEP_KEYS },
}

export const isArchetype = (m: unknown): m is Archetype => typeof m === 'string' && m in CLIPS
