// Coach proattivo (inbox) e "il tuo perché": client con mock. Contratto in docs/api.md
// ("Coach proattivo", "Il tuo perché") e docs/schema.md (CoachMessage).
import { ApiError, getUserId, USE_MOCK } from './client'
import type { Me, Session } from './types'

export type CoachTrigger =
  | 'ripartenza_fatta' | 'assenza_3_giorni' | 'pattern_giorno_saltato' | 'due_duro' | 'prontezza_bassa_2gg'
  | 'record_personale' | 'fine_settimana_1' | 'inizio_settimana_2' | 'livello_nuovo'

export const TRIGGER_LABELS: Record<CoachTrigger, string> = {
  ripartenza_fatta: 'Ripartenza completata',
  assenza_3_giorni: 'Tre giorni senza aprire l\'app',
  pattern_giorno_saltato: 'Salti sempre lo stesso giorno',
  due_duro: 'Due sedute "duro" di fila',
  prontezza_bassa_2gg: 'Prontezza bassa da due giorni',
  record_personale: 'Record personale',
  fine_settimana_1: 'Fine della prima settimana',
  inizio_settimana_2: 'Inizio della seconda settimana',
  livello_nuovo: 'Nuovo livello',
}

export interface CoachAction {
  label: string
  type: 'move_day' | 'open_week' | 'open_session' | 'reduce_week' | string
  from?: string
  to?: string
  [k: string]: unknown
}

export interface CoachMessage {
  id: string
  date: string
  trigger: CoachTrigger | string
  text: string
  /** "Ti scrivo perché…": il motivo, sempre visibile in piccolo */
  because: string
  read: boolean
  actions: CoachAction[]
}

export interface InboxResponse { unread: number; messages: CoachMessage[] }

/** `GET /api/sessions/:id/alternatives`: il perché dell'utente e la seduta ridotta da 10 minuti */
export interface Alternatives { why: string | null; short: Session | null }

/* ---------- http ---------- */

export async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {}
  const uid = getUserId()
  if (uid) headers['X-User-Id'] = uid
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('network', 'Non riesco a collegarmi. Controlla la connessione e riprova.', 0)
  }
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { /* risposta non JSON */ }
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string } } | null)?.error
    throw new ApiError(err?.code ?? 'http_' + res.status, err?.message ?? 'Qualcosa non è andato. Riproviamo tra un attimo.', res.status)
  }
  return data as T
}

/** Finché il server non espone un endpoint (404), si usa il mock: così la demo non si rompe. */
async function withFallback<T>(real: () => Promise<T>, mock: () => Promise<T>): Promise<T> {
  if (USE_MOCK) return mock()
  try { return await real() } catch (e) {
    if (e instanceof ApiError && e.status === 404) return mock()
    throw e
  }
}

/* ---------- mock ---------- */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.random() * 200))
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

export const MOCK_WHY = 'Per giocare con mio figlio senza fiatone'

const MOCK_TEXTS: Record<CoachTrigger, { text: string; because: string; actions: CoachAction[] }> = {
  ripartenza_fatta: {
    text: 'Sei tornata. È la cosa più difficile, ed è fatta. Il venerdì ti pesa: se vuoi lo sposto al sabato, così arrivi più leggera.',
    because: 'hai completato la ripartenza',
    actions: [{ label: 'Sposta il venerdì al sabato', type: 'move_day', from: 'ven', to: 'sab' }],
  },
  assenza_3_giorni: {
    text: `Tre giorni di silenzio, nessun problema. Mi hai detto che lo fai ${MOCK_WHY.charAt(0).toLowerCase() + MOCK_WHY.slice(1)}: quella cosa è ancora lì. Dieci minuti oggi bastano per riprendere il filo.`,
    because: 'non ci sentiamo da tre giorni',
    actions: [{ label: 'Apri la seduta di oggi', type: 'open_session' }],
  },
  pattern_giorno_saltato: {
    text: 'Ho notato che il mercoledì salta spesso. Non è colpa tua: è il giorno sbagliato. Lo spostiamo al giovedì?',
    because: 'il mercoledì è saltato tre volte',
    actions: [{ label: 'Sposta il mercoledì al giovedì', type: 'move_day', from: 'mer', to: 'gio' }],
  },
  due_duro: {
    text: 'Due sedute di fila "dure". Ti ascolto: la prossima la faccio più leggera, così torni a chiudere con il fiato giusto.',
    because: 'le ultime due sedute ti sono sembrate dure',
    actions: [],
  },
  prontezza_bassa_2gg: {
    text: 'Da due giorni dormi poco e il battito a riposo è più alto del solito. Oggi va bene anche solo camminare: il corpo recupera, il percorso non si ferma.',
    because: 'la tua prontezza è bassa da due giorni',
    actions: [{ label: 'Alleggerisci la settimana', type: 'reduce_week' }],
  },
  record_personale: {
    text: 'Venti minuti di cammino continuo: la tua prima settimana erano otto. Non serve una bilancia per vedere questo.',
    because: 'hai fatto il tuo record di minuti continui',
    actions: [],
  },
  fine_settimana_1: {
    text: 'Prima settimana chiusa. Hai fatto la cosa che la maggior parte delle persone non fa: hai cominciato. Da qui in avanti è solo ripetere.',
    because: 'hai finito la prima settimana',
    actions: [{ label: 'Guarda la settimana', type: 'open_week' }],
  },
  inizio_settimana_2: {
    text: `La seconda settimana è quella in cui si molla di più: lo sai già, così non ti sorprende. ${MOCK_WHY}: tienilo a mente quando il divano chiama.`,
    because: 'inizia la seconda settimana',
    actions: [],
  },
  livello_nuovo: {
    text: `Livello nuovo. Ricordi perché hai cominciato? "${MOCK_WHY}". Ci sei più vicina di una settimana fa.`,
    because: 'sei passata di livello',
    actions: [],
  },
}

