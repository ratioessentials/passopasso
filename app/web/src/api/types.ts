// Tipi condivisi: vedi docs/schema.md e docs/api.md

export type BodyZone =
  | 'collo' | 'spalle' | 'schiena_alta' | 'schiena_bassa' | 'petto'
  | 'braccia' | 'polsi' | 'anche' | 'ginocchia' | 'caviglie'

export type Category = 'riscaldamento' | 'cardio' | 'forza' | 'mobilita' | 'defaticamento'
export type Equipment = 'sedia' | 'muro' | 'tappetino' | 'scalino' | 'elastico' | 'manubri'

export interface Exercise {
  id: string
  name: string
  category: Category
  minLevel: number
  zones: BodyZone[]
  equipment: Equipment[]
  prescription: { type: 'reps' | 'seconds'; default: number }
  instructions: string[]
  commonMistakes: string[]
  regression: string | null
  progression: string | null
  formCheck: boolean
  impact?: boolean
  motion?: MotionArchetype | null
}

export type MotionArchetype =
  | 'marcia' | 'camminata_veloce' | 'corsetta' | 'corsa' | 'scatto' | 'squat' | 'affondo' | 'ponte' | 'plank'
  | 'flessioni_muro' | 'polpacci' | 'rotazioni_braccia' | 'rotazioni_anche' | 'allungamento' | 'respirazione'
  | 'jumping_jack' | 'step'

export interface SessionTemplate {
  minutes: number
  blocks: { category: Category; count: number; seconds?: number }[]
}

export interface Level {
  n: number
  name: string
  verb: string
  goal: string
  weeks: [number, number]
  sessionsPerWeek: number
  sessionTemplate?: SessionTemplate
  readiness?: { minSessions: number; minConsistency: number; maxHardFeedbackLast3: number }
}

export type SessionStatus = 'planned' | 'done' | 'skipped' | 'blocked'
export type SessionKind = 'normale' | 'ripartenza' | 'importata' | 'ridotta'

export interface Segment {
  label: string
  minutes: number
  motion?: MotionArchetype | null
  rpe?: number
  repeat?: number
  recovery?: Segment
}

export interface SessionItem {
  exerciseId: string
  exercise: Exercise
  sets: number
  reps?: number
  seconds?: number
  restSec: number
  note?: string
}

export interface Session {
  id: string
  date: string
  status: SessionStatus
  kind: SessionKind
  level: number
  minutes: number
  intensity: number
  title: string
  reason?: string
  items: SessionItem[]
  bonusPoints: number
  segments?: Segment[] | null
  source?: string | null
}

export interface Habit {
  id: string
  week: number
  title: string
  why: string
  tips: string[]
  photoPrompt?: string
}

export interface RedFlag {
  id: string
  label: string
  message: string
  urgent: boolean
}

export interface Win {
  id: string
  title: string
  date: string
  icon: string
}

export type Sex = 'f' | 'm' | 'altro' | 'non_dico'
export type Job = 'seduto' | 'in_piedi' | 'fisico'
export type Track = 'corsa' | 'forza' | 'mobilita'

export interface HealthScreening {
  heartCondition: boolean
  chestPain: boolean
  dizziness: boolean
  jointIssue: boolean
  medication: boolean
  pregnancy: boolean
  otherCondition: boolean
  notes: string
}

/** La scheda compilata prima della conversazione (chi sei + salute) */
export interface PersonCard {
  name: string
  age: number
  sex: Sex
  heightCm: number
  weightKg: number
  job: Job
  sleepHours: number
  health: HealthScreening
}

export interface FoodProfile {
  breakfast: boolean
  veggiesPerDay: number
  sugaryDrinks: string
  mealsOut: number
  cooks: string
}

export interface Profile extends Partial<PersonCard> {
  name: string
  goal: string
  experience: 'nessuna' | 'poca' | 'qualche_volta'
  daysPerWeek: number
  minutesPerSession: number
  equipment: Equipment[]
  limitations: BodyZone[]
  preferredTime: 'mattina' | 'pausa_pranzo' | 'sera'
  startLevel: number
  calendarUrl?: string | null
  why?: string | null
  track?: Track
  runner?: { kmPerWeek: number; longestRunMin: number; easyPaceMinKm: number | null; runGoal: string } | null
  food?: FoodProfile | null
  caution?: boolean
}

