import './setup.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { content } from '../src/content.js';
import { addDays, today, weekStart } from '../src/dates.js';
import { db } from '../src/db.js';
import { allowedExercises, buildRuleItems, filterFor, isAllowed } from '../src/engine/builder.js';
import { enforce, runChecks } from '../src/engine/invariants.js';
import { detectRedFlag } from '../src/engine/redflags.js';
import { consistencyAt, getUser, levelInfo, updateSession } from '../src/engine/store.js';
import { readiness } from '../src/engine/health.js';
import { submitTest, testsFor } from '../src/engine/tests.js';
import { acceptLevel } from '../src/engine/actions.js';
import { planRunWeek, segmentsMinutes } from '../src/engine/run.js';
import { toneOk } from '../src/engine/proactive.js';
import { trackFromGoal } from '../src/engine/onboarding.js';
import { addSession, baseProfile, makeUser } from './helpers.js';

// ---------- Filtro degli esercizi (regole 3, 4, 4b) ----------

test('filtro: con dolore alle ginocchia nessun esercizio le coinvolge', () => {
  const f = filterFor(baseProfile(), 3, ['ginocchia']);
  const list = allowedExercises(f);
  assert.ok(list.length > 5);
  assert.ok(list.every((e) => !e.zones.includes('ginocchia')));
});

test('filtro: livello, attrezzatura e muro sempre disponibile', () => {
  const f = filterFor(baseProfile({ equipment: [] }), 1);
  for (const e of allowedExercises(f)) {
    assert.ok(e.minLevel <= 1);
    assert.ok(e.equipment.every((x) => x === 'muro'));
  }
});

test('filtro: impatto vietato (problema articolare) esclude salti e corsa', () => {
  const p = baseProfile({ health: { ...baseProfile().health!, jointIssue: true } });
  const list = allowedExercises(filterFor(p, 5));
  assert.ok(list.every((e) => !e.impact));
});

test('filtro: in prudenza solo camminata, mobilità e respiro, niente forza', () => {
  const p = baseProfile({ caution: true });
  const list = allowedExercises(filterFor(p, 3));
  assert.ok(list.length > 0);
  assert.ok(list.every((e) => e.category !== 'forza' && !e.impact));
});

test('seduta a regole: rispetta il filtro', () => {
  const items = buildRuleItems({ level: 2, template: content.level(2).sessionTemplate, minutes: 20, intensity: 1, profile: baseProfile(), pain: ['spalle'], seed: 'x' });
  assert.ok(items.length >= 3);
  for (const i of items) assert.ok(isAllowed(content.exercise(i.exerciseId)!, filterFor(baseProfile(), 2, ['spalle'])));
});

// ---------- Invarianti ----------

const ctx = { minutes: 20, pain: ['ginocchia'] as never[], impactAllowed: false, redFlags: [] as string[] };
const ex = (cat: string, pred: (e: ReturnType<typeof content.exercises>[0]) => boolean = () => true) => content.exercises().find((e) => e.category === cat && pred(e))!;

test('invarianti: una seduta pulita passa 7/7', () => {
  const items = buildRuleItems({ level: 2, template: content.level(2).sessionTemplate, minutes: 20, intensity: 1, profile: baseProfile({ health: { ...baseProfile().health!, jointIssue: true } }), pain: ['ginocchia'], seed: 'y' });
  const d = enforce({ minutes: 20, intensity: 1, title: 't', reason: 'Oggi ritmo tranquillo.', items, source: 'rules' }, ctx, { safeReason: 'ok' });
  const checks = runChecks(d.draft, ctx);
  assert.equal(checks.length, 7);
  assert.deepEqual(checks.filter((c) => !c.passed).map((c) => c.id), []);
});

