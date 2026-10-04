// Backend finto per lavorare senza server (VITE_MOCK=1).
// Utente "Giulia", livello 2, settimana con una seduta saltata.
import type {
  BodyZone, CalendarConnectResponse, Category, ChatMessage, CoachReply, CheckinRequest, CheckinResponse, CompleteResponse, Exercise, Feedback,
  Level, LevelsResponse, MealFeedback, Me, OnboardingReply, Profile, Progress, Session, SessionItem,
  SkipReason, SkipResponse, Week, WidgetData, Win,
} from './types'
import exercisesJson from './mockdata/exercises.json'
import programJson from './mockdata/program.json'
import { RED_FLAGS } from '../content/copy'

const EXERCISES = exercisesJson as unknown as Exercise[]
const PROGRAM = programJson as unknown as { levels: Level[] }
const byId = (id: string) => EXERCISES.find((e) => e.id === id)!

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.random() * 300))
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

function iso(d: Date) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const today = new Date()
today.setHours(12, 0, 0, 0)
const monday = addDays(today, -((today.getDay() + 6) % 7))

function item(id: string, sets: number, amount: number, restSec = 40, note?: string): SessionItem {
  const ex = byId(id)
  return ex.prescription.type === 'seconds'
    ? { exerciseId: id, exercise: ex, sets, seconds: amount, restSec, note }
    : { exerciseId: id, exercise: ex, sets, reps: amount, restSec, note }
}

function baseItems(): SessionItem[] {
  return [
    item('marcia_sul_posto', 1, 60, 15),
    item('rotazioni_anche', 1, 30, 15),
    item('camminata_svelta', 1, 900, 60, 'Riesci a parlare ma non a cantare'),
    item('squat_sedia', 2, 10, 45, 'Lento in discesa'),
    item('piegamenti_muro', 2, 10, 45),
    item('ponte_glutei', 2, 12, 40),
    item('gatto_mucca', 1, 40, 15),
    item('respirazione_profonda', 1, 60, 0),
  ]
}

function mkSession(dayOffset: number, status: Session['status'], title: string, extra: Partial<Session> = {}): Session {
  const d = addDays(monday, dayOffset)
  return {
    id: `s_${iso(d).replaceAll('-', '')}_1`,
    date: iso(d),
    status,
    kind: 'normale',
    level: 2,
    minutes: 25,
    intensity: 1.0,
    title,
    items: baseItems(),
    bonusPoints: 0,
    ...extra,
  }
}

const todayOffset = (today.getDay() + 6) % 7

// Settimana: le sedute sono lun/mer/ven/dom. Le prime già passate sono una fatta e una saltata.
function initialWeek(): Session[] {
  const plan = [0, 2, 4, 6]
  const titles = ['Passo svelto e forza', 'Gambe e respiro', 'Passo svelto e core', 'Forza dolce e mobilità']
  const out: Session[] = []
  let skippedOne = false
  plan.forEach((off, i) => {
    let status: Session['status'] = 'planned'
    if (off < todayOffset) {
      status = !skippedOne && i === 1 ? 'skipped' : 'done'
      if (status === 'skipped') skippedOne = true
      if (i === 0 && todayOffset <= 2) status = 'skipped'
    }
    out.push(mkSession(off, status, titles[i]))
  })
  // la seduta di oggi c'è sempre (per la demo)
  if (!out.some((s) => s.date === iso(today))) {
    out.push(mkSession(todayOffset, 'planned', 'Passo svelto e forza'))
    out.sort((a, b) => a.date.localeCompare(b.date))
  }
  // e almeno una saltata nella settimana, se oggi è lunedì la mettiamo sulla domenica prima
  if (!out.some((s) => s.status === 'skipped')) {
    out.unshift(mkSession(-1, 'skipped', 'Gambe e respiro'))
  }
  return out
}

const giulia: Profile = {
  name: 'Giulia', age: 34, goal: 'Riuscire a correre 20 minuti senza fermarmi', experience: 'poca',
  daysPerWeek: 3, minutesPerSession: 25, equipment: ['sedia', 'muro'], limitations: ['ginocchia'],
  preferredTime: 'sera', startLevel: 1,
}

