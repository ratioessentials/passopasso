// Tipi condivisi: vedi docs/schema.md e docs/api.md

export type BodyZone =
  | 'collo' | 'spalle' | 'schiena_alta' | 'schiena_bassa' | 'petto'
  | 'braccia' | 'polsi' | 'anche' | 'ginocchia' | 'caviglie'

export type Category = 'riscaldamento' | 'cardio' | 'forza' | 'mobilita' | 'defaticamento'
export type Equipment = 'sedia' | 'muro' | 'tappetino' | 'scalino'

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
}

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
export type SessionKind = 'normale' | 'ripartenza'

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

export interface Profile {
  name: string
  age?: number
  goal: string
  experience: 'nessuna' | 'poca' | 'qualche_volta'
  daysPerWeek: number
  minutesPerSession: number
  equipment: Equipment[]
  limitations: BodyZone[]
  preferredTime: 'mattina' | 'pausa_pranzo' | 'sera'
  startLevel: number
}

export interface ChatMessage { role: 'assistant' | 'user'; content: string }

export interface OnboardingReply {
  reply: string
  done: boolean
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
export interface LevelUp { from: number; to: number; name: string }
export interface CompleteResponse {
  consistency: number
  intensity: number
  newWins: Win[]
  levelUp: LevelUp | null
  message: string
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

export interface ApiErrorBody { error: { code: string; message: string } }
