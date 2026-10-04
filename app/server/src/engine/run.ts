import { z } from 'zod';
import { askJson, type AiMeta } from '../ai/claude.js';
import { SEDUTA_SYSTEM } from '../ai/prompts/seduta.js';
import { content, type BodyZone, type Level } from '../content.js';
import { addDays, diffDays, weekStart } from '../dates.js';
import { db } from '../db.js';
import { buildRuleItems, clampIntensity, tidyReason } from './builder.js';
import { derive, personSummary } from './person.js';
import type { DraftSession, Profile, Segment, SessionRow, UserRow } from './types.js';

/** Settimana da podista (percorso corsa, livelli con `runWeek`): facile, qualità, lungo, forza di supporto. */

interface RunLevel extends Level {
  runWeek?: { pattern: string[]; qualita?: string[] };
  runSessions?: Record<string, { title: string; segments: Segment[] }>;
  progression?: { longRunStartMin?: number; longRunStepMin?: number; longRunMaxMin?: number; deloadEvery?: number; deloadFactor?: number; maxWeeklyIncrease?: number };
}

export function runLevel(profile: Profile | null, level: number): RunLevel | null {
  if (!profile || (profile.track ?? 'corsa') !== 'corsa') return null;
  const lvl = content.level(level, 'corsa') as RunLevel;
  return lvl.runWeek?.pattern?.length && lvl.runSessions ? lvl : null;
}

/** Giorni della settimana (0 = lunedì) per N sedute: il lungo sempre di domenica. */
const RUN_DAYS: Record<number, number[]> = { 2: [2, 6], 3: [1, 3, 6], 4: [0, 2, 4, 6], 5: [0, 1, 3, 4, 6], 6: [0, 1, 2, 3, 4, 6] };

/** Tipi di seduta della settimana: si tolgono prima le forza se ci sono meno giorni; il lungo va per ultimo. */
/** Il tipo di seduta previsto in una data (per ricostruire la seduta di oggi). */
export function typeForDate(user: UserRow, profile: Profile, date: string): string {
  const lvl = runLevel(profile, user.level)!;
  const ws = weekStart(date);
  const ctx = runContext(user, profile, ws);
  const types = weekTypes(lvl, Math.min(profile.daysPerWeek || lvl.sessionsPerWeek, lvl.runWeek!.pattern.length, 6), ctx.weekIndex);
  const pattern = RUN_DAYS[types.length] ?? RUN_DAYS[3];
  const i = pattern.findIndex((d) => addDays(ws, d) === date);
  return i >= 0 ? types[i] : 'facile';
}

export function runSessionsPerWeek(profile: Profile, level: number): number {
  const lvl = runLevel(profile, level)!;
  return weekTypes(lvl, Math.min(profile.daysPerWeek || lvl.sessionsPerWeek, lvl.runWeek!.pattern.length, 6), 0).length;
}

export function weekTypes(lvl: RunLevel, days: number, weekIndex: number): string[] {
  let types = [...lvl.runWeek!.pattern];
  while (types.length > Math.max(2, days) && types.includes('forza')) types.splice(types.lastIndexOf('forza'), 1);
  types = types.slice(0, Math.max(2, Math.min(days, 6)));
  const q = lvl.runWeek!.qualita?.length ? lvl.runWeek!.qualita : ['ripetute'];
  types = types.map((t) => (t === 'qualita' ? q[weekIndex % q.length] : t));
  const hasLong = types.includes('lungo');
  return hasLong ? [...types.filter((t) => t !== 'lungo'), 'lungo'] : types;
}

export const segmentsMinutes = (segs: Segment[]) => segs.reduce((a, s) => a + (s.minutes + (s.recovery?.minutes ?? 0)) * (s.repeat ?? 1) - (s.repeat && s.recovery ? s.recovery.minutes : 0), 0);
const isWarm = (s: Segment) => /riscald|defatic/i.test(s.label);
const r1 = (x: number) => Math.round(x * 4) / 4;