const state = {
  profile: giulia,
  level: 2,
  progress: 0.62,
  consistency: 72,
  intensity: 1.0,
  sessions: initialWeek(),
  habitDays: 3,
  habitCheckedToday: false,
  wins: [
    { id: 'livello_2', title: 'Sei salita al livello 2', date: iso(addDays(today, -8)), icon: 'stairs' },
    { id: 'prima_ripartenza', title: 'Hai ripreso dopo una pausa', date: iso(addDays(today, -5)), icon: 'heart' },
    { id: 'prima_settimana', title: 'Prima settimana completata', date: iso(addDays(today, -14)), icon: 'star' },
  ] as Win[],
  completed: 9,
  minutes: 205,
  levelUpOffered: false,
}

const habit = {
  id: 'verdura_pranzo', week: 3, title: 'Metà piatto di verdura a pranzo',
  why: 'La verdura riempie, dà fibre e colore. Non serve contare niente.',
  tips: ['Parti dalla verdura che ti piace già', 'Anche surgelata va benissimo', 'Un contorno pronto nel frigo aiuta'],
  photoPrompt: 'Nel piatto c\'è almeno metà di verdura?',
}

function levelState() {
  const l = PROGRAM.levels[state.level - 1]
  return { n: l.n, name: l.name, verb: l.verb, progress: state.progress, ready: state.progress >= 1 }
}

function todaySession(): Session | null {
  return state.sessions.find((s) => s.date === iso(today) && s.status === 'planned')
    ?? state.sessions.find((s) => s.date >= iso(today) && s.status === 'planned')
    ?? null
}

function me(): Me {
  return {
    profile: state.profile,
    level: levelState(),
    consistency: state.consistency,
    intensity: state.intensity,
    today: todaySession(),
    habit: { ...habit, doneDays: state.habitDays },
    wins: state.wins,
  }
}

function pick(category: Category, n: number, pain: BodyZone[], used: Set<string>): Exercise[] {
  const ok = EXERCISES.filter((e) => e.category === category && e.minLevel <= state.level && !used.has(e.id)
    && !e.zones.some((z) => pain.includes(z)) && e.equipment.every((q) => state.profile.equipment.includes(q)))
  ok.sort((a, b) => b.minLevel - a.minLevel)
  const out = ok.slice(0, n)
  out.forEach((e) => used.add(e.id))
  return out
}

function regenerate(s: Session, req: CheckinRequest): Session {
  const used = new Set<string>()
  const scale = req.minutes / 25
  const low = req.energy <= 2
  const k = low ? 0.85 : req.energy >= 4 ? 1.1 : 1
  const cardioSec = Math.round((req.minutes >= 20 ? 600 : req.minutes >= 15 ? 420 : 300) * k / 30) * 30
  const items: SessionItem[] = []
  const add = (e: Exercise, sets: number, restSec: number, override?: number) => {
    const base = override ?? e.prescription.default
    const amount = Math.max(e.prescription.type === 'seconds' ? 20 : 5, Math.round(base * k))
    items.push(e.prescription.type === 'seconds'
      ? { exerciseId: e.id, exercise: e, sets, seconds: amount, restSec }
      : { exerciseId: e.id, exercise: e, sets, reps: amount, restSec })
  }
  pick('riscaldamento', 2, req.pain, used).forEach((e) => add(e, 1, 15))
  pick('cardio', 1, req.pain, used).forEach((e) => add(e, 1, 45, cardioSec))
  pick('forza', scale < 0.7 ? 1 : low ? 2 : 3, req.pain, used).forEach((e) => add(e, low ? 1 : 2, 45))
  if (req.minutes >= 20) pick('mobilita', 1, req.pain, used).forEach((e) => add(e, 1, 15))
  pick('defaticamento', 1, req.pain, used).forEach((e) => add(e, 1, 0))
  const parts: string[] = []
  if (req.minutes < 20) parts.push(`hai ${req.minutes} minuti, quindi teniamo solo l'essenziale`)
  if (low) parts.push('l\'energia è bassa: meno serie e ritmo comodo')
  if (req.energy >= 4) parts.push('sei carica: alziamo un pelo')
  if (req.pain.length) parts.push(`niente esercizi che caricano ${req.pain.map((z) => z.replace('_', ' ')).join(' e ')}`)
  const reason = parts.length
    ? `Oggi ${parts.join(', ')}. Il passo svelto resta il cuore della seduta.`
    : 'Giornata normale: seguiamo il piano, con il passo svelto al centro e tre esercizi di forza.'
  return {
    ...s,
    minutes: req.minutes,
    intensity: Math.round(state.intensity * k * 10) / 10,
    title: req.pain.length ? 'Seduta su misura, gentile con il corpo' : low ? 'Seduta morbida' : s.title,
    reason: reason.charAt(0).toUpperCase() + reason.slice(1),
    items,
  }
}