test('invarianti: trovano e correggono zone doloranti, impatto, dosaggi e reason', () => {
  const knee = ex('forza', (e) => e.zones.includes('ginocchia'));
  const jump = content.exercises().find((e) => e.impact)!;
  const warm = ex('riscaldamento', (e) => !e.zones.includes('ginocchia') && !e.impact);
  const cool = ex('defaticamento', (e) => !e.zones.includes('ginocchia') && !e.impact);
  const items = [
    { exerciseId: warm.id, sets: 1, restSec: 20, ...(warm.prescription.type === 'reps' ? { reps: 8 } : { seconds: 60 }) },
    { exerciseId: knee.id, sets: 9, restSec: 500, reps: 999 },
    { exerciseId: jump.id, sets: 2, restSec: 30, ...(jump.prescription.type === 'reps' ? { reps: 10 } : { seconds: 30 }) },
    { exerciseId: cool.id, sets: 1, restSec: 20, ...(cool.prescription.type === 'reps' ? { reps: 8 } : { seconds: 60 }) },
  ];
  const before = runChecks({ items, reason: 'Hai 74 kg, dovresti spingere.', segments: null }, ctx).filter((c) => !c.passed).map((c) => c.id);
  for (const id of ['no_pain_zones', 'no_impact', 'dosage_limits', 'reason_safe']) assert.ok(before.includes(id), id);
  const fixed = enforce({ minutes: 20, intensity: 1, title: 't', reason: 'Hai 74 kg, dovresti spingere.', items, source: 'ai' }, ctx, { safeReason: 'Seduta adattata.' });
  // corrette: niente zone doloranti, impatto, dosaggi fuori scala o reason pericolosa
  for (const id of ['no_pain_zones', 'no_impact', 'dosage_limits', 'reason_safe']) assert.ok(!fixed.after.includes(id), id);
  // tolti gli esercizi vietati la seduta resta troppo corta: nel flusso reale questo porta alla seduta di riserva
  assert.ok(fixed.after.every((id) => id === 'duration_ok'));
  assert.equal(fixed.draft.reason, 'Seduta adattata.');
  assert.ok(fixed.repaired);
});

test('invarianti: una seduta troppo lunga viene accorciata entro i minuti', () => {
  const items = buildRuleItems({ level: 3, template: content.level(3).sessionTemplate, minutes: 45, intensity: 1.3, profile: baseProfile(), seed: 'z' });
  const c = { minutes: 15, pain: [], impactAllowed: true, redFlags: [] };
  assert.ok(runChecks({ items, reason: 'ok', segments: null }, c).some((x) => x.id === 'duration_ok' && !x.passed));
  const fixed = enforce({ minutes: 15, intensity: 1, title: 't', reason: 'ok', items, source: 'ai' }, c, { safeReason: 'ok' });
  assert.deepEqual(fixed.after, []);
});

test('invarianti: con una bandiera rossa nessuna seduta passa', () => {
  const checks = runChecks({ items: [], reason: '', segments: null }, { ...ctx, redFlags: ['dolore_petto'] });
  assert.equal(checks.find((c) => c.id === 'no_red_flag')!.passed, false);
});

// ---------- Costanza (regola 7) ----------

test('costanza: fatte / pianificate, la saltata recuperata non pesa, bonus della ripartenza', () => {
  const u = makeUser(baseProfile(), 2, 30);
  addSession(u, 10, 'done'); addSession(u, 8, 'done'); addSession(u, 6, 'planned'); // una dimenticata
  assert.equal(consistencyAt(u.id), 67);
  const skipped = addSession(u, 4, 'skipped');
  addSession(u, 3, 'done', { kind: 'ripartenza', bonus_points: 10, recovers: skipped });
  assert.equal(consistencyAt(u.id), 77); // 2/3 + 10
});

test('costanza: mai sopra 100', () => {
  const u = makeUser(baseProfile(), 2, 30);
  for (const d of [9, 7, 5]) addSession(u, d, 'done');
  const s = addSession(u, 4, 'skipped');
  addSession(u, 3, 'done', { kind: 'ripartenza', bonus_points: 10, recovers: s });
  assert.equal(consistencyAt(u.id), 100);
});

// ---------- Prontezza del giorno ----------

