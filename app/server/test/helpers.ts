import { addDays, today } from '../src/dates.js';
import { createUser, getUser, insertSession } from '../src/engine/store.js';
import { db } from '../src/db.js';
import type { Profile, UserRow } from '../src/engine/types.js';

export const baseProfile = (over: Partial<Profile> = {}): Profile => ({
  name: 'Prova', age: 35, sex: 'f', heightCm: 168, weightKg: 65, job: 'seduto', sleepHours: 7,
  health: { heartCondition: false, chestPain: false, dizziness: false, jointIssue: false, medication: false, pregnancy: false, otherCondition: false, notes: '' },
  caution: false, medicalOk: null, calendarUrl: null, track: 'corsa', runner: null, food: null,
  goal: 'Correre 20 minuti', why: null, experience: 'poca', daysPerWeek: 3, minutesPerSession: 25,
  equipment: ['sedia', 'tappetino'], limitations: [], preferredTime: 'sera', startLevel: 1, ...over,
});

export function makeUser(profile: Profile, level = profile.startLevel, startDaysAgo = 21): UserRow {
  const u = createUser();
  const start = addDays(today(), -startDaysAgo);
  db.prepare('UPDATE users SET profile = ?, level = ?, start_date = ?, level_since = ? WHERE id = ?').run(JSON.stringify(profile), level, start, start, u.id);
  db.prepare('INSERT INTO level_history (user_id, n, from_date) VALUES (?, ?, ?)').run(u.id, level, start);
  return getUser(u.id)!;
}

/** Una seduta minima nel DB (per costanza, prontezza, livello). */
export function addSession(u: UserRow, daysAgo: number, status: 'done' | 'planned' | 'skipped', extra: Record<string, unknown> = {}) {
  return insertSession(u.id, {
    date: addDays(today(), -daysAgo), level: u.level, status, minutes: 25, intensity: 1, title: 'Prova', reason: 'Prova',
    items: [], source: 'rules', ...extra,
  } as never);
}