function weekResp(): Week { return { weekStart: iso(monday), sessions: clone(state.sessions) } }

let onboardingStep = 0
const ONBOARDING: { reply: (name: string) => string; quick: string[] }[] = [
  { reply: (n) => `Piacere ${n}! Quanto ti muovi in una settimana normale?`, quick: ['Quasi mai', 'Cammino un po\'', 'Qualche volta'] },
  { reply: () => 'Chiaro. C\'è un obiettivo che ti piacerebbe raggiungere?', quick: ['Correre 20 minuti', 'Sentirmi più in forma', 'Fare le scale senza fiatone'] },
  { reply: () => 'Bellissimo obiettivo. Quanti giorni a settimana puoi dedicarci, senza stress?', quick: ['2 giorni', '3 giorni', '4 giorni'] },
  { reply: () => 'E quanto tempo per volta?', quick: ['10 minuti', '20 minuti', '30 minuti'] },
  { reply: () => 'C\'è qualche zona del corpo che ti dà fastidio o che vuoi tenere d\'occhio?', quick: ['Ginocchia', 'Schiena', 'Nessuna'] },
  { reply: () => 'Ultima cosa: in casa hai una sedia stabile o un muro libero?', quick: ['Sì, entrambi', 'Solo la sedia', 'Niente'] },
]

