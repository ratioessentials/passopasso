import type {
  CalendarConnectResponse, ChatMessage, CheckinRequest, CoachReply, CheckinResponse, CompleteResponse, Feedback, Level, LevelsResponse,
  MealFeedback, Me, OnboardingReply, Progress, RedFlag, Session, SkipReason, SkipResponse, Week, WidgetData,
} from './types'
import { mockApi } from './mock'

export const USE_MOCK = import.meta.env.VITE_MOCK === '1'
const USER_KEY = 'passopasso.userId'

export function getUserId(): string | null {
  try { return localStorage.getItem(USER_KEY) } catch { return null }
}
export function setUserId(id: string | null) {
  try {
    if (id) localStorage.setItem(USER_KEY, id)
    else localStorage.removeItem(USER_KEY)
  } catch { /* storage non disponibile */ }
}

export class ApiError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
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

function normalizeLevels(raw: unknown): LevelsResponse {
  if (Array.isArray(raw)) {
    const current = (raw as unknown as { current?: number }).current ?? 1
    return { levels: raw as Level[], current }
  }
  const obj = raw as { levels?: Level[]; current?: number }
  return { levels: obj.levels ?? [], current: obj.current ?? 1 }
}

const realApi = {
  health: () => request<{ ok: boolean; ai: 'sdk' | 'cli' | 'off' }>('GET', '/health'),
  createUser: () => request<{ userId: string }>('POST', '/users'),
  onboardingMessage: (messages: ChatMessage[]) => request<OnboardingReply>('POST', '/onboarding/message', { messages }),
  me: () => request<Me>('GET', '/me'),
  week: () => request<Week>('GET', '/week'),
  session: (id: string) => request<Session>('GET', `/sessions/${encodeURIComponent(id)}`),
  checkin: (id: string, body: CheckinRequest) => request<CheckinResponse>('POST', `/sessions/${encodeURIComponent(id)}/checkin`, body),
  complete: (id: string, feedback: Feedback) => request<CompleteResponse>('POST', `/sessions/${encodeURIComponent(id)}/complete`, { feedback }),
  skip: (id: string, reason: SkipReason) => request<SkipResponse>('POST', `/sessions/${encodeURIComponent(id)}/skip`, { reason }),
  acceptLevel: () => request<Me>('POST', '/level/accept'),
  levels: async () => normalizeLevels(await request<unknown>('GET', '/levels')),
  progress: () => request<Progress>('GET', '/progress'),
  habitCheckin: () => request<{ doneDays: number }>('POST', '/habit/checkin'),
  mealPhoto: (imageBase64: string, mimeType: string) => request<MealFeedback>('POST', '/meals/photo', { imageBase64, mimeType }),
  coachMessage: (messages: ChatMessage[]) => request<CoachReply>('POST', '/coach/message', { messages: messages.slice(-20) }),
  calendarConnect: (icsUrl: string) => request<CalendarConnectResponse>('POST', '/calendar/connect', { icsUrl }),
  calendarDisconnect: () => request<unknown>('DELETE', '/calendar'),
  redFlags: () => request<RedFlag[]>('GET', '/red-flags'),
  demoReset: () => request<unknown>('POST', '/demo/reset'),
  widget: (userId: string) => request<WidgetData>('GET', `/widget/${encodeURIComponent(userId)}`),
}

export type Api = typeof realApi
export const api: Api = USE_MOCK ? mockApi : realApi
