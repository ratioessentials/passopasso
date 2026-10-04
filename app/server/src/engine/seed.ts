import { content } from '../content.js';
import { db } from '../db.js';
import { addDays, today, weekStart } from '../dates.js';
import { currentHabit, evaluateWins, getUser, insertSession, planWeek, ruleDraft, updateSession } from './store.js';
import type { Feedback, Profile, UserRow } from './types.js';
import { startIntensity } from './person.js';

/** Fine dell'onboarding: salva il profilo, fissa il livello di partenza e pianifica la prima settimana (con una seduta già oggi). */
export function saveProfile(user: UserRow, profile: Profile) {
  const t = today();
  db.transaction(() => {
    db.prepare('UPDATE users SET profile = ?, level = ?, intensity = ?, start_date = ?, level_since = ?, draft = NULL WHERE id = ?')
      .run(JSON.stringify(profile), profile.startLevel, startIntensity(profile), t, t, user.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND status = 'planned'").run(user.id);
    db.prepare('DELETE FROM planned_weeks WHERE user_id = ?').run(user.id);
    db.prepare('DELETE FROM level_history WHERE user_id = ?').run(user.id);
    db.prepare('INSERT INTO level_history (user_id, n, from_date) VALUES (?, ?, ?)').run(user.id, profile.startLevel, t);
  })();
  const fresh = getUser(user.id)!;
  planWeek(fresh, profile, weekStart(t), t, { includeFrom: true });
}

// ---------- Utente demo ----------

export const DEMO_ID = 'demo';
export const RUNNER_ID = 'demo-runner';
export const isDemo = (id: string) => id === DEMO_ID || id === RUNNER_ID;

const DEMO_PROFILE: Profile = {
  name: 'Giulia',
  age: 34,
  sex: 'f',
  heightCm: 168,
  weightKg: 74,
  job: 'seduto',
  sleepHours: 6.5,
  health: {
    heartCondition: false, chestPain: false, dizziness: false, jointIssue: true,
    medication: false, pregnancy: false, otherCondition: false, notes: 'Lieve condromalacia al ginocchio destro',
  },
  caution: false,
  medicalOk: null,
  calendarUrl: null,
  track: 'corsa',
  runner: null,
  food: null,
  goal: 'Riuscire a correre 20 minuti senza fermarmi',
  experience: 'poca',
  daysPerWeek: 3,
  minutesPerSession: 25,
  equipment: ['sedia', 'tappetino'],
  limitations: ['ginocchia'],
  preferredTime: 'sera',
  startLevel: 1,
};

type Ev = { d: number; level: number; status: 'done' | 'skipped' | 'planned'; feedback?: Feedback; kind?: 'ripartenza'; skip?: string; checkin?: object };

/**
 * Storico di Giulia, relativo a oggi: ~3 settimane, livello 1 → 2, una seduta saltata e recuperata con la ripartenza,
 * una seduta dimenticata (la costanza non è perfetta, ed è giusto così). Completando la seduta di oggi
 * scatta la proposta di passare al livello 3: è il momento wow della demo.
 */
const TIMELINE: Ev[] = [
  { d: -22, level: 1, status: 'done', feedback: 'giusto' },
  { d: -20, level: 1, status: 'done', feedback: 'facile' },
  { d: -18, level: 1, status: 'planned' },                       // dimenticata
  { d: -16, level: 2, status: 'done', feedback: 'giusto' },
  { d: -13, level: 2, status: 'done', feedback: 'giusto', checkin: { minutes: 20, energy: 2, pain: ['ginocchia'], redFlags: [] } },
  { d: -11, level: 2, status: 'planned' },                       // dimenticata
  { d: -9, level: 2, status: 'done', feedback: 'duro' },
  { d: -6, level: 2, status: 'skipped', skip: 'tempo' },
  { d: -5, level: 2, status: 'done', feedback: 'giusto', kind: 'ripartenza' },
  { d: -4, level: 2, status: 'done', feedback: 'giusto' },
  { d: -2, level: 2, status: 'done', feedback: 'facile', checkin: { minutes: 25, energy: 4, pain: [], redFlags: [] } },
  { d: 0, level: 2, status: 'planned' },
];

const DEMO_RESET_MS = Number(process.env.DEMO_RESET_MINUTES || 30) * 60_000;

/** Segna che qualcuno ha modificato il demo: dopo DEMO_RESET_MINUTES di quiete torna allo stato iniziale. */
export function touchDemo() {
  db.prepare("INSERT INTO meta (key, value) VALUES ('demo_touched', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(Date.now()));
}

export function seedDemo(force = false) {
  const t = today();
  const meta = db.prepare("SELECT value FROM meta WHERE key = 'demo_seed'").get() as { value: string } | undefined;
  const touched = Number((db.prepare("SELECT value FROM meta WHERE key = 'demo_touched'").get() as { value: string } | undefined)?.value ?? 0);
  const stamp = `${t}|${content.sources()['exercises.json']}|v6`;
  const stale = touched > 0 && Date.now() - touched > DEMO_RESET_MS;
  if (!force && !stale && meta?.value === stamp && getUser(DEMO_ID) && getUser(RUNNER_ID)) return;
  db.prepare("DELETE FROM meta WHERE key = 'demo_touched'").run();
  seedGiulia(t, stamp);
  seedRunner(t);
}

function seedGiulia(t: string, stamp: string) {
  db.transaction(() => {
    db.prepare('DELETE FROM users WHERE id = ?').run(DEMO_ID);
    const start = addDays(t, -22);
    const levelUpDay = addDays(t, -17);
    db.prepare('INSERT INTO users (id, profile, level, intensity, created_at, start_date, level_since) VALUES (?, ?, 1, 1.0, ?, ?, ?)')
      .run(DEMO_ID, JSON.stringify(DEMO_PROFILE), new Date(start).toISOString(), start, start);
    db.prepare('INSERT INTO level_history (user_id, n, from_date, to_date) VALUES (?, 1, ?, ?)').run(DEMO_ID, start, levelUpDay);

    let intensity = 1.0;
    let skippedId: string | null = null;
    for (const ev of TIMELINE) {
      const date = addDays(t, ev.d);
      if (ev.d >= -17 && ev.level === 2) {
        const u = getUser(DEMO_ID)!;
        if (u.level === 1) {
          db.prepare('INSERT INTO level_history (user_id, n, from_date) VALUES (?, 2, ?)').run(DEMO_ID, levelUpDay);
          db.prepare('UPDATE users SET level = 2, level_since = ? WHERE id = ?').run(levelUpDay, DEMO_ID);
          intensity = 1.0;
        }
      }
      const user = { ...getUser(DEMO_ID)!, intensity };
      const draft = ruleDraft(user, DEMO_PROFILE, date, { level: ev.level, restart: ev.kind === 'ripartenza' });
      if (ev.checkin) {
        const c = ev.checkin as { minutes: number; energy: number; pain: string[] };
        draft.minutes = c.minutes;
        draft.source = 'ai';
        draft.reason = c.pain.length
          ? 'Energia bassa e ginocchia sensibili: oggi camminata tranquilla e forza per la parte alta, niente affondi.'
          : 'Sei in forma e hai tempo: camminata svelta un po\' più lunga e una serie in più di forza.';
      }
      const id = insertSession(DEMO_ID, {
        date, level: ev.level, ...draft, status: ev.status, feedback: ev.feedback ?? null, skip_reason: ev.skip ?? null,
        recovers: ev.kind === 'ripartenza' ? skippedId : null, checkin: ev.checkin ? JSON.stringify(ev.checkin) : null,
        done_at: ev.status === 'done' ? `${date}T19:30:00.000Z` : null,
      });
      if (ev.status === 'skipped') skippedId = id;
      if (ev.feedback) intensity = Math.min(1.3, Math.max(0.7, Math.round((intensity + (ev.feedback === 'facile' ? 0.1 : ev.feedback === 'duro' ? -0.1 : 0)) * 10) / 10));
      db.prepare('UPDATE users SET intensity = ? WHERE id = ?').run(intensity, DEMO_ID);
      if (ev.status === 'done') evaluateWins(getUser(DEMO_ID)!, date);
    }

    // settimane già pianificate: non aggiungere altre sedute a quelle dello storico
    for (let d = -22; d <= 0; d += 1) db.prepare('INSERT OR IGNORE INTO planned_weeks (user_id, week_start) VALUES (?, ?)').run(DEMO_ID, weekStart(addDays(t, d)));
    // il resto della settimana corrente (se oggi non è domenica)
    const ws = weekStart(t);
    for (const d of [2, 4]) {
      const date = addDays(t, d);
      if (date <= addDays(ws, 6)) {
        const user = getUser(DEMO_ID)!;
        insertSession(DEMO_ID, { date, level: 2, ...ruleDraft(user, DEMO_PROFILE, date) });
      }
    }

    // abitudine in corso: 3 giorni segnati in questa settimana (o negli ultimi giorni)
    const habit = currentHabit(getUser(DEMO_ID)!);
    for (const d of [0, -1, -2, -3, -4, -5, -6].map((x) => addDays(t, x)).filter((x) => x >= ws).slice(1, 4)) {
      db.prepare('INSERT OR IGNORE INTO habit_checkins (user_id, date, habit_id) VALUES (?, ?, ?)').run(DEMO_ID, d, habit.id);
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('demo_seed', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(stamp);
  })();
  // la seduta di oggi ha una reason pronta, così la demo parte bene anche prima del check-in
  const todayRow = db.prepare("SELECT id FROM sessions WHERE user_id = ? AND date = ? AND status = 'planned'").get(DEMO_ID, t) as { id: string } | undefined;
  if (todayRow) updateSession(todayRow.id, { reason: 'Se oggi va come le ultime, il livello successivo è a un passo.' });
}

// ---------- Secondo demo: Luca, che corre già ----------

const RUNNER_PROFILE: Profile = {
  name: 'Luca',
  age: 43,
  sex: 'm',
  heightCm: 178,
  weightKg: 72,
  job: 'seduto',
  sleepHours: 7,
  health: { heartCondition: false, chestPain: false, dizziness: false, jointIssue: false, medication: false, pregnancy: false, otherCondition: false, notes: '' },
  caution: false,
  medicalOk: null,
  calendarUrl: null,
  track: 'corsa',
  runner: { kmPerWeek: 25, longestRunMin: 50, easyPaceMinKm: 5.8, runGoal: '10 km sotto i 55 minuti' },
  food: { breakfast: true, veggiesPerDay: 2, sugaryDrinks: 'mai', mealsOut: 4, cooks: 'a_volte' },
  goal: 'Correre una 10 km sotto i 55 minuti',
  experience: 'qualche_volta',
  daysPerWeek: 4,
  minutesPerSession: 50,
  equipment: ['tappetino', 'elastico'],
  limitations: [],
  preferredTime: 'mattina',
  startLevel: 4,
};

/**
 * Luca: 43 anni, 25 km a settimana, livello 4 del percorso corsa da tre settimane.
 * Settimana da podista (facile, qualità, forza di supporto, lungo la domenica) con feedback realistici.
 */
function seedRunner(t: string) {
  db.prepare('DELETE FROM users WHERE id = ?').run(RUNNER_ID);
  const start = addDays(weekStart(t), -14);
  db.prepare('INSERT INTO users (id, profile, level, intensity, created_at, start_date, level_since) VALUES (?, ?, 4, 1.0, ?, ?, ?)')
    .run(RUNNER_ID, JSON.stringify(RUNNER_PROFILE), new Date(start).toISOString(), start, start);
  db.prepare('INSERT INTO level_history (user_id, n, from_date) VALUES (?, 4, ?)').run(RUNNER_ID, start);
  const feedbacks: Feedback[] = ['giusto', 'duro', 'giusto', 'facile', 'giusto', 'giusto', 'facile', 'giusto', 'giusto', 'giusto', 'facile'];
  let fi = 0;
  for (let w = 0; w < 3; w++) {
    const ws = addDays(start, 7 * w);
    planWeek(getUser(RUNNER_ID)!, RUNNER_PROFILE, ws, ws);
    // tutto ciò che è prima di oggi è fatto (una sola seduta saltata, la prima settimana)
    const rows = db.prepare('SELECT id, date, run_type FROM sessions WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date').all(RUNNER_ID, ws, addDays(ws, 6)) as { id: string; date: string; run_type: string | null }[];
    for (const r of rows) {
      if (r.date >= t) continue;
      if (w === 0 && r.run_type === null) { updateSession(r.id, { status: 'skipped', skip_reason: 'tempo' }); continue; }
      updateSession(r.id, { status: 'done', feedback: feedbacks[fi++ % feedbacks.length], done_at: `${r.date}T06:45:00.000Z` });
      evaluateWins(getUser(RUNNER_ID)!, r.date);
    }
  }
  // abitudine della settimana, con due giorni segnati
  const habit = currentHabit(getUser(RUNNER_ID)!);
  for (const d of [addDays(t, -1), addDays(t, -2)].filter((x) => x >= weekStart(t))) {
    db.prepare('INSERT OR IGNORE INTO habit_checkins (user_id, date, habit_id) VALUES (?, ?, ?)').run(RUNNER_ID, d, habit.id);
  }
}
