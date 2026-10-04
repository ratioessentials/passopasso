import crypto from 'node:crypto';
import { z } from 'zod';
import { content } from '../content.js';
import { addDays, diffDays, today, weekStart } from '../dates.js';
import { db } from '../db.js';
import { getUser, insertSession, profileOf, sessionsBetween, updateSession } from './store.js';
import type { Profile, Runner, SessionRow, UserRow } from './types.js';

/**
 * Health Bridge: ogni sorgente (Comando rapido di Apple Salute, Strava, in futuro Health Connect, Garmin…)
 * scrive nello stesso formato; il server calcola la baseline personale e la prontezza del giorno (deterministica).
 */

export const SOURCES = [
  { id: 'apple_health', name: 'Apple Salute', via: 'Comando rapido' },
  { id: 'strava', name: 'Strava', via: 'OAuth' },
  { id: 'health_connect', name: 'Google Health Connect', comingSoon: true },
  { id: 'garmin', name: 'Garmin', comingSoon: true },
  { id: 'fitbit', name: 'Fitbit', comingSoon: true },
  { id: 'oura', name: 'Oura', comingSoon: true },
] as const;

// ---------- Token personale ----------

export function healthToken(userId: string, regenerate = false): string {
  if (!regenerate) {
    const row = db.prepare('SELECT token FROM health_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 1').get(userId) as { token: string } | undefined;
    if (row) return row.token;
  }
  db.prepare('DELETE FROM health_tokens WHERE user_id = ?').run(userId);
  const token = `ht_${crypto.randomBytes(18).toString('base64url')}`;
  db.prepare('INSERT INTO health_tokens (token, user_id, created_at) VALUES (?, ?, ?)').run(token, userId, new Date().toISOString());
  return token;
}

export function userByHealthToken(token: string): UserRow | undefined {
  const row = db.prepare('SELECT user_id FROM health_tokens WHERE token = ?').get(token) as { user_id: string } | undefined;
  return row ? getUser(row.user_id) : undefined;
}

// ---------- Ingest ----------

const num = z.preprocess((v) => (v === '' || v === null ? undefined : typeof v === 'string' ? Number(v.replace(',', '.')) : v), z.number().finite().nonnegative().optional());

export const WorkoutSchema = z.object({
  type: z.string().default('other'),
  start: z.string().optional(),
  minutes: num,
  distanceKm: num,
  avgHr: num,
  id: z.string().optional(),
});

