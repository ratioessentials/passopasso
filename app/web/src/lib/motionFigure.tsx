import { lazy, Suspense, type ComponentType } from 'react'
import type { MotionArchetype } from '../api/types'
import { LevelIcon } from '../ui/kit'

type FigureProps = { motion: MotionArchetype; playing?: boolean; size?: number; framed?: boolean }

// Aggancio per la chat 4: src/features/motion/index.ts(x) con export default MotionFigure.
const modules = import.meta.glob(['../features/motion/index.ts', '../features/motion/index.tsx'])
const loader = Object.values(modules)[0] as (() => Promise<{ default: ComponentType<FigureProps> }>) | undefined
const MotionFigure = loader ? lazy(loader) : null

/** Omino animato dell'esercizio; se manca l'archetipo (o il componente) mostra il pittogramma fermo del livello. */
export function ExerciseFigure({ motion, playing = true, size = 170, level = 1 }: { motion?: MotionArchetype | null; playing?: boolean; size?: number; level?: number }) {
  const still = <LevelIcon n={level} size={Math.round(size * 0.6)} />
  if (!motion || !MotionFigure) return still
  return (
    <Suspense fallback={still}>
      <MotionFigure motion={motion} playing={playing} size={size} framed />
    </Suspense>
  )
}

