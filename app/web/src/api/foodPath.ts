// Percorso alimentare: client con mock. Contratto in docs/api.md ("Percorso alimentare")
// e docs/schema.md (Habit con `phase`).
import { ApiError, USE_MOCK } from './client'
import type { Habit } from './types'
import { request } from './inbox'

export type FoodPhaseId = 'sostituire' | 'aggiungere' | 'come_mangi'
export type FoodStepStatus = 'done' | 'current' | 'next' | 'skipped'

export interface FoodPhase { id: FoodPhaseId; title: string; weeks: string; /** sottotitolo breve: il server lo manda come `note` (il client ha una riserva) */ subtitle?: string | null; note?: string | null }
export interface FoodStep {
  habit: Habit & { phase?: FoodPhaseId }
  order: number
  status: FoodStepStatus
  /** la fase della tappa (il server la mette qui; in riserva si legge da habit.phase) */
  phase?: FoodPhaseId | string
  /** perché questa tappa è qui per te (ordine personalizzato) */
  why?: string | null
  /** per le tappe saltate: il motivo, dal mini-onboarding ("Non bevi bibite zuccherate") */
  skippedWhy?: string | null
}
export interface FoodPathResponse { phases: FoodPhase[]; steps: FoodStep[]; intro: string }

export const PHASE_FALLBACK: Record<FoodPhaseId, { title: string; weeks: string; subtitle: string; icon: string }> = {
  sostituire: { title: 'Sostituire', weeks: '1-3', subtitle: 'Prima togli una cosa, al suo posto ne metti una buona.', icon: '🔁' },
  aggiungere: { title: 'Aggiungere', weeks: '4-7', subtitle: 'Poi aggiungi: verdura, proteine, legumi, integrali.', icon: '➕' },
  come_mangi: { title: 'Come mangi', weeks: '8-12', subtitle: 'Alla fine impari ad ascoltarti: piatto, ritmo, fame.', icon: '🍽️' },
}

/* ---------- mock ---------- */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))

const h = (id: string, phase: FoodPhaseId, week: number, title: string, why: string, tips: string[] = []): FoodStep['habit'] => ({ id, phase, week, title, why, tips })

const MOCK_HABITS: FoodStep['habit'][] = [
  h('merendine_frutta', 'sostituire', 1, 'Merendine e gelati → un frutto o uno yogurt', 'Lo zucchero veloce chiama altro zucchero. La frutta sazia e non ti fa crollare dopo un\'ora.', ['Tieni la frutta a vista, le merendine in alto', 'Yogurt bianco e un cucchiaino di miele, se vuoi dolce']),
  h('bibite_acqua', 'sostituire', 2, 'Bibite zuccherate → acqua', 'Una bibita al giorno è un chilo di zucchero al mese, senza accorgertene.', ['Acqua frizzante con limone se ti manca il gusto']),
  h('spuntino_scelto', 'sostituire', 3, 'Lo spuntino lo scegli prima', 'Decidere alle 11 cosa mangi alle 17 toglie il distributore dall\'equazione.', ['Metti in borsa lo spuntino la mattina']),
  h('acqua_pasti', 'sostituire', 3, 'Un bicchiere d\'acqua a ogni pasto', 'Bere con regolarità aiuta energia e sazietà.', ['Tieni una bottiglia in vista']),
  h('verdura_un_pasto', 'aggiungere', 4, 'Verdura in un pasto al giorno', 'La verdura riempie, dà fibre e colore. Non serve contare niente.', ['Anche surgelata va benissimo', 'Parti da quella che ti piace già']),
  h('proteine_colazione', 'aggiungere', 5, 'Una fonte di proteine a colazione', 'Arrivi a pranzo senza fame nervosa e con più energia nelle sedute.', ['Yogurt greco, uova, ricotta, latte']),
  h('legumi_settimana', 'aggiungere', 6, 'Legumi almeno due volte a settimana', 'Saziano a lungo, costano poco e fanno bene all\'intestino.', ['Quelli in barattolo vanno benissimo']),
  h('cereali_integrali', 'aggiungere', 7, 'Cereali integrali al posto dei raffinati', 'Più fibre, energia che dura: utile nei giorni di seduta.', ['Comincia dal pane, è il cambio più semplice']),
  h('piatto_bilanciato', 'come_mangi', 8, 'Il piatto in tre parti', 'Metà verdura, un quarto proteine, un quarto cereali. Senza pesare nulla.', ['Guarda la foto del piatto: te lo disegna l\'app']),
  h('mangiare_seduti', 'come_mangi', 9, 'A tavola, senza schermi', 'Mangiare con attenzione fa sentire la sazietà prima.', ['Telefono a faccia in giù, 15 minuti']),
  h('cucinare_a_casa', 'come_mangi', 10, 'Un pasto in più cucinato a casa', 'Quando cucini tu, decidi tu. Anche una cosa semplice.', ['Una padella, verdura e una proteina: dieci minuti']),
  h('ascoltare_fame', 'come_mangi', 12, 'Ascolta fame e sazietà', 'Fermarsi a "sto bene" invece che a "sono pieno" è l\'abitudine che resta per sempre.', ['Prima del bis, aspetta cinque minuti']),
]

/** Giulia: alla tappa 4, con la tappa delle bibite saltata perché non ne beve. */
function mockPath(): FoodPathResponse {
  const current = 4
  const steps: FoodStep[] = MOCK_HABITS.map((habit, i) => {
    const order = i + 1
    if (habit.id === 'bibite_acqua') return { habit, order, phase: habit.phase, status: 'skipped', skippedWhy: 'Non bevi bibite zuccherate' }
    return { habit, order, phase: habit.phase, status: order < current ? 'done' : order === current ? 'current' : 'next', skippedWhy: null, why: order === current ? 'Fai già colazione: l\'acqua ai pasti è il passo più semplice adesso.' : null }
  })
  return {
    phases: (Object.keys(PHASE_FALLBACK) as FoodPhaseId[]).map((id) => ({ id, title: PHASE_FALLBACK[id].title, weeks: PHASE_FALLBACK[id].weeks, subtitle: PHASE_FALLBACK[id].subtitle })),
    steps,
    intro: 'Ora che ti alleni non devi mangiare perfetto. Cambiamo una cosa sola alla volta.',
  }
}

/* ---------- api ---------- */

export const foodPathApi = {
  path: async (): Promise<FoodPathResponse> => {
    if (USE_MOCK) { await wait(300); return mockPath() }
    try {
      const r = await request<FoodPathResponse>('GET', '/food/path')
      return { phases: r.phases ?? [], steps: r.steps ?? [], intro: r.intro ?? mockPath().intro }
    } catch (e) {
      // server senza percorso alimentare: si mostra il percorso di riserva
      if (e instanceof ApiError && e.status === 404) return mockPath()
      throw e
    }
  },
}

/** Nota "fame dopo la seduta" di riserva, in base all'orario (il server la manda in `afterFood` di /complete). */
export function afterFoodFallback(now = new Date()): string {
  const hr = now.getHours()
  if (hr < 10) return 'Avere fame adesso è normale: fai colazione come sempre, magari con una fonte di proteine.'
  if (hr < 14) return 'Avere fame adesso è normale: pranzo come al solito, con un po\' di verdura se riesci.'
  if (hr < 18) return 'Avere fame adesso è normale: un frutto o uno yogurt, poi cena come sempre.'
  return 'Avere fame adesso è normale: cena come sempre, con una fonte di proteine. Niente da recuperare.'
}
