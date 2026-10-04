import crypto from 'node:crypto';
import { content, type Habit, type WinDef } from '../content.js';
import { db } from '../db.js';
import { addDays, diffDays, today, weekday, weekStart } from '../dates.js';
import { buildRuleItems, ruleReason, ruleTitle } from './builder.js';
import type { DraftSession, Item, Profile, Session, SessionRow, UserRow } from './types.js';

export const rid = (prefix: string, n = 6) => `${prefix}_${crypto.randomBytes(8).toString('base64url').replace(/[-_]/g, '').slice(0, n).toLowerCase()}`;

// ---------- Utenti ----------

export function getUser(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}
export function createUser(id = rid('u')): UserRow {
  db.prepare('INSERT INTO users (id, created_at) VALUES (?, ?)').run(id, new Date().toISOString());
  return getUser(id)!;
}
export const profileOf = (u: UserRow) => (u.profile ? (JSON.parse(u.profile) as Profile) : null);

// ---------- Sedute ----------

export function sessionId(date: string) {
  return `s_${date.replaceAll('-', '')}_${rid('x', 4).slice(2)}`;
}

export function getSessionRow(userId: string, id: string): SessionRow | undefined {
  return db.prepare('SELECT * FROM sessions WHERE id = ? AND user_id = ?').get(id, userId) as SessionRow | undefined;
}
export function sessionsBetween(userId: string, from: string, to: string): SessionRow[] {
  return db.prepare('SELECT * FROM sessions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, rowid').all(userId, from, to) as SessionRow[];
}
export function allSessions(userId: string): SessionRow[] {
  return db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY date, rowid').all(userId) as SessionRow[];
}

export function insertSession(userId: string, s: Partial<Omit<SessionRow, 'items'>> & { date: string; level: number } & DraftSession): string {
  const id = s.id ?? sessionId(s.date);
  db.prepare(`INSERT INTO sessions (id, user_id, date, status, kind, level, minutes, intensity, title, reason, items, bonus_points, feedback, skip_reason, recovers, source, checkin, done_at)
    VALUES (@id, @user_id, @date, @status, @kind, @level, @minutes, @intensity, @title, @reason, @items, @bonus_points, @feedback, @skip_reason, @recovers, @source, @checkin, @done_at)`).run({
    id, user_id: userId, date: s.date, status: s.status ?? 'planned', kind: s.kind ?? 'normale', level: s.level,
    minutes: s.minutes, intensity: s.intensity, title: s.title, reason: s.reason, items: JSON.stringify(s.items),
    bonus_points: s.bonus_points ?? 0, feedback: s.feedback ?? null, skip_reason: s.skip_reason ?? null, recovers: s.recovers ?? null,
    source: s.source, checkin: s.checkin ?? null, done_at: s.done_at ?? null,
  });
  return id;
}

export function updateSession(id: string, fields: Partial<Record<keyof SessionRow, unknown>>) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const vals = keys.map((k) => { const v = (fields as Record<string, unknown>)[k]; return k === 'items' && typeof v !== 'string' ? JSON.stringify(v) : v; });
  db.prepare(`UPDATE sessions SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`).run(...vals, id);
}