/** Minuti di corsa fatti nella settimana precedente (sedute con segmenti o importate). */
function lastWeekRunMinutes(userId: string, ws: string): number {
  const rows = db.prepare("SELECT minutes, segments, kind FROM sessions WHERE user_id = ? AND status = 'done' AND date >= ? AND date < ? AND (segments IS NOT NULL OR kind = 'importata')")
    .all(userId, addDays(ws, -7), ws) as { minutes: number; segments: string | null; kind: string }[];
  return rows.reduce((a, r) => a + (r.segments ? segmentsMinutes(JSON.parse(r.segments)) : r.minutes), 0);
}

export interface RunPlanContext { weekIndex: number; deload: boolean; longMin: number }

export function runContext(user: UserRow, profile: Profile, date: string): RunPlanContext {
  const lvl = runLevel(profile, user.level)!;
  const p = lvl.progression ?? {};
  const weekIndex = Math.max(0, Math.floor(diffDays(weekStart(date), weekStart(user.level_since ?? date)) / 7));
  const every = p.deloadEvery ?? 4;
  const deload = (weekIndex + 1) % every === 0;
  const start = Math.min(Math.max(profile.runner?.longestRunMin ?? p.longRunStartMin ?? 35, 20), p.longRunMaxMin ?? 60);
  const growWeeks = weekIndex - Math.floor((weekIndex + 1) / every); // le settimane di scarico non fanno crescere
  const longMin = Math.min(p.longRunMaxMin ?? 60, start + (p.longRunStepMin ?? 5) * growWeeks);
  return { weekIndex, deload, longMin };
}

/** Segmenti della seduta: lungo che cresce, scarico ogni N settimane (deterministico). */
export function runSegments(lvl: RunLevel, type: string, ctx: RunPlanContext): Segment[] {
  const tpl = lvl.runSessions![type] ?? lvl.runSessions!.facile;
  let segs: Segment[] = tpl.segments.map((s) => ({ ...s, recovery: s.recovery ? { ...s.recovery } : undefined }));
  if (type === 'lungo') {
    const main = segs.find((s) => !isWarm(s));
    if (main) main.minutes = ctx.longMin;
  }
  if (ctx.deload) {
    const f = lvl.progression?.deloadFactor ?? 0.7;
    segs = segs.map((s) => (isWarm(s) ? s : { ...s, minutes: s.repeat ? s.minutes : r1(Math.max(1, s.minutes * f)), repeat: s.repeat ? Math.max(2, Math.round(s.repeat * f)) : undefined }));
  }
  return segs.map((s) => (s.recovery ? s : (({ recovery: _r, ...rest }) => rest)(s)));
}

const TYPE_REASON: Record<string, string> = {
  facile: 'Corsa facile: ritmo da chiacchiera, serve a costruire la base.',
  ripetute: 'Ripetute: tratti svelti con recupero, per allenare il ritmo.',
  progressivo: 'Progressivo: parti piano e chiudi più svelto.',
  allunghi: 'Allunghi: brevi accelerazioni sciolte, mai tirate.',
  lungo: 'Il lungo della settimana: piano, si costruisce la resistenza.',
};

export function runDraft(user: UserRow, profile: Profile, date: string, type: string): DraftSession & { bonus_points: number; kind: 'normale' } {
  const lvl = runLevel(profile, user.level)!;
  const ctx = runContext(user, profile, date);
  let segments = runSegments(lvl, type, ctx);
  if (!derive(profile).impactAllowed) segments = toWalking(segments);
  const items = buildRuleItems({
    level: user.level, profile, minutes: 8, intensity: user.intensity, seed: date,
    template: { minutes: 8, blocks: [{ category: 'riscaldamento', count: 1 }, { category: 'defaticamento', count: 1 }] },
  });
  const title = type === 'lungo' ? `Lungo ${ctx.longMin} minuti` : lvl.runSessions![type]?.title ?? 'Corsa';
  let reason = TYPE_REASON[type] ?? 'Corsa a segmenti.';
  if (type === 'lungo' && ctx.weekIndex > 0 && !ctx.deload) reason = `Lungo di ${ctx.longMin} minuti: un passo in più della scorsa settimana, sempre a ritmo di chiacchiera.`;
  if (ctx.deload) reason = 'Settimana di scarico: tutto un po\' più corto, così il corpo assorbe il lavoro.';
  return {
    kind: 'normale', bonus_points: 0, source: 'rules', intensity: user.intensity,
    minutes: Math.round(segmentsMinutes(segments)), title, reason, items, segments, run_type: type,
  };
}