export interface ChatMessage { role: 'assistant' | 'user'; content: string }

export interface OnboardingReply {
  reply: string
  done: boolean
  minor?: boolean
  askWhy?: boolean
  quickReplies?: string[]
  profile?: Profile
}

export interface LevelState { n: number; name: string; verb: string; progress: number; ready: boolean }

export interface Me {
  profile: Profile
  level: LevelState
  consistency: number
  intensity: number
  today: Session | null
  habit: (Habit & { doneDays: number }) | null
  wins: Win[]
}

export interface Week { weekStart: string; sessions: Session[] }

export interface CheckinRequest { minutes: number; energy: number; pain: BodyZone[]; redFlags: string[] }
export type CheckinResponse =
  | { status: 'ok'; session: Session }
  | { status: 'blocked'; redFlag: RedFlag }

export type Feedback = 'facile' | 'giusto' | 'duro'
export interface LevelUp { from: number; to: number; name: string; /** true: test già superato, si passa subito alla celebrazione */ auto?: boolean }
export interface CompleteResponse {
  consistency: number
  intensity: number
  newWins: Win[]
  levelUp: LevelUp | null
  message: string
  testRequired?: boolean
  afterFood?: string
}

export type SkipReason = 'tempo' | 'stanchezza' | 'malessere' | 'altro'
export interface SkipResponse { message: string; week: Week; restart: Session }

export interface LevelsResponse { levels: Level[]; current: number }

export interface Progress {
  consistencyHistory: { week: string; value: number }[]
  sessionsDone: number
  minutesTotal: number
  wins: Win[]
  levelHistory: { n: number; from: string; to: string | null }[]
}

export interface MealFeedback {
  positives: string[]
  suggestion: string
  habitMatch: boolean
  tone: string
  plate?: Plate | null
}

export type DayStatus = 'done' | 'skipped' | 'planned' | 'rest'
export interface WidgetData {
  level: { n: number; name: string; progress: number }
  levelIconUrl: string
  consistency: number
  next: { date: string; label: string; minutes: number; title: string } | null
  week: { day: string; status: DayStatus }[]
  habit: { title: string; doneDays: number } | null
  lastWin: { title: string } | null
}

export interface CoachReply {
  reply: string
  quickReplies?: string[]
  applied: string[]
  redFlag: RedFlag | null
}

export interface FreeSlot { date: string; start: string; end: string }
export interface CalendarConnectResponse {
  ok: boolean
  eventsNext7Days: number
  freeSlots: FreeSlot[]
  suggestion: string
}

export interface ProfileCardResponse { ok: boolean; caution: boolean; cautionMessage: string | null }

export interface FoodToday {
  habit: Habit | null
  doneDays: number
  training: null | { sessionAt: string; before: string; after: string }
}
export interface FoodProfileResponse { habit: Habit; why: string }
export interface Plate { veggies: number; protein: number; grains: number }
export interface FoodRecap { photos: number; strengths: string[]; gaps: string[]; nextHabit: Habit | null; why: string }

export interface ReadinessTest { id: string; title: string; instructions: string[]; unit: string; target: number; durationSec?: number; measures?: string }
export interface LevelTestResult { passed: boolean; message: string; levelUp: LevelUp | null }

export interface ScienceItem { id: string; claim: string; source: string; url: string; inApp: string }

export interface Readiness {
  score: number
  level: 'alta' | 'media' | 'bassa' | string
  signals: string[]
  suggestion: string
  suggestedEnergy: number
  restAdvised: boolean
}
export interface HealthSource { id: string; name?: string; connected: boolean; lastSync?: string | null; comingSoon?: boolean }
export interface HealthMetrics { steps?: number; restingHr?: number; hrv?: number; sleepMinutes?: number }
export interface HealthSummary {
  sources: HealthSource[]
  today: HealthMetrics | null
  baseline: HealthMetrics | null
  readiness: Readiness | null
  history?: ({ date: string } & HealthMetrics)[]
}

export interface Plan { id: string; name: string; price?: string; features: string[]; limits?: string[] }
export interface PlansResponse { plans: Plan[]; promises: string[]; demo: boolean }

export interface ApiErrorBody { error: { code: string; message: string } }