/** Seduta pianificata a regole (nessuna chiamata all'AI: il check-in la rigenera). */
export function ruleDraft(user: UserRow, profile: Profile, date: string, opts: { level?: number; restart?: boolean } = {}): DraftSession & { bonus_points: number; kind: 'normale' | 'ripartenza' } {
  const level = opts.level ?? user.level;
  const lvl = content.level(level);
  if (opts.restart) {
    const r = content.program().restartSession;
    const intensity = Math.min(r.intensity ?? 0.8, user.intensity);
    return {
      kind: 'ripartenza', bonus_points: r.bonusPoints ?? 10, source: 'rules',
      minutes: r.sessionTemplate.minutes, intensity,
      title: r.title ?? 'Seduta di ripartenza',
      reason: `Più corta e leggera, per rimetterti in moto senza strafare. Completala e guadagni +${r.bonusPoints ?? 10} punti di costanza.`,
      items: buildRuleItems({ level, template: r.sessionTemplate, minutes: r.sessionTemplate.minutes, intensity, profile, seed: date, easy: true }),
    };
  }
  const minutes = Math.round(Math.min(Math.max(profile.minutesPerSession || lvl.sessionTemplate.minutes, 10), lvl.sessionTemplate.minutes * 1.5));
  return {
    kind: 'normale', bonus_points: 0, source: 'rules', minutes, intensity: user.intensity,
    title: ruleTitle(level),
    reason: ruleReason({ level, minutes, templateMinutes: lvl.sessionTemplate.minutes }),
    items: buildRuleItems({ level, template: lvl.sessionTemplate, minutes, intensity: user.intensity, profile, seed: date }),
  };
}

/** Riga del DB → Session dell'API, con l'esercizio completo. Se il catalogo è cambiato, ricostruisce le sedute ancora da fare. */
export function toSession(row: SessionRow, user?: UserRow): Session {
  let items = JSON.parse(row.items) as Item[];
  const known = items.filter((i) => content.exercise(i.exerciseId));
  if (known.length < items.length && row.status === 'planned' && user) {
    const profile = profileOf(user);
    if (profile) {
      const d = ruleDraft(user, profile, row.date, { level: row.level, restart: row.kind === 'ripartenza' });
      updateSession(row.id, { items: d.items });
      items = d.items;
    }
  } else {
    items = known;
  }
  return {
    id: row.id, date: row.date, status: row.status, kind: row.kind, level: row.level, minutes: row.minutes,
    intensity: row.intensity, title: row.title, reason: row.reason,
    items: items.filter((i) => content.exercise(i.exerciseId)).map((i) => ({ ...i, exercise: content.exercise(i.exerciseId)! })),
    bonusPoints: row.bonus_points, feedback: row.feedback, source: row.source,
  };
}

// ---------- Pianificazione della settimana ----------

const PATTERNS: Record<number, number[]> = { 1: [2], 2: [1, 4], 3: [0, 2, 4], 4: [0, 1, 3, 5], 5: [0, 1, 2, 4, 5], 6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6] };

export function sessionsPerWeek(user: UserRow, profile: Profile) {
  const lvl = content.level(user.level);
  return Math.max(2, Math.min(profile.daysPerWeek || lvl.sessionsPerWeek, lvl.sessionsPerWeek));
}

/** Pianifica i giorni della settimana a partire da `from` (incluso), senza toccare quelli che hanno già una seduta. */
export function planWeek(user: UserRow, profile: Profile, ws: string, from: string, opts: { includeFrom?: boolean } = {}) {
  const count = sessionsPerWeek(user, profile);
  const existing = sessionsBetween(user.id, ws, addDays(ws, 6));
  const busy = new Set(existing.map((s) => s.date));
  let days = PATTERNS[count].map((d) => addDays(ws, d)).filter((d) => d >= from);
  if (opts.includeFrom && !days.includes(from)) days = [from, ...days];
  const needed = Math.max(0, count - existing.filter((s) => s.kind === 'normale').length);
  days = days.filter((d) => !busy.has(d)).slice(0, needed);
  db.transaction(() => {
    for (const date of days) {
      const d = ruleDraft(user, profile, date);
      insertSession(user.id, { date, level: user.level, ...d });
    }
    db.prepare('INSERT OR IGNORE INTO planned_weeks (user_id, week_start) VALUES (?, ?)').run(user.id, ws);
  })();
}

export function ensureCurrentWeek(user: UserRow) {
  const profile = profileOf(user);
  if (!profile) return;
  const ws = weekStart(today());
  const done = db.prepare('SELECT 1 FROM planned_weeks WHERE user_id = ? AND week_start = ?').get(user.id, ws);
  if (!done) planWeek(user, profile, ws, today());
}