function health(userId: string, daysAgo: number, v: { sleep?: number; rhr?: number; hrv?: number }) {
  db.prepare("INSERT OR REPLACE INTO health_days (user_id, source, date, steps, resting_hr, hrv, sleep_minutes, active_minutes, updated_at) VALUES (?, 'apple_health', ?, 5000, ?, ?, ?, 20, ?)")
    .run(userId, addDays(today(), -daysAgo), v.rhr ?? 54, v.hrv ?? 48, v.sleep ?? 420, new Date().toISOString());
}

test('prontezza: sonno corto e battito +9% → media, energia 2 (esempio di api.md)', () => {
  const u = makeUser(baseProfile());
  for (let i = 1; i <= 14; i++) health(u.id, i, {});
  health(u.id, 0, { sleep: 340, rhr: 59, hrv: 47 });
  const r = readiness(u.id)!;
  assert.equal(r.score, 62);
  assert.equal(r.level, 'media');
  assert.equal(r.suggestedEnergy, 2);
  assert.equal(r.signals.length, 2);
  assert.equal(r.restAdvised, false);
});

test('prontezza: 3 giorni di fila con 2 segnali → riposo consigliato', () => {
  const u = makeUser(baseProfile());
  for (let i = 3; i <= 16; i++) health(u.id, i, {});
  for (const d of [0, 1, 2]) health(u.id, d, { sleep: 330, rhr: 60 });
  assert.equal(readiness(u.id)!.restAdvised, true);
});

test('prontezza: senza dati di oggi → null', () => {
  const u = makeUser(baseProfile());
  assert.equal(readiness(u.id), null);
});

// ---------- Passaggio di livello: prontezza + test ----------

test('livello: pronto solo con sedute, costanza e test superato', () => {
  const u = makeUser(baseProfile(), 1, 20);
  const need = content.level(1, 'corsa').readiness!.minSessions;
  for (let i = 0; i < need; i++) addSession(u, 18 - i * 2 > 0 ? 18 - i * 2 : 1, 'done', { feedback: 'giusto' });
  assert.equal(levelInfo(getUser(u.id)!).ready, true);
  assert.equal(acceptLevel(getUser(u.id)!), 'test_required');
  const t = testsFor(getUser(u.id)!);
  const fail = submitTest(getUser(u.id)!, { results: Object.fromEntries(t.tests.map((x) => [x.id, x.direction === 'atMost' ? 10 : 0])) });
  assert.equal(fail.passed, false);
  assert.equal(fail.levelUp, null);
  // dopo un test non superato si riprova tra una settimana: per il test, togliamo il blocco
  db.prepare('DELETE FROM level_tests WHERE user_id = ?').run(u.id);
  const ok = submitTest(getUser(u.id)!, { results: Object.fromEntries(t.tests.map((x) => [x.id, x.target])) });
  assert.equal(ok.passed, true);
  assert.equal(ok.levelUp?.to, 2);
  assert.equal(acceptLevel(getUser(u.id)!), 'ok');
  assert.equal(getUser(u.id)!.level, 2);
});

test('livello: troppe sedute dure → non pronto', () => {
  const u = makeUser(baseProfile(), 1, 20);
  for (let i = 0; i < 8; i++) addSession(u, 16 - i * 2, 'done', { feedback: i >= 6 ? 'duro' : 'giusto' });
  assert.equal(levelInfo(getUser(u.id)!).ready, false);
});

test('livello: minorenni al massimo al livello 3', () => {
  const u = makeUser(baseProfile({ age: 16 }), 3, 20);
  for (let i = 0; i < 12; i++) addSession(u, 19 - i, 'done', { feedback: 'giusto' });
  assert.equal(levelInfo(getUser(u.id)!).ready, false);
});

// ---------- Regola del 10% (corsa 4-5) ----------