let mockMessages: CoachMessage[] = [
  { id: 'cm_mock_2', date: hoursAgo(3), trigger: 'record_personale', read: false, ...MOCK_TEXTS.record_personale },
  { id: 'cm_mock_1', date: hoursAgo(26), trigger: 'ripartenza_fatta', read: true, ...MOCK_TEXTS.ripartenza_fatta },
]

const mockInbox = (): InboxResponse => ({ unread: mockMessages.filter((m) => !m.read).length, messages: clone(mockMessages) })

function mockShort(base?: Session | null): Session {
  const items = (base?.items ?? []).slice(0, 4)
  return {
    id: `${base?.id ?? 's_oggi'}_ridotta`,
    date: base?.date ?? new Date().toISOString().slice(0, 10),
    status: 'planned',
    kind: 'ridotta' as unknown as Session['kind'],
    level: base?.level ?? 1,
    minutes: 10,
    intensity: 0.8,
    title: 'Dieci minuti, con calma',
    reason: 'Una versione corta della seduta di oggi: riscaldamento, due esercizi, respiro. Conta come fatta.',
    items: items.map((it) => ({ ...it, sets: Math.min(it.sets, 1), seconds: it.seconds ? Math.min(it.seconds, 120) : undefined, restSec: Math.min(it.restSec, 30) })),
    bonusPoints: 0,
    segments: null,
  }
}

/* ---------- api ---------- */

export const inboxApi = {
  list: () => withFallback(
    () => request<InboxResponse>('GET', '/coach/inbox'),
    async () => { await wait(250); return mockInbox() },
  ),
  markRead: (id: string) => withFallback(
    () => request<null>('POST', `/coach/inbox/${encodeURIComponent(id)}/read`),
    async () => { const m = mockMessages.find((x) => x.id === id); if (m) m.read = true; return null },
  ),
  /** Applica un'azione del messaggio. Risponde come GET /api/me (null se il server non lo manda). */
  action: (id: string, actionIndex: number) => withFallback(
    () => request<Me | null>('POST', `/coach/inbox/${encodeURIComponent(id)}/action`, { actionIndex }),
    async () => { await wait(700); const m = mockMessages.find((x) => x.id === id); if (m) { m.read = true; m.actions = [] } return null },
  ),
  /** Solo demo e test: genera subito un messaggio per il trigger scelto. */
  simulate: (trigger: CoachTrigger) => withFallback(
    () => request<CoachMessage | InboxResponse>('POST', '/coach/inbox/simulate', { trigger }),
    async () => {
      await wait(900)
      const t = MOCK_TEXTS[trigger] ?? MOCK_TEXTS.fine_settimana_1
      const m: CoachMessage = { id: 'cm_mock_' + Math.random().toString(36).slice(2, 7), date: new Date().toISOString(), trigger, read: false, ...clone(t) }
      mockMessages = [m, ...mockMessages]
      return clone(m)
    },
  ),
  /** Prima dello skip: il perché dell'utente e la seduta ridotta da 10 minuti. */
  alternatives: (sessionId: string, base?: Session | null) => withFallback(
    () => request<Alternatives>('GET', `/sessions/${encodeURIComponent(sessionId)}/alternatives`),
    async () => { await wait(400); return { why: MOCK_WHY, short: mockShort(base) } },
  ),
}

/** Il perché dell'utente dal profilo (il campo arriva col server dell'ottava ondata). */
export function whyOf(me: Me | null | undefined): string | null {
  const w = (me?.profile as { why?: string | null } | undefined)?.why
  if (w && w.trim()) return w.trim()
  return USE_MOCK ? MOCK_WHY : null
}