/** Senza impatto (articolazioni, BMI, età, prudenza) la corsa diventa camminata veloce. */
export function toWalking(segs: Segment[]): Segment[] {
  const walk = (s: { label: string; motion: string; rpe: number }) => (/corsa|corsetta|scatto/.test(s.motion)
    ? { ...s, label: s.label.replace(/corsa lenta/i, 'Cammina piano').replace(/^(Facile|Lungo facile)$/i, 'Camminata svelta'), motion: 'camminata_veloce', rpe: Math.min(s.rpe, 5) }
    : s);
  return segs.map((s) => ({ ...walk(s), ...(s.recovery ? { recovery: walk(s.recovery) } : {}) }) as Segment);
}

/** Pianifica una settimana da podista: tipi in ordine, lungo la domenica, regola del 10% sul volume reale. */
export function planRunWeek(user: UserRow, profile: Profile, ws: string, from: string, busy: Set<string>, opts: { prefer?: string[] } = {}): { date: string; draft: ReturnType<typeof runDraft> | null; type: string }[] {
  const lvl = runLevel(profile, user.level)!;
  const ctx = runContext(user, profile, ws);
  const days = Math.min(profile.daysPerWeek || lvl.sessionsPerWeek, lvl.runWeek!.pattern.length, 6);
  const types = weekTypes(lvl, days, ctx.weekIndex);
  const pattern = RUN_DAYS[types.length] ?? RUN_DAYS[3];
  let slots = types.map((type, i) => ({ type, date: addDays(ws, pattern[i]) }));
  if (opts.prefer?.length) {
    const pref = opts.prefer.filter((d) => d >= ws && d <= addDays(ws, 6)).sort();
    slots = slots.map((s, i) => ({ ...s, date: pref[i] ?? s.date }));
  }
  slots = slots.filter((s) => s.date >= from && !busy.has(s.date));
  // regola del 10%: il volume di corsa pianificato non supera di oltre il 10% quello reale della settimana prima
  const prev = lastWeekRunMinutes(user.id, ws);
  const out = slots.map((s) => ({ ...s, draft: s.type === 'forza' ? null : runDraft(user, profile, s.date, s.type) }));
  const planned = out.reduce((a, s) => a + (s.draft?.segments ? segmentsMinutes(s.draft.segments) : 0), 0);
  const maxInc = lvl.progression?.maxWeeklyIncrease ?? 0.1;
  if (prev > 0 && planned > prev * (1 + maxInc)) {
    const f = Math.max(0.5, (prev * (1 + maxInc)) / planned);
    for (const s of out) {
      if (!s.draft?.segments) continue;
      s.draft.segments = s.draft.segments.map((g) => (isWarm(g) || g.repeat ? g : { ...g, minutes: r1(Math.max(5, g.minutes * f)) }));
      s.draft.minutes = Math.round(segmentsMinutes(s.draft.segments));
      if (s.type === 'lungo') s.draft.title = `Lungo ${Math.round(s.draft.segments.find((g) => !isWarm(g))?.minutes ?? ctx.longMin)} minuti`;
      s.draft.reason = 'Volume tenuto entro il 10% in più della scorsa settimana: si cresce senza farsi male.';
    }
  }
  return out;
}

// ---------- Check-in di una seduta di corsa ----------

const MOTIONS = ['marcia', 'camminata_veloce', 'corsetta', 'corsa', 'scatto'] as const;
const SegSchema = z.object({
  label: z.string().min(1).max(30),
  minutes: z.number().min(0.25).max(150),
  motion: z.enum(MOTIONS),
  rpe: z.number().int().min(1).max(10),
  repeat: z.number().int().min(2).max(12).nullish(),
  recovery: z.object({ label: z.string().min(1).max(30), minutes: z.number().min(0.25).max(10), motion: z.enum(MOTIONS), rpe: z.number().int().min(1).max(6) }).nullish(),
});
const AiRun = z.object({ title: z.string().min(2).max(40), reason: z.string().min(10).max(400), segments: z.array(SegSchema).min(2).max(10) });

const LEG_ZONES: BodyZone[] = ['ginocchia', 'caviglie', 'anche', 'schiena_bassa'];

