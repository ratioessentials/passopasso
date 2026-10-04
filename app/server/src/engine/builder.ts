import { z } from 'zod';
import { askJson } from '../ai/claude.js';
import { SEDUTA_SYSTEM } from '../ai/prompts/seduta.js';
import { content, type BodyZone, type Category, type Exercise, type SessionTemplate } from '../content.js';
import type { DraftSession, Item, Profile } from './types.js';

const ZONE_LABEL: Record<string, string> = {
  collo: 'collo', spalle: 'spalle', schiena_alta: 'schiena alta', schiena_bassa: 'schiena bassa', petto: 'petto',
  braccia: 'braccia', polsi: 'polsi', anche: 'anche', ginocchia: 'ginocchia', caviglie: 'caviglie',
};
const zonesText = (zones: string[]) => {
  const l = zones.map((z) => ZONE_LABEL[z] ?? z);
  return l.length <= 1 ? l.join('') : `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`;
};

export const clampIntensity = (x: number) => Math.round(Math.min(1.3, Math.max(0.7, x)) * 100) / 100;

/** Il muro c'è in ogni casa: lo consideriamo sempre disponibile. */
const available = (equipment: string[]) => new Set([...equipment, 'muro']);

export interface Filter { level: number; equipment: string[]; pain: BodyZone[]; watch?: BodyZone[] }

/** Regole 3 e 4 del motore: livello, attrezzatura, zone doloranti. */
export function isAllowed(ex: Exercise, f: Filter): boolean {
  const eq = available(f.equipment);
  return ex.minLevel <= f.level && ex.equipment.every((e) => eq.has(e)) && !ex.zones.some((z) => f.pain.includes(z));
}

export function allowedExercises(f: Filter): Exercise[] {
  return content.exercises().filter((e) => isAllowed(e, f));
}

