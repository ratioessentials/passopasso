import { lazy, type ComponentType } from 'react'

// Aggancio per la chat 4: se src/features/formcheck/index.tsx esiste, la rotta /formcheck lo carica in modo lazy.
const modules = import.meta.glob('../features/formcheck/index.tsx')
const loader = Object.values(modules)[0] as (() => Promise<{ default: ComponentType }>) | undefined
export const FormCheck = loader ? lazy(loader) : null
export const hasFormCheck = !!loader
