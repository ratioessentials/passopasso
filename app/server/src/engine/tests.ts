import { content } from '../content.js';
import { addDays, today } from '../dates.js';
import { db } from '../db.js';
import { levelInfo, profileOf } from './store.js';
import type { UserRow } from './types.js';

/** Test di prontezza (content/tests.json): target per età, sesso, livello di arrivo e percorso. */

interface Band { ageMin: number; ageMax: number; f: number[]; m: number[] }
interface TestDef {
  id: string; title: string; measures?: string; unit: string; direction: 'atLeast' | 'atMost'; durationSec?: number;
  equipment?: string[]; instructions?: string[]; safety?: string; scale?: unknown[]; target?: number;
  norms?: { bands?: Band[]; otherSex?: 'f' | 'm'; source?: string; url?: string };
  levelBonus?: Record<string, number>; trackAdjust?: Record<string, number>;
}

function defs(): TestDef[] {
  return ((content.tests() as { tests?: TestDef[] }).tests ?? []);
}

export function targetFor(t: TestDef, age: number, sex: string, toLevel: number, track: string): number {
  if (!t.norms?.bands?.length) return t.target ?? 5;
  const band = t.norms.bands.find((b) => age >= b.ageMin && age <= b.ageMax) ?? t.norms.bands[0];
  const key = sex === 'm' ? 'm' : sex === 'f' ? 'f' : (t.norms.otherSex ?? 'f');
  const base = band[key][0];
  return Math.max(4, base + (t.levelBonus?.[String(toLevel)] ?? 0) + (t.trackAdjust?.[track] ?? 0));
}

interface TestRow { date: string; to_level: number; passed: number; skipped: number }
const lastTest = (userId: string, toLevel: number) =>
  db.prepare('SELECT date, to_level, passed, skipped FROM level_tests WHERE user_id = ? AND to_level = ? ORDER BY rowid DESC LIMIT 1').get(userId, toLevel) as TestRow | undefined;

/** "Non oggi" o test non superato: si ripropone tra una settimana. */
export function testSnoozed(userId: string, toLevel: number): boolean {
  const t = lastTest(userId, toLevel);
  return !!t && !t.passed && addDays(t.date, 7) > today();
}

/** Test superato per quel livello negli ultimi 14 giorni. */
export function testPassed(userId: string, toLevel: number): boolean {
  const t = lastTest(userId, toLevel);
  return !!t && !!t.passed && addDays(t.date, 14) >= today();
}

export function testsFor(user: UserRow) {
  const p = profileOf(user)!;
  const toLevel = Math.min(user.level + 1, 5);
  const info = levelInfo(user);
  return {
    toLevel,
    ready: info.ready,
    snoozed: testSnoozed(user.id, toLevel),
    passed: testPassed(user.id, toLevel),
    tests: defs().map((t) => ({
      id: t.id, title: t.title, measures: t.measures, instructions: t.instructions ?? [], unit: t.unit, direction: t.direction,
      durationSec: t.durationSec, equipment: t.equipment ?? [], safety: t.safety, scale: t.scale,
      target: targetFor(t, p.age ?? 40, p.sex ?? 'non_dico', toLevel, p.track ?? 'corsa'),
      source: t.norms?.source, url: t.norms?.url,
    })),
  };
}

export function submitTest(user: UserRow, body: { results?: Record<string, number>; skip?: boolean }) {
  const { tests, toLevel, ready } = testsFor(user);
  const t = today();
  if (body.skip) {
    db.prepare('INSERT INTO level_tests (user_id, date, to_level, results, passed, skipped) VALUES (?, ?, ?, ?, 0, 1)').run(user.id, t, toLevel, '{}');
    return { passed: false, skipped: true, message: content.text('test.skip_note', 'Va bene. Te lo ripropongo tra una settimana, e il percorso intanto continua.'), levelUp: null, details: [] };
  }
  const results = body.results ?? {};
  const details = tests.map((x) => {
    const v = results[x.id];
    const ok = typeof v === 'number' && (x.direction === 'atMost' ? v <= x.target : v >= x.target);
    return { id: x.id, value: v ?? null, target: x.target, passed: ok };
  });
  const passed = details.length > 0 && details.every((d) => d.passed);
  db.prepare('INSERT INTO level_tests (user_id, date, to_level, results, passed, skipped) VALUES (?, ?, ?, ?, ?, 0)').run(user.id, t, toLevel, JSON.stringify(results), passed ? 1 : 0);
  const p = profileOf(user)!;
  const levelUp = passed && ready ? { from: user.level, to: toLevel, name: content.level(toLevel, p.track).name } : null;
  const message = passed
    ? content.text('test.passed', 'Superato! Le tue gambe sono pronte per il passo dopo.')
    : content.text('test.not_yet', 'Ancora un po\' di strada. Restiamo qui un\'altra settimana: è così che si diventa forti.');
  return { passed, skipped: false, message, levelUp, details };
}