// ---------- Costanza (regola 7) ----------

export function consistencyAt(userId: string, at = today()): number {
  const from = addDays(at, -27);
  const rows = sessionsBetween(userId, from, at);
  const all = allSessions(userId);
  const recovered = new Set(all.filter((s) => s.kind === 'ripartenza' && s.status === 'done' && s.recovers).map((s) => s.recovers));
  // conta: sedute normali già passate (o fatte), escluse quelle saltate e recuperate e quelle bloccate per sicurezza
  const counted = rows.filter((s) => s.kind === 'normale' && s.status !== 'blocked' && !recovered.has(s.id) && (s.date < at || s.status === 'done'));
  const done = counted.filter((s) => s.status === 'done').length;
  const restartsDone = rows.filter((s) => s.kind === 'ripartenza' && s.status === 'done');
  const bonus = restartsDone.reduce((a, s) => a + s.bonus_points, 0);
  const restartDoneCount = restartsDone.length;
  const planned = counted.length;
  if (!planned && !restartDoneCount) return 0;
  const base = planned ? (done / planned) * 100 : 100;
  return Math.max(0, Math.min(100, Math.round(base + bonus)));
}

// ---------- Livello e prontezza ----------

export function levelInfo(user: UserRow) {
  const lvl = content.level(user.level);
  const maxLevel = Math.max(...content.program().levels.map((l) => l.n));
  const consistency = consistencyAt(user.id);
  const since = user.level_since ?? '0000-00-00';
  const done = allSessions(user.id).filter((s) => s.status === 'done' && s.level === user.level && s.date >= since);
  const last3 = allSessions(user.id).filter((s) => s.status === 'done').slice(-3);
  const hard = last3.filter((s) => s.feedback === 'duro').length;
  const r = lvl.readiness;
  const ready = !!r && user.level < maxLevel && done.length >= r.minSessions && consistency >= r.minConsistency && hard <= r.maxHardFeedbackLast3;
  const progress = r ? Math.min(1, 0.7 * Math.min(1, done.length / r.minSessions) + 0.3 * Math.min(1, consistency / Math.max(1, r.minConsistency))) : 1;
  return { n: lvl.n, name: lvl.name, verb: lvl.verb, progress: Math.round(progress * 100) / 100, ready, consistency, maxLevel };
}

// ---------- Abitudini ----------

export function currentHabit(user: UserRow): Habit {
  const habits = [...content.habits()].sort((a, b) => a.week - b.week);
  const start = weekStart(user.start_date ?? today());
  const week = Math.floor(diffDays(weekStart(today()), start) / 7) + 1;
  return habits.find((h) => h.week === Math.min(week, habits.length)) ?? habits[Math.min(week, habits.length) - 1] ?? habits[0];
}

export function habitDoneDays(userId: string): number {
  const ws = weekStart(today());
  return (db.prepare('SELECT COUNT(*) AS n FROM habit_checkins WHERE user_id = ? AND date >= ? AND date <= ?').get(userId, ws, addDays(ws, 6)) as { n: number }).n;
}

// ---------- Vittorie ----------

export interface Win { id: string; title: string; date: string; icon: string }

function ruleOf(def: WinDef): { type: string; value?: number } | null {
  for (const k of ['rule', 'check', 'when', 'trigger', 'condition']) {
    const v = def[k];
    if (v && typeof v === 'object' && typeof (v as { type?: unknown }).type === 'string') return v as { type: string; value?: number };
  }
  return null;
}

export function listWins(userId: string): Win[] {
  const defs = new Map(content.wins().map((w) => [w.id, w]));
  const rows = db.prepare('SELECT win_id, date FROM wins WHERE user_id = ? ORDER BY date DESC, rowid DESC').all(userId) as { win_id: string; date: string }[];
  return rows.filter((r) => defs.has(r.win_id)).map((r) => {
    const d = defs.get(r.win_id)!;
    return { id: d.id, title: d.title, date: r.date, icon: typeof d.icon === 'string' ? d.icon : 'star' };
  });
}

