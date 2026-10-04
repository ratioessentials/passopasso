import { content } from '../content.js';
import { addDays, today } from '../dates.js';
import { db } from '../db.js';
import { continuousCardio } from './proactive.js';
import { allSessions, profileOf } from './store.js';
import type { Item, UserRow } from './types.js';

/** Seduta zero: 5 minuti fissi, senza domande e senza utente (content/program.json → sessionZero). */
export function sessionZero() {
  const z = (content.program() as { sessionZero?: { title?: string; minutes?: number; reason?: string; items?: Item[] } }).sessionZero ?? {};
  const items: Item[] = z.items ?? [
    { exerciseId: 'marcia_sul_posto', sets: 1, seconds: 60, restSec: 15 },
    { exerciseId: 'squat_sedia', sets: 1, reps: 6, restSec: 20 },
    { exerciseId: 'ponte_glutei', sets: 1, reps: 6, restSec: 20 },
    { exerciseId: 'marcia_sul_posto', sets: 1, seconds: 60, restSec: 10 },
    { exerciseId: 'respirazione_profonda', sets: 1, seconds: 45, restSec: 0 },
  ];
  return {
    id: 'session-zero', date: today(), status: 'planned' as const, kind: 'zero' as const, level: 1, minutes: z.minutes ?? 5, intensity: 1,
    title: z.title ?? 'Primi 5 minuti',
    reason: z.reason ?? 'Niente domande: cinque minuti per sentire come si muove il corpo.',
    items: items.filter((i) => content.exercise(i.exerciseId)).map((i) => ({ ...i, exercise: content.exercise(i.exerciseId)! })),
    bonusPoints: 0, segments: null,
  };
}

/** Seduta zero fatta: la vittoria "Primi 5 minuti" resta anche dopo l'onboarding. */
export function markZeroDone(userId: string) {
  db.prepare('INSERT OR IGNORE INTO session_zero (user_id, done_at) VALUES (?, ?)').run(userId, new Date().toISOString());
  const def = content.wins().find((w) => (w as { rule?: { type?: string } }).rule?.type === 'session_zero_done') ?? { id: 'primi_5_minuti', title: 'Primi 5 minuti', icon: 'sprout' };
  db.prepare('INSERT OR IGNORE INTO wins (user_id, win_id, date) VALUES (?, ?, ?)').run(userId, def.id, today());
  return { id: def.id, title: def.title, date: today(), icon: typeof def.icon === 'string' ? def.icon : 'sprout' };
}

export const zeroDone = (userId: string) => !!db.prepare('SELECT 1 FROM session_zero WHERE user_id = ?').get(userId);

/** "Allora / Adesso": dai test di prontezza e dalle sedute, senza bilancia. null = non ancora misurato. */
export function thenNow(user: UserRow) {
  const tests = (db.prepare("SELECT date, results FROM level_tests WHERE user_id = ? AND skipped = 0 ORDER BY date, rowid").all(user.id) as { date: string; results: string }[])
    .map((t) => JSON.parse(t.results) as Record<string, number>).filter((r) => typeof r.sit_to_stand_30s === 'number');
  const sit = tests.length ? { then: tests[0].sit_to_stand_30s, now: tests.at(-1)!.sit_to_stand_30s } : { then: null, now: null };

  const start = user.start_date ?? today();
  const done = allSessions(user.id).filter((s) => s.status === 'done' && s.date <= today());
  const firstWeek = done.filter((s) => s.date >= start && s.date <= addDays(start, 6));
  const lastTwoWeeks = done.filter((s) => s.date >= addDays(today(), -13));
  const best = (rows: typeof done) => (rows.length ? Math.max(0, ...rows.map(continuousCardio)) || null : null);
  const runs = profileOf(user)?.track === 'corsa' && user.level >= 3;
  const lastWeek = done.filter((s) => s.date >= addDays(today(), -6)).length;
  const started = start <= addDays(today(), -7);
  return [
    { label: 'Alzate dalla sedia in 30 s', then: sit.then, now: sit.now, unit: '' },
    { label: runs ? 'Corsa continua' : 'Cammino continuo', then: best(firstWeek), now: started ? best(lastTwoWeeks) : null, unit: 'min' },
    { label: 'Sedute a settimana', then: firstWeek.length || (started ? 0 : null), now: started ? lastWeek : null, unit: '' },
  ];
}