/** Corsa facile e corta: per poco tempo o gamba pesante. */
function shortEasy(minutes: number): Segment[] {
  const main = Math.max(5, minutes - 10);
  return [
    { label: 'Riscaldamento', minutes: 5, motion: 'marcia', rpe: 2 },
    { label: 'Facile', minutes: main, motion: 'corsetta', rpe: 3 },
    { label: 'Defaticamento', minutes: 5, motion: 'marcia', rpe: 2 },
  ];
}

export async function adaptRun(row: SessionRow, profile: Profile, checkin: { minutes: number; energy: number; pain: BodyZone[] }, intensity: number, context?: string | null, meta?: AiMeta) {
  const planned: Segment[] = JSON.parse(row.segments!);
  const plannedMin = segmentsMinutes(planned);
  const legPain = checkin.pain.filter((z) => LEG_ZONES.includes(z));
  const noImpact = !derive(profile).impactAllowed || legPain.length > 0;
  const cap = Math.min(plannedMin, checkin.minutes);
  const fallback = () => {
    let segs = planned;
    let title = row.title;
    let reason = 'Seduta come da piano: ascolta il respiro e tieni il ritmo indicato.';
    if (checkin.minutes < plannedMin * 0.85 || checkin.energy <= 2) {
      segs = shortEasy(cap);
      title = 'Corsa facile';
      reason = checkin.energy <= 2 ? 'Gambe pesanti: oggi corsa facile e corta, la qualità la recuperiamo.' : 'Poco tempo: corsa facile e corta, va benissimo così.';
    }
    if (noImpact) {
      segs = toWalking(segs);
      title = 'Camminata svelta';
      if (legPain.length) reason = 'Fastidio alle gambe: oggi camminata svelta al posto della corsa.';
    }
    return { segments: segs, reason, title, source: 'rules' as const };
  };
  const user = `CHI È: ${personSummary(profile)}
SEDUTA DI CORSA PIANIFICATA (${row.title}, ${Math.round(plannedMin)} minuti):
${JSON.stringify(planned)}
CHECK-IN: ${checkin.minutes} minuti disponibili, energia ${checkin.energy}/5, dolori: ${checkin.pain.join(', ') || 'nessuno'}.${context ? `\n${context}` : ''}
REGOLE: adatta i SEGMENTI (non gli esercizi). Durata totale al massimo ${Math.round(cap)} minuti, mai più lunga del piano. Poco tempo o energia 1-2 → corsa facile corta (RPE 3). ${noImpact ? 'NIENTE CORSA oggi: usa camminata_veloce o marcia, RPE al massimo 5.' : ''}
Tieni riscaldamento e defaticamento. "motion" tra: ${MOTIONS.join(', ')}. "repeat" con "recovery" per le ripetute.
Rispondi con { "title", "reason", "segments" } (reason: una frase, massimo 20 parole, senza numeri del check-in).`;
  try {
    const ai = await askJson(SEDUTA_SYSTEM, user, AiRun, { label: 'corsa', meta });
    let segs = ai.segments.map((s) => ({ ...s, repeat: s.repeat ?? undefined, recovery: s.recovery ?? undefined }) as Segment)
      .map((s) => (s.recovery ? s : (({ recovery: _r, ...rest }) => rest)(s) as Segment))
      .map((s) => (s.repeat ? s : (({ repeat: _r, ...rest }) => rest)(s) as Segment));
    if (noImpact) segs = toWalking(segs);
    const total = segmentsMinutes(segs);
    if (total > cap + 1) {
      const f = cap / total;
      segs = segs.map((g) => (isWarm(g) || g.repeat ? g : { ...g, minutes: r1(Math.max(1, g.minutes * f)) }));
      if (segmentsMinutes(segs) > cap + 1) return { ...fallback(), intensity: clampIntensity(intensity) };
    }
    return { segments: segs, reason: tidyReason(ai.reason), title: ai.title.trim().replace(/[.!]+$/, ''), source: 'ai' as const, intensity: clampIntensity(intensity) };
  } catch (err) {
    console.warn(`[corsa] segmenti di riserva: ${(err as Error).message}`);
    return { ...fallback(), intensity: clampIntensity(intensity) };
  }
}