/** Valuta le vittorie di content/wins.json e assegna quelle nuove. */
export function evaluateWins(user: UserRow, at = today()): Win[] {
  const sessions = allSessions(user.id).filter((s) => s.date <= at);
  const done = sessions.filter((s) => s.status === 'done');
  const habitWeeks = db.prepare(`SELECT COUNT(*) AS n FROM habit_checkins WHERE user_id = ? AND date <= ? GROUP BY strftime('%Y-%W', date)`).all(user.id, at) as { n: number }[];
  const meals = (db.prepare('SELECT COUNT(*) AS n FROM meals WHERE user_id = ?').get(user.id) as { n: number }).n;
  const weeks = new Map<string, { planned: number; done: number }>();
  for (const s of sessions.filter((x) => x.kind === 'normale')) {
    const w = weekStart(s.date);
    const e = weeks.get(w) ?? { planned: 0, done: 0 };
    e.planned++; if (s.status === 'done') e.done++;
    weeks.set(w, e);
  }
  const stats: Record<string, (v?: number, rule?: Record<string, unknown>) => boolean> = {
    feedback_count: (v = 1, rule) => done.filter((s) => s.feedback === rule?.feedback).length >= v,
    sessions_done: (v = 1) => done.length >= v,
    minutes_total: (v = 100) => done.reduce((a, s) => a + s.minutes, 0) >= v,
    restart_done: (v = 1) => done.filter((s) => s.kind === 'ripartenza').length >= v,
    level_reached: (v = 2) => user.level >= v,
    habit_week_done: (v = 1) => habitWeeks.filter((w) => w.n >= 4).length >= v,
    habit_days: (v = 1) => habitWeeks.reduce((a, w) => a + w.n, 0) >= v,
    consistency: (v = 80) => consistencyAt(user.id, at) >= v,
    consistency_at_least: (v = 80) => consistencyAt(user.id, at) >= v,
    adapted_session_done: (v = 1) => done.filter((s) => {
      if (!s.checkin) return false;
      const c = JSON.parse(s.checkin) as { pain?: string[]; energy?: number };
      return (c.pain ?? []).length > 0 || (c.energy ?? 3) <= 2;
    }).length >= v,
    meal_photo: (v = 1) => meals >= v,
    meal_photos: (v = 1) => meals >= v,
    week_complete: (v = 1) => [...weeks.entries()].filter(([w, e]) => addDays(w, 6) <= at && e.planned > 0 && e.done >= e.planned).length >= v,
    hard_done: (v = 1) => done.filter((s) => s.feedback === 'duro').length >= v,
    checkin_done: (v = 1) => done.filter((s) => s.checkin).length >= v,
    pain_adapted: (v = 1) => done.filter((s) => s.checkin && (JSON.parse(s.checkin).pain ?? []).length > 0).length >= v,
  };
  const have = new Set((db.prepare('SELECT win_id FROM wins WHERE user_id = ?').all(user.id) as { win_id: string }[]).map((r) => r.win_id));
  const fresh: Win[] = [];
  for (const def of content.wins()) {
    if (have.has(def.id)) continue;
    const rule = ruleOf(def);
    const fn = rule && stats[rule.type];
    if (fn && fn(rule.value, rule as Record<string, unknown>)) {
      db.prepare('INSERT OR IGNORE INTO wins (user_id, win_id, date) VALUES (?, ?, ?)').run(user.id, def.id, at);
      fresh.push({ id: def.id, title: def.title, date: at, icon: typeof def.icon === 'string' ? def.icon : 'star' });
    }
  }
  return fresh;
}

export const isPast = (date: string) => date < today();
export { weekday };