test('corsa: il volume pianificato non supera di oltre il 10% quello reale della settimana prima', () => {
  const runner = { kmPerWeek: 25, longestRunMin: 60, easyPaceMinKm: 6, runGoal: '10 km' };
  const u = makeUser(baseProfile({ runner, daysPerWeek: 4, experience: 'qualche_volta' }), 4, 14);
  const ws = weekStart(today());
  // la settimana scorsa: solo 40 minuti di corsa reale
  addSession(u, Math.round((Date.parse(today()) - Date.parse(addDays(ws, -3))) / 86400000), 'done', { segments: [{ label: 'Facile', minutes: 40, motion: 'corsetta', rpe: 3 }] });
  const slots = planRunWeek(getUser(u.id)!, getUser(u.id)!.profile ? JSON.parse(getUser(u.id)!.profile!) : null, ws, ws, new Set());
  const total = slots.reduce((a, s) => a + (s.draft?.segments ? segmentsMinutes(s.draft.segments) : 0), 0);
  // la riduzione tocca solo le parti principali (riscaldamento/defaticamento restano), con un minimo di 5 minuti per parte
  const warm = slots.reduce((a, s) => a + (s.draft?.segments ?? []).filter((g) => /riscald|defatic/i.test(g.label) || g.repeat).reduce((x, g) => x + segmentsMinutes([g]), 0), 0);
  assert.ok(total - warm <= 40 * 1.1 + 5 * slots.length, `${total} minuti pianificati`);
  assert.ok(slots.some((s) => s.type === 'lungo'));
});

test('corsa: il lungo cade di domenica', () => {
  const runner = { kmPerWeek: 25, longestRunMin: 50, easyPaceMinKm: 6, runGoal: '10 km' };
  const u = makeUser(baseProfile({ runner, daysPerWeek: 4 }), 4, 7);
  const ws = weekStart(today());
  const slots = planRunWeek(getUser(u.id)!, JSON.parse(getUser(u.id)!.profile!), ws, ws, new Set());
  assert.equal(slots.find((s) => s.type === 'lungo')?.date, addDays(ws, 6));
});

// ---------- Bandiere rosse nel testo libero ----------

test('bandiere rosse dal testo: frasi pericolose', () => {
  assert.equal(detectRedFlag('Stamattina ho avuto un dolore al petto mentre salivo le scale')?.id, 'dolore_petto');
  assert.ok(detectRedFlag('ieri sono quasi svenuta in ufficio'));
  assert.ok(detectRedFlag('ho la febbre da due giorni'));
});

test('bandiere rosse dal testo: negazioni e frasi innocue non bloccano', () => {
  assert.equal(detectRedFlag('Non ho febbre, tutto bene'), null);
  assert.equal(detectRedFlag('Nessun dolore al petto, tranquillo'), null);
  assert.equal(detectRedFlag('Questa settimana ho poco tempo'), null);
  assert.equal(detectRedFlag('Vorrei rinforzare il petto e le braccia'), null);
});

// ---------- Tono e percorso ----------

test('filtro di tono del coach proattivo', () => {
  assert.ok(toneOk('Di nuovo in pista. Ripartire è la parte più difficile, ed è fatta.'));
  assert.ok(!toneOk('Sei arrivata al livello 2, brava!'));
  assert.ok(!toneOk('Dovresti perdere peso.'));
});

test('percorso dall\'obiettivo', () => {
  assert.equal(trackFromGoal('Vorrei meno mal di schiena'), 'mobilita');
  assert.equal(trackFromGoal('Sentirmi più forte'), 'forza');
  assert.equal(trackFromGoal('Correre una 10 km'), 'corsa');
  assert.equal(trackFromGoal('Boh, stare meglio'), 'corsa');
});

test('sedute importate: la camminata completa la seduta pianificata di oggi', async () => {
  const { ingest } = await import('../src/engine/health.js');
  const u = makeUser(baseProfile(), 2, 10);
  const id = addSession(u, 0, 'planned', { items: [] });
  ingest(getUser(u.id)!, { source: 'apple_health', workouts: [{ type: 'Walking', minutes: 30, start: `${today()}T07:00:00` }] } as never);
  const row = db.prepare('SELECT status, kind, was_planned FROM sessions WHERE id = ?').get(id) as { status: string; kind: string; was_planned: number };
  assert.deepEqual(row, { status: 'done', kind: 'importata', was_planned: 1 });
  updateSession(id, {});
});