export const IngestSchema = z.object({
  source: z.string().default('apple_health'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  steps: num,
  restingHr: num,
  hrv: num,
  sleepMinutes: num,
  sleepHours: num,
  activeMinutes: num,
  workouts: z.array(WorkoutSchema).default([]),
});

const WORKOUT_KIND: [RegExp, 'run' | 'walk' | 'strength' | 'other'][] = [
  [/run|corsa|jog/i, 'run'], [/walk|hike|cammin|escurs/i, 'walk'], [/strength|weight|forza|functional|workout|core|hiit/i, 'strength'],
];
const kindOf = (type: string) => WORKOUT_KIND.find(([re]) => re.test(type))?.[1] ?? 'other';
const KIND_TITLE = { run: 'Corsa', walk: 'Camminata', strength: 'Forza', other: 'Allenamento' };

function compatible(row: SessionRow, kind: string): boolean {
  if (kind === 'run') return !!row.segments || row.run_type !== 'forza';
  if (kind === 'walk') return !row.segments || /cammin/i.test(row.title);
  if (kind === 'strength') return row.run_type === 'forza' || !row.segments;
  return false;
}

/** Un allenamento importato: completa la seduta pianificata compatibile dello stesso giorno, altrimenti attività extra. */
export function importWorkout(user: UserRow, source: string, w: z.infer<typeof WorkoutSchema>, fallbackDate: string) {
  const date = w.start?.slice(0, 10) ?? fallbackDate;
  const minutes = Math.round(w.minutes ?? 0);
  if (minutes < 5) return null;
  const kind = kindOf(w.type);
  const externalId = w.id ?? `${source}:${w.start ?? date}:${w.type}`;
  const seen = db.prepare('SELECT session_id FROM health_workouts WHERE user_id = ? AND source = ? AND external_id = ?').get(user.id, source, externalId);
  if (seen) return null;
  const planned = sessionsBetween(user.id, date, date).find((s) => s.status === 'planned' && compatible(s, kind));
  let id: string;
  const km = w.distanceKm ? Math.round(w.distanceKm * 10) / 10 : null;
  const label = `${KIND_TITLE[kind]}${km ? ` ${String(km).replace('.', ',')} km` : ''}`;
  if (planned) {
    updateSession(planned.id, { status: 'done', kind: 'importata', origin: source, external_id: externalId, was_planned: 1, done_at: w.start ?? `${date}T12:00:00.000Z`, title: `${planned.title} · ${label}` });
    id = planned.id;
  } else {
    id = insertSession(user.id, {
      date, level: user.level, status: 'done', kind: 'importata', minutes, intensity: user.intensity,
      title: label, reason: `Importata da ${SOURCES.find((s) => s.id === source)?.name ?? source}.`,
      items: [], source: 'rules', origin: source, external_id: externalId, done_at: w.start ?? `${date}T12:00:00.000Z`,
    });
  }
  db.prepare('INSERT INTO health_workouts (user_id, source, external_id, date, type, minutes, distance_km, avg_hr, session_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(user.id, source, externalId, date, kind, minutes, km, w.avgHr ?? null, id);
  return id;
}

/** I km reali delle ultime 4 settimane aggiornano runner.kmPerWeek. */
export function updateRunnerKm(user: UserRow) {
  const profile = profileOf(user);
  if (!profile) return;
  const row = db.prepare("SELECT SUM(distance_km) AS km, COUNT(*) AS n, MIN(date) AS first FROM health_workouts WHERE user_id = ? AND type = 'run' AND distance_km IS NOT NULL AND date >= ?").get(user.id, addDays(today(), -27)) as { km: number | null; n: number; first: string | null };
  if (!row.n || !row.km || !row.first) return;
  // media sulle settimane con dati (al massimo 4)
  const weeks = Math.min(4, Math.max(1, Math.ceil((diffDays(today(), row.first) + 1) / 7)));
  const kmPerWeek = Math.round((row.km / weeks) * 10) / 10;
  const runner: Runner = profile.runner ?? { kmPerWeek, longestRunMin: 30, easyPaceMinKm: null, runGoal: profile.goal };
  if (runner.kmPerWeek === kmPerWeek) return;
  db.prepare('UPDATE users SET profile = ? WHERE id = ?').run(JSON.stringify({ ...profile, runner: { ...runner, kmPerWeek } } satisfies Profile), user.id);
}

export function touchSource(userId: string, source: string, data?: unknown) {
  db.prepare(`INSERT INTO health_sources (user_id, source, last_sync, data) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, source) DO UPDATE SET last_sync = excluded.last_sync, data = COALESCE(excluded.data, health_sources.data)`)
    .run(userId, source, new Date().toISOString(), data === undefined ? null : JSON.stringify(data));
}

export function ingest(user: UserRow, body: z.infer<typeof IngestSchema>) {
  const date = body.date ?? today();
  const sleep = body.sleepMinutes ?? (body.sleepHours !== undefined ? body.sleepHours * 60 : undefined);
  const r = (x?: number) => (x === undefined ? null : Math.round(x * 10) / 10);
  // upsert per sorgente+data: i campi inviati sovrascrivono, gli altri restano
  db.prepare(`INSERT INTO health_days (user_id, source, date, steps, resting_hr, hrv, sleep_minutes, active_minutes, updated_at)
    VALUES (@u, @s, @d, @steps, @rhr, @hrv, @sleep, @active, @now)
    ON CONFLICT(user_id, source, date) DO UPDATE SET
      steps = COALESCE(excluded.steps, steps), resting_hr = COALESCE(excluded.resting_hr, resting_hr), hrv = COALESCE(excluded.hrv, hrv),
      sleep_minutes = COALESCE(excluded.sleep_minutes, sleep_minutes), active_minutes = COALESCE(excluded.active_minutes, active_minutes), updated_at = excluded.updated_at`)
    .run({ u: user.id, s: body.source, d: date, steps: body.steps === undefined ? null : Math.round(body.steps), rhr: r(body.restingHr), hrv: r(body.hrv), sleep: sleep === undefined ? null : Math.round(sleep), active: body.activeMinutes === undefined ? null : Math.round(body.activeMinutes), now: new Date().toISOString() });
  let imported = 0;
  for (const w of body.workouts) if (importWorkout(user, body.source, w, date)) imported++;
  if (imported) updateRunnerKm(getUser(user.id)!);
  touchSource(user.id, body.source);
  return { imported };
}

// ---------- Prontezza del giorno ----------

export interface DayMetrics { steps: number | null; restingHr: number | null; hrv: number | null; sleepMinutes: number | null }

/** Un giorno, unendo le sorgenti (la prima che ha il dato vince: Apple Salute, poi le altre). */
export function dayMetrics(userId: string, date: string): DayMetrics | null {
  const rows = db.prepare("SELECT * FROM health_days WHERE user_id = ? AND date = ? ORDER BY CASE source WHEN 'apple_health' THEN 0 ELSE 1 END").all(userId, date) as { steps: number | null; resting_hr: number | null; hrv: number | null; sleep_minutes: number | null }[];
  if (!rows.length) return null;
  const pick = <K extends keyof typeof rows[0]>(k: K) => rows.find((r) => r[k] !== null)?.[k] ?? null;
  return { steps: pick('steps'), restingHr: pick('resting_hr'), hrv: pick('hrv'), sleepMinutes: pick('sleep_minutes') };
}

export function baseline(userId: string, date: string, days = 14) {
  const vals: DayMetrics[] = [];
  for (let i = 1; i <= days; i++) { const m = dayMetrics(userId, addDays(date, -i)); if (m) vals.push(m); }
  const avg = (k: keyof DayMetrics) => { const xs = vals.map((v) => v[k]).filter((x): x is number => x !== null); return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null; };
  return { days: vals.length, restingHr: avg('restingHr'), hrv: avg('hrv'), sleepMinutes: avg('sleepMinutes'), steps: avg('steps') };
}

type ReadinessCfg = {
  baseline: { days: number; minDays: number };
  signals: { id: string; metric: keyof DayMetrics; rule: 'below' | 'aboveBaselinePct' | 'belowBaselinePct'; value: number; penalty: number; text: string; textNoBaseline?: string }[];
  score: { start: number; min: number };
  levels: { id: string; minScore: number; suggestion: string }[];
  energyBySignals: Record<string, number>;
  restAdvised: { consecutiveDays: number; minSignals: number; text: string; medicalText?: string };
  activeDay?: { minSteps: number; maxLevel: number; maxPerWeek: number; text: string };
  noData?: string;
};
const cfg = () => content.readiness() as unknown as ReadinessCfg;
const hours = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, '0')}`;

function signalsFor(userId: string, date: string) {
  const c = cfg();
  const m = dayMetrics(userId, date);
  if (!m) return null;
  const b = baseline(userId, date, c.baseline.days);
  const relOk = b.days >= c.baseline.minDays;
  const active: { id: string; text: string; penalty: number }[] = [];
  for (const s of c.signals) {
    const v = m[s.metric];
    if (v === null) continue;
    if (s.rule === 'below' && v < s.value) {
      active.push({ id: s.id, penalty: s.penalty, text: (relOk && b[s.metric] !== null ? s.text : s.textNoBaseline ?? s.text).replace('{hours}', hours(v)) });
    } else if (relOk && b[s.metric]) {
      const pct = ((v - (b[s.metric] as number)) / (b[s.metric] as number)) * 100;
      if (s.rule === 'aboveBaselinePct' && pct > s.value) active.push({ id: s.id, penalty: s.penalty, text: s.text.replace('{pct}', String(Math.round(pct))) });
      if (s.rule === 'belowBaselinePct' && -pct > s.value) active.push({ id: s.id, penalty: s.penalty, text: s.text.replace('{pct}', String(Math.round(-pct))) });
    }
  }
  return { metrics: m, baseline: b, active };
}

export interface Readiness { score: number; level: string; signals: string[]; suggestion: string; suggestedEnergy: number; restAdvised: boolean; restText?: string; medicalText?: string; date: string }

export function readiness(userId: string, date = today()): Readiness | null {
  const c = cfg();
  const s = signalsFor(userId, date);
  if (!s) return null;
  const score = Math.max(c.score.min, c.score.start - s.active.reduce((a, x) => a + x.penalty, 0));
  const level = [...c.levels].sort((a, b) => b.minScore - a.minScore).find((l) => score >= l.minScore) ?? c.levels[c.levels.length - 1];
  const n = Math.min(s.active.length, Math.max(...Object.keys(c.energyBySignals).map(Number)));
  let rest = true;
  for (let i = 0; i < c.restAdvised.consecutiveDays; i++) {
    const d = signalsFor(userId, addDays(date, -i));
    if (!d || d.active.length < c.restAdvised.minSignals) { rest = false; break; }
  }
  return {
    date, score, level: level.id, signals: s.active.map((x) => x.text),
    suggestion: rest ? c.restAdvised.text : level.suggestion,
    suggestedEnergy: c.energyBySignals[String(n)] ?? 3,
    restAdvised: rest,
    ...(rest ? { restText: c.restAdvised.text, medicalText: c.restAdvised.medicalText } : {}),
  };
}

/** Giorni attivi dai passi (livelli 1-2, senza seduta quel giorno, max N a settimana): contano per la costanza. */
export function activeDays(user: UserRow, from: string, to: string): string[] {
  const a = cfg().activeDay;
  if (!a || user.level > a.maxLevel) return [];
  const rows = db.prepare('SELECT date, MAX(steps) AS steps FROM health_days WHERE user_id = ? AND date >= ? AND date <= ? GROUP BY date').all(user.id, from, to) as { date: string; steps: number | null }[];
  const busy = new Set(sessionsBetween(user.id, from, to).filter((s) => s.status === 'done').map((s) => s.date));
  const perWeek = new Map<string, number>();
  const out: string[] = [];
  for (const r of rows) {
    if ((r.steps ?? 0) < a.minSteps || busy.has(r.date)) continue;
    const w = weekStart(r.date);
    if ((perWeek.get(w) ?? 0) >= a.maxPerWeek) continue;
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
    out.push(r.date);
  }
  return out;
}

export function summary(user: UserRow) {
  const t = today();
  const src = new Map((db.prepare('SELECT source, last_sync, data FROM health_sources WHERE user_id = ?').all(user.id) as { source: string; last_sync: string | null; data: string | null }[]).map((r) => [r.source, r]));
  const sources = SOURCES.map((s) => {
    const row = src.get(s.id);
    return { id: s.id, name: s.name, connected: !!row, lastSync: row?.last_sync ?? null, ...('comingSoon' in s ? { comingSoon: true } : {}), ...('via' in s ? { via: s.via } : {}) };
  });
  const m = dayMetrics(user.id, t);
  const b = baseline(user.id, t);
  const history = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(t, -i);
    const x = dayMetrics(user.id, d);
    history.push({ date: d, sleepMinutes: x?.sleepMinutes ?? null, restingHr: x?.restingHr ?? null, hrv: x?.hrv ?? null, steps: x?.steps ?? null });
  }
  const r = readiness(user.id, t);
  const workouts = db.prepare('SELECT date, source, type, minutes, distance_km AS distanceKm FROM health_workouts WHERE user_id = ? ORDER BY date DESC LIMIT 10').all(user.id);
  return {
    sources,
    today: m,
    baseline: { restingHr: b.restingHr, hrv: b.hrv, sleepMinutes: b.sleepMinutes, days: b.days },
    readiness: r,
    noData: r ? null : cfg().noData ?? 'Nessun dato di oggi: il check-in lo fai tu, come sempre.',
    history,
    workouts,
    sourcesInfo: (content.readiness() as { sources?: unknown }).sources ?? [],
  };
}

/** Per i prompt: una riga sui segnali di oggi. */
export function readinessLine(userId: string): string | null {
  const r = readiness(userId);
  if (!r) return null;
  return `PRONTEZZA DI OGGI (dai dati del corpo): ${r.level} (${r.score}/100)${r.signals.length ? `, segnali: ${r.signals.join('; ')}` : ', nessun segnale'}${r.restAdvised ? '. Riposo consigliato da 3 giorni di segnali' : ''}.`;
}

