import type { Exercise } from '../api/types'
import exercises from '../api/mockdata/exercises.json'

// Catalogo verificato (copia di content/exercises.json): serve per mostrare la versione più facile (regression).
const CATALOG = exercises as unknown as Exercise[]
export const findExercise = (id: string | null | undefined) => (id ? CATALOG.find((e) => e.id === id) ?? null : null)