/** Se l'esercizio non va bene, risale la catena delle regressioni finché ne trova uno consentito. */
function withRegression(ex: Exercise, f: Filter): Exercise | null {
  let cur: Exercise | undefined = ex;
  for (let i = 0; cur && i < 5; i++) {
    if (isAllowed(cur, f)) return cur;
    cur = cur.regression ? content.exercise(cur.regression) : undefined;
  }
  return null;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Sceglie `count` esercizi di una categoria: i più vicini al livello, con rotazione per varietà. */
function pick(category: Category, count: number, f: Filter, seed: string, opts: { easy?: boolean; taken: Set<string> }): Exercise[] {
  const all = content.exercises().filter((e) => e.category === category && e.minLevel <= f.level);
  const candidates: Exercise[] = [];
  for (const ex of all) {
    const ok = withRegression(ex, f);
    if (ok && !candidates.some((c) => c.id === ok.id)) candidates.push(ok);
  }
  const target = opts.easy ? Math.max(1, f.level - 1) : f.level;
  // le zone da tenere d'occhio (profilo) non escludono, ma fanno preferire alternative
  const score = (e: Exercise) => -Math.abs(e.minLevel - target) * 10 - e.zones.filter((z) => f.watch?.includes(z)).length * 6 + (hash(seed + e.id) % 7);
  const sorted = candidates.filter((c) => !opts.taken.has(c.id)).sort((a, b) => score(b) - score(a));
  const chosen = sorted.slice(0, count);
  chosen.forEach((c) => opts.taken.add(c.id));
  return chosen;
}

/** Il cardio principale della seduta: quello lungo più adatto al livello (camminata → corsa). */
function pickMainCardio(f: Filter, easy: boolean, taken: Set<string>): Exercise | null {
  const target = easy ? Math.max(1, f.level - 1) : f.level;
  const long = content.exercises()
    .filter((e) => e.category === 'cardio' && e.minLevel <= target && e.prescription.type === 'seconds' && e.prescription.default >= 300)
    .sort((a, b) => b.minLevel - a.minLevel || b.prescription.default - a.prescription.default);
  for (const ex of long) {
    const ok = withRegression(ex, f);
    if (ok && !taken.has(ok.id)) { taken.add(ok.id); return ok; }
  }
  // dolori alle gambe: un cardio dolce che non le carica
  const any = content.exercises()
    .filter((e) => e.category === 'cardio' && isAllowed(e, f) && !taken.has(e.id))
    .sort((a, b) => b.prescription.default - a.prescription.default);
  if (any[0]) taken.add(any[0].id);
  return any[0] ?? null;
}

const round5 = (x: number) => Math.max(5, Math.round(x / 5) * 5);
/** Secondi "da telefono": multipli di 5 sotto i 2 minuti, di 30 sopra. */
const roundSecs = (x: number) => (x < 120 ? round5(x) : Math.max(120, Math.round(x / 30) * 30));

export const REASON_MAX = 160;
/** Tiene la reason breve: se l'AI si dilunga, resta la prima frase; se anche quella è lunga, si taglia a una pausa. */
export function tidyReason(text: string): string {
  let r = text.replace(/\s+/g, ' ').trim();
  if (r.length <= REASON_MAX) return r;
  const first = r.match(/^.+?[.!?](\s|$)/)?.[0].trim();
  if (first && first.length >= 30 && first.length <= REASON_MAX) return first;
  const cut = r.slice(0, REASON_MAX);
  const at = Math.max(cut.lastIndexOf(':'), cut.lastIndexOf(';'), cut.lastIndexOf(','));
  r = (at > 60 ? cut.slice(0, at) : cut.slice(0, cut.lastIndexOf(' '))).trim();
  return `${r.replace(/[,:;]$/, '')}.`;
}
const tidyNote = (n: string) => {
  const t = n.replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '').slice(0, 60);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export function dose(ex: Exercise, opts: { intensity: number; level: number; timeRatio: number; energy?: number; cardioSeconds?: number }): Item {
  const { intensity, level, timeRatio, energy = 3 } = opts;
  const lowEnergy = energy <= 2;
  if (ex.category === 'cardio' && opts.cardioSeconds) {
    const secs = Math.max(120, Math.round((opts.cardioSeconds * timeRatio * intensity) / 30) * 30);
    return { exerciseId: ex.id, sets: 1, seconds: secs, restSec: 30 };
  }
  let sets = 1;
  let restSec = 20;
  if (ex.category === 'forza' || ex.category === 'cardio') {
    sets = level >= 3 ? 3 : 2;
    if (timeRatio < 0.8 || lowEnergy) sets -= 1;
    sets = Math.max(1, sets);
    restSec = lowEnergy ? 60 : 45;
  }
  const item: Item = { exerciseId: ex.id, sets, restSec };
  if (ex.prescription.type === 'reps') item.reps = Math.max(3, Math.round(ex.prescription.default * intensity));
  else item.seconds = round5(ex.prescription.default * intensity);
  return item;
}

export interface BuildInput {
  level: number;
  template: SessionTemplate;
  minutes: number;
  intensity: number;
  profile: Profile;
  pain?: BodyZone[];
  energy?: number;
  seed: string;
  easy?: boolean;
}

/** Seduta di riserva costruita a regole da `sessionTemplate` (regola 5). */
export function buildRuleItems(input: BuildInput): Item[] {
  const f: Filter = { level: input.level, equipment: input.profile.equipment, pain: input.pain ?? [], watch: input.profile.limitations };
  const timeRatio = Math.min(1.5, Math.max(0.4, input.minutes / input.template.minutes));
  const easy = input.easy || (input.energy ?? 3) <= 2;
  const taken = new Set<string>();
  const items: Item[] = [];
  for (const block of input.template.blocks) {
    let count = block.count;
    if (block.category === 'forza' || block.category === 'mobilita') {
      if (timeRatio < 0.75) count -= 1;
      if (timeRatio > 1.25) count += 1;
    }
    if (block.category === 'riscaldamento' && timeRatio < 0.6) count -= 1;
    count = Math.max(block.category === 'forza' ? 1 : 0, count);
    if (block.category === 'riscaldamento' || block.category === 'defaticamento') count = Math.max(1, count);
    if (count === 0) continue;
    let chosen: Exercise[];
    if (block.category === 'cardio' && block.seconds) {
      const main = pickMainCardio(f, easy, taken);
      chosen = main ? [main] : [];
    } else {
      chosen = pick(block.category, count, f, input.seed, { easy, taken });
    }
    for (const ex of chosen) {
      items.push(dose(ex, { intensity: input.intensity, level: input.level, timeRatio, energy: input.energy, cardioSeconds: block.category === 'cardio' ? block.seconds : undefined }));
    }
  }
  return items;
}

export function ruleTitle(level: number): string {
  const l = content.level(level);
  return `${l.verb} e forza`;
}

export function ruleReason(input: { level: number; minutes: number; templateMinutes: number; energy?: number; pain?: string[] }): string {
  const causes: string[] = [];
  const effects: string[] = [];
  if (input.pain?.length) { causes.push(`${zonesText(input.pain)} da proteggere`); effects.push(`niente esercizi su ${zonesText(input.pain)}`); }
  if (input.minutes < input.templateMinutes * 0.85) { causes.push('poco tempo'); effects.push('seduta compatta'); }
  if (input.energy !== undefined && input.energy <= 2) { causes.push('poca energia'); effects.push('ritmo tranquillo e pause più lunghe'); }
  else if (input.energy !== undefined && input.energy >= 5) { causes.push('energia alta'); effects.push('spingiamo un pelo di più'); }
  if (!causes.length) {
    const goal = content.level(input.level).goal;
    return `Seduta piena del livello ${input.level}: un passo verso "${goal.charAt(0).toLowerCase()}${goal.slice(1)}".`;
  }
  const c = causes.length > 1 ? `${causes.slice(0, -1).join(', ')} e ${causes[causes.length - 1]}` : causes[0];
  return tidyReason(`${c.charAt(0).toUpperCase()}${c.slice(1)}: ${effects.join(', ')}.`);
}

// ---------- Generazione con Claude ----------

const AiSession = z.object({
  title: z.string().min(2).max(60),
  reason: z.string().min(10).max(400),
  items: z.array(z.object({
    exerciseId: z.string(),
    sets: z.number().int().min(1).max(5),
    reps: z.number().int().min(1).max(60).nullish(),
    seconds: z.number().int().min(5).max(3600).nullish(),
    restSec: z.number().int().min(0).max(180),
    note: z.string().max(80).nullish(),
  })).min(3).max(12),
});

export interface CheckinInput { minutes: number; energy: number; pain: BodyZone[] }

/**
 * Check-in → seduta. L'AI riceve solo gli esercizi già filtrati e la risposta viene verificata:
 * id sconosciuti scartati, dosaggi riportati nei limiti, riscaldamento e defaticamento garantiti.
 * Se l'AI non risponde o fallisce: seduta a regole.
 */
export async function generateSession(opts: {
  level: number; profile: Profile; intensity: number; checkin: CheckinInput; seed: string; template?: SessionTemplate; kindNote?: string; easy?: boolean;
}): Promise<DraftSession> {
  const lvl = content.level(opts.level);
  const template = opts.template ?? lvl.sessionTemplate;
  const { minutes, energy, pain } = opts.checkin;
  const intensity = clampIntensity(opts.intensity * (energy <= 2 ? 0.85 : energy >= 5 ? 1.05 : 1));
  const f: Filter = { level: opts.level, equipment: opts.profile.equipment, pain, watch: opts.profile.limitations };
  const allowed = allowedExercises(f);
  const buildInput: BuildInput = { level: opts.level, template, minutes, intensity, profile: opts.profile, pain, energy, seed: opts.seed, easy: opts.easy };
  const fallback = (): DraftSession => ({
    minutes, intensity,
    title: ruleTitle(opts.level),
    reason: ruleReason({ level: opts.level, minutes, templateMinutes: template.minutes, energy, pain }),
    items: buildRuleItems(buildInput),
    source: 'rules',
  });

  const list = allowed.map((e) => `${e.id} | ${e.name} | ${e.category} | liv ${e.minLevel} | zone: ${e.zones.join(',') || '-'} | ${e.prescription.type} default ${e.prescription.default}`).join('\n');
  const user = `PERSONA: ${opts.profile.name}, obiettivo "${opts.profile.goal}", esperienza ${opts.profile.experience}. Zone da tenere d'occhio da profilo: ${opts.profile.limitations.join(', ') || 'nessuna'}.
LIVELLO ${lvl.n} "${lvl.name}" (${lvl.verb}). Obiettivo del livello: ${lvl.goal}.${typeof lvl.cardioGuide === 'string' ? `\nGuida al cardio: ${lvl.cardioGuide}` : ''}
STRUTTURA DEL LIVELLO (per ${template.minutes} minuti): ${template.blocks.map((b) => `${b.category} x${b.count}${b.seconds ? ` (${Math.round(b.seconds / 60)} min)` : ''}`).join(', ')}.${opts.kindNote ? `\nNOTA: ${opts.kindNote}` : ''}

CHECK-IN DI OGGI: ${minutes} minuti disponibili, energia ${energy}/5, dolori: ${pain.length ? zonesText(pain) : 'nessuno'}.
INTENSITÀ da applicare: ${intensity} (1.0 = normale).

ESERCIZI CONSENTITI (id | nome | categoria | livello minimo | zone | prescrizione):
${list}`;

  try {
    const ai = await askJson(SEDUTA_SYSTEM, user, AiSession, { label: 'seduta' });
    const byId = new Map(allowed.map((e) => [e.id, e]));
    const items: Item[] = [];
    const seen = new Set<string>();
    let dropped = 0;
    for (const it of ai.items) {
      const ex = byId.get(it.exerciseId);
      if (!ex || seen.has(ex.id)) { dropped++; continue; }
      seen.add(ex.id);
      const item: Item = { exerciseId: ex.id, sets: it.sets, restSec: it.restSec };
      if (ex.prescription.type === 'reps') item.reps = Math.min(Math.max(1, it.reps ?? Math.round(ex.prescription.default * intensity)), Math.ceil(ex.prescription.default * 1.6));
      else item.seconds = roundSecs(Math.min(Math.max(10, it.seconds ?? ex.prescription.default * intensity), Math.max(ex.prescription.default * 2, 60 * minutes)));
      item.sets = Math.min(item.sets, 4);
      item.restSec = Math.min(120, round5(Math.max(15, item.restSec)));
      if (it.note && tidyNote(it.note)) item.note = tidyNote(it.note);
      items.push(item);
    }
    if (dropped) console.warn(`[seduta] scartati ${dropped} esercizi non consentiti dalla risposta dell'AI`);
    if (items.length < 3) return fallback();
    // riscaldamento e defaticamento sempre presenti
    const taken = new Set(items.map((i) => i.exerciseId));
    const cat = (i: Item) => byId.get(i.exerciseId)!.category;
    for (const must of ['riscaldamento', 'defaticamento'] as const) {
      if (!items.some((i) => cat(i) === must)) {
        const [ex] = pick(must, 1, f, opts.seed, { taken });
        if (ex) {
          const it = dose(ex, { intensity, level: opts.level, timeRatio: 1, energy });
          must === 'riscaldamento' ? items.unshift(it) : items.push(it);
        }
      }
    }
    const order: Category[] = ['riscaldamento', 'cardio', 'forza', 'mobilita', 'defaticamento'];
    items.sort((a, b) => order.indexOf(cat(a)) - order.indexOf(cat(b)));
    return { minutes, intensity, title: ai.title.trim().replace(/[.!]+$/, ''), reason: tidyReason(ai.reason), items, source: 'ai' };
  } catch (err) {
    console.warn(`[seduta] uso la seduta di riserva: ${(err as Error).message}`);
    return fallback();
  }
}