export const mockApi = {
  health: async () => { await wait(100); return { ok: true, ai: 'off' as const } },
  createUser: async () => { await wait(200); return { userId: 'u_mock' + Math.random().toString(36).slice(2, 6) } },
  onboardingMessage: async (messages: ChatMessage[]): Promise<OnboardingReply> => {
    await wait(900)
    const name = messages.find((m) => m.role === 'user')?.content.split(' ')[0] ?? 'amica'
    onboardingStep = messages.filter((m) => m.role === 'user').length - 1
    if (onboardingStep < ONBOARDING.length) {
      const s = ONBOARDING[onboardingStep]
      return { reply: s.reply(name), done: false, quickReplies: s.quick }
    }
    state.profile = { ...giulia, name }
    return { reply: `Perfetto ${name}, ho tutto. Partiamo con calma: si parte dal livello 1.`, done: true, profile: { ...giulia, name, startLevel: 1 } }
  },
  me: async (): Promise<Me> => { await wait(350); return clone(me()) },
  week: async (): Promise<Week> => { await wait(300); return weekResp() },
  session: async (id: string): Promise<Session> => {
    await wait(200)
    const s = state.sessions.find((x) => x.id === id)
    if (!s) throw new Error('Seduta non trovata')
    return clone(s)
  },
  checkin: async (id: string, req: CheckinRequest): Promise<CheckinResponse> => {
    if (req.redFlags.length) {
      await wait(400)
      const rf = RED_FLAGS.find((r) => r.id === req.redFlags[0]) ?? RED_FLAGS[0]
      const s = state.sessions.find((x) => x.id === id)
      if (s) s.status = 'blocked'
      return { status: 'blocked', redFlag: rf }
    }
    await wait(3200)
    const i = state.sessions.findIndex((x) => x.id === id)
    const s = regenerate(state.sessions[i], req)
    state.sessions[i] = s
    return { status: 'ok', session: clone(s) }
  },
  complete: async (id: string, feedback: Feedback): Promise<CompleteResponse> => {
    await wait(900)
    const s = state.sessions.find((x) => x.id === id)
    if (s) s.status = 'done'
    state.intensity = Math.min(1.3, Math.max(0.7, state.intensity + (feedback === 'facile' ? 0.1 : feedback === 'duro' ? -0.1 : 0)))
    state.intensity = Math.round(state.intensity * 10) / 10
    const bonus = s?.bonusPoints ?? 0
    state.consistency = Math.min(100, state.consistency + 6 + bonus)
    state.completed += 1
    state.minutes += s?.minutes ?? 20
    state.progress = Math.min(1, state.progress + 0.4)
    const newWins: Win[] = []
    if (!state.wins.some((w) => w.id === 'dieci_sedute') && state.completed >= 10) {
      newWins.push({ id: 'dieci_sedute', title: '10 sedute fatte', date: iso(today), icon: 'trophy' })
    }
    if (bonus > 0) newWins.push({ id: 'ripartenza_' + Date.now(), title: 'Ripartenza completata', date: iso(today), icon: 'heart' })
    if (feedback !== 'duro' && !state.wins.some((w) => w.id === 'duecento_minuti') && state.minutes >= 200) {
      newWins.push({ id: 'duecento_minuti', title: '200 minuti di movimento', date: iso(today), icon: 'clock' })
    }
    state.wins = [...newWins, ...state.wins]
    let levelUp = null
    if (state.level < 5 && state.progress >= 1 && !state.levelUpOffered) {
      state.levelUpOffered = true
      levelUp = { from: state.level, to: state.level + 1, name: PROGRAM.levels[state.level].name }
    }
    const message = feedback === 'facile' ? 'Bel lavoro. La prossima la alziamo un pelo.'
      : feedback === 'duro' ? 'Grazie per avercelo detto. La prossima sarà più leggera.'
      : 'Perfetto così. Teniamo questo ritmo.'
    return { consistency: state.consistency, intensity: state.intensity, newWins, levelUp, message }
  },
  skip: async (id: string, _reason: SkipReason): Promise<SkipResponse> => {
    await wait(1200)
    const s = state.sessions.find((x) => x.id === id)
    if (s) s.status = 'skipped'
    // la seduta di ripartenza va al primo giorno libero dopo oggi; le successive slittano di un giorno
    const after = state.sessions.filter((x) => x.status === 'planned' && x.date > (s?.date ?? iso(today)))
    after.forEach((x) => {
      const d = addDays(new Date(x.date + 'T12:00:00'), 1)
      if (d <= addDays(monday, 6)) x.date = iso(d)
    })
    const rd = addDays(new Date((s?.date ?? iso(today)) + 'T12:00:00'), 1)
    const restart: Session = {
      ...mkSession(0, 'planned', 'Seduta di ripartenza', {
        kind: 'ripartenza', bonusPoints: 10, minutes: 15, intensity: 0.8,
        reason: 'Una seduta corta e leggera per rimettere in moto il corpo. Vale 10 punti di costanza in più.',
        items: [item('marcia_sul_posto', 1, 60, 15), item('cerchi_braccia', 1, 30, 15), item('camminata_tranquilla', 1, 420, 30), item('alzate_sedia_mani', 2, 8, 45), item('respirazione_profonda', 1, 60, 0)],
      }),
      date: iso(rd),
      id: `s_${iso(rd).replaceAll('-', '')}_r`,
    }
    state.sessions = [...state.sessions.filter((x) => x.date !== restart.date || x.status !== 'planned'), restart]
      .sort((a, b) => a.date.localeCompare(b.date))
    return { message: 'Capita. Riprendiamo da qui, con calma.', week: weekResp(), restart: clone(restart) }
  },
  acceptLevel: async (): Promise<Me> => {
    await wait(500)
    state.level = Math.min(5, state.level + 1)
    state.progress = 0.05
    state.levelUpOffered = false
    state.wins = [{ id: 'livello_' + state.level, title: `Sei salita al livello ${state.level}`, date: iso(today), icon: 'stairs' }, ...state.wins]
    state.sessions.forEach((s) => { if (s.status === 'planned') s.level = state.level })
    return clone(me())
  },
  levels: async (): Promise<LevelsResponse> => { await wait(250); return { levels: clone(PROGRAM.levels), current: state.level } },
  progress: async (): Promise<Progress> => {
    await wait(400)
    const weeks = [...Array(6)].map((_, i) => iso(addDays(monday, -7 * (5 - i))))
    const vals = [20, 38, 55, 48, 66, state.consistency]
    return {
      consistencyHistory: weeks.map((w, i) => ({ week: w, value: vals[i] })),
      sessionsDone: state.completed,
      minutesTotal: state.minutes,
      wins: state.wins,
      levelHistory: [
        { n: 1, from: iso(addDays(monday, -35)), to: iso(addDays(today, -8)) },
        { n: 2, from: iso(addDays(today, -8)), to: null },
      ],
    }
  },
  habitCheckin: async () => {
    await wait(300)
    if (!state.habitCheckedToday) { state.habitDays = Math.min(7, state.habitDays + 1); state.habitCheckedToday = true }
    return { doneDays: state.habitDays }
  },
  mealPhoto: async (_b64: string, _mime: string): Promise<MealFeedback> => {
    await wait(2600)
    return {
      positives: ['Tanta verdura colorata', 'Porzione equilibrata', 'Cereali integrali: ottima scelta'],
      suggestion: 'Prova ad aggiungere una fonte di proteine, come legumi, uova o pesce.',
      habitMatch: true,
      tone: 'incoraggiante',
    }
  },
  coachMessage: async (messages: ChatMessage[]): Promise<CoachReply> => {
    await wait(1400)
    const last = (messages[messages.length - 1]?.content ?? '').toLowerCase()
    if (/petto|svenut|fiato/.test(last)) {
      return { reply: 'Grazie per avermelo detto. Con questo sintomo oggi niente allenamento.', applied: [], redFlag: RED_FLAGS[0] }
    }
    if (/spostal|sì, sposta/.test(last)) {
      return { reply: 'Fatto. Le sedute ora cadono negli spazi liberi del tuo calendario.', applied: ['Sedute spostate negli spazi liberi', 'Settimana riorganizzata'], quickReplies: ['Grazie!'], redFlag: null }
    }
    if (/dolore|male|ginocch|schiena/.test(last)) {
      state.profile = { ...state.profile, limitations: [...new Set([...state.profile.limitations, 'ginocchia' as BodyZone])] }
      return { reply: 'Capito. Per questa settimana tolgo gli esercizi che caricano le ginocchia e tengo il passo svelto. Se il dolore resta più di qualche giorno, sentilo con il medico.', applied: ['Da tenere d\'occhio: ginocchia', 'Settimana riorganizzata'], quickReplies: ['Va bene', 'È solo un fastidio leggero'], redFlag: null }
    }
    if (/tempo|lavor|impegn/.test(last)) {
      state.profile = { ...state.profile, minutesPerSession: 15 }
      return { reply: 'Nessun problema: questa settimana sedute da 15 minuti, più dense. Meglio poco che niente.', applied: ['Durata delle sedute: 15 minuti', 'Settimana riorganizzata'], quickReplies: ['Perfetto', 'Posso farne solo 2?'], redFlag: null }
    }
    return { reply: 'Ci sono. Raccontami pure: tempo, energia, dolori o obiettivi. Adatto il piano a te.', applied: [], quickReplies: ['Ho un dolore nuovo', 'Questa settimana ho poco tempo'], redFlag: null }
  },
  calendarConnect: async (icsUrl: string): Promise<CalendarConnectResponse> => {
    await wait(1600)
    if (!/^https?:\/\//.test(icsUrl) && !icsUrl.startsWith('webcal://')) throw new Error('Questo non sembra un link iCal. Controlla di averlo copiato tutto.')
    const d = (n: number) => iso(addDays(today, n))
    return {
      ok: true, eventsNext7Days: 14,
      freeSlots: [{ date: d(1), start: '07:00', end: '08:30' }, { date: d(3), start: '12:30', end: '13:30' }, { date: d(5), start: '18:30', end: '20:00' }],
      suggestion: 'Vedo spazio domani mattina, a pranzo fra tre giorni e una sera nel weekend: sposto lì le sedute?',
    }
  },
  calendarDisconnect: async () => { await wait(300); return { ok: true } },
  redFlags: async () => { await wait(150); return clone(RED_FLAGS) },
  demoReset: async () => { await wait(150); return { ok: true } },
  widget: async (_userId: string): Promise<WidgetData> => {
    await wait(200)
    const days = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
    const week = days.map((day, i) => {
      const s = state.sessions.find((x) => x.date === iso(addDays(monday, i)))
      return { day, status: (s ? (s.status === 'blocked' ? 'skipped' : s.status) : 'rest') as WidgetData['week'][number]['status'] }
    })
    const n = todaySession()
    const l = levelState()
    return {
      level: { n: l.n, name: l.name, progress: l.progress },
      levelIconUrl: `/icons/level-${l.n}.svg`,
      consistency: state.consistency,
      next: n ? { date: n.date, label: n.date === iso(today) ? 'Oggi' : 'Domani', minutes: n.minutes, title: n.title } : null,
      week,
      habit: { title: habit.title, doneDays: state.habitDays },
      lastWin: state.wins[0] ? { title: state.wins[0].title } : null,
    }
  },
}
