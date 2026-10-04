import { content, type BodyZone, type Exercise } from '../content.js';
import type { DraftSession, Item, Segment } from './types.js';

/**
 * Invarianti (regola 7b): controlli puri eseguiti su OGNI seduta prima di salvarla, che venga dall'AI o dalle regole.
 * Il codice calcola lo spazio delle soluzioni sicure, l'AI sceglie dentro quello spazio, il codice ricontrolla tutto.
 */

export interface CheckContext {
  minutes: number;            // minuti disponibili (check-in) o della seduta pianificata
  pain: BodyZone[];
  impactAllowed: boolean;
  redFlags: string[];         // bandiere rosse del check-in (se ce ne sono, nessuna seduta)
}

export interface Check { id: string; label: string; passed: boolean; detail?: string }

export const CHECK_LABELS: Record<string, string> = {
  no_pain_zones: 'Nessun esercizio sulle zone doloranti',
  duration_ok: 'Durata entro i minuti che hai',
  warmup_cooldown: 'Riscaldamento e defaticamento presenti',
  dosage_limits: 'Ripetizioni e tempi entro i limiti del catalogo',
  no_impact: 'Niente salti né corsa se l\'impatto non va bene per te',
  reason_safe: 'Spiegazione senza peso, numeri sul corpo o colpa',
  no_red_flag: 'Nessuna seduta con un sintomo da bandiera rossa',
};

const ex = (id: string): Exercise | undefined => content.exercise(id);
const isWarm = (s: Segment) => /riscald/i.test(s.label);
const isCool = (s: Segment) => /defatic/i.test(s.label);
const IMPACT_MOTIONS = new Set(['corsa', 'corsetta', 'scatto', 'jumping_jack']);

/** Stima della durata in secondi: lavoro + recuperi + 15 s di cambio tra un esercizio e l'altro. */
export function estimateSeconds(d: Pick<DraftSession, 'items' | 'segments'>): number {
  if (d.segments?.length) {
    return Math.round(d.segments.reduce((a, s) => a + ((s.minutes + (s.recovery?.minutes ?? 0)) * (s.repeat ?? 1) - (s.repeat && s.recovery ? s.recovery.minutes : 0)) * 60, 0));
  }
  return d.items.reduce((a, i) => {
    const work = i.seconds ?? (i.reps ?? 0) * 4;
    return a + i.sets * work + Math.max(0, i.sets - 1) * i.restSec + 15;
  }, 0);
}

/** Parole vietate nella reason: numeri sul corpo, peso, diete, colpa. */
const REASON_FORBIDDEN = /\b\d+([.,]\d+)?\s?(kg|chili|chilo|kili)\b|\bpeso\b|\bbmi\b|indice di massa|sovrappeso|obes|grass[oa]|dimagr|calori|dieta|colpa|dovresti|\bdevi\b|pigr|hai saltato|vergogn|delus/i;

export function dosageOk(i: Item): boolean {
  const e = ex(i.exerciseId);
  if (!e) return false;
  if (i.sets < 1 || i.sets > 4 || i.restSec < 0 || i.restSec > 120) return false;
  if (e.prescription.type === 'reps') return typeof i.reps === 'number' && i.reps >= 1 && i.reps <= Math.ceil(e.prescription.default * 1.6) && i.seconds === undefined;
  return typeof i.seconds === 'number' && i.seconds >= 5 && i.seconds <= Math.max(e.prescription.default * 2, 3600) && i.reps === undefined;
}

export function runChecks(d: Pick<DraftSession, 'items' | 'segments' | 'reason'>, ctx: CheckContext): Check[] {
  const items = d.items;
  const segs = d.segments ?? null;
  const est = estimateSeconds(d) / 60;
  const painHits = items.filter((i) => ex(i.exerciseId)?.zones.some((z) => ctx.pain.includes(z)));
  const impactHits = ctx.impactAllowed ? [] : [
    ...items.filter((i) => ex(i.exerciseId)?.impact).map((i) => i.exerciseId),
    ...(segs ?? []).filter((s) => IMPACT_MOTIONS.has(s.motion) || (s.recovery && IMPACT_MOTIONS.has(s.recovery.motion))).map((s) => s.label),
  ];
  const cats = new Set(items.map((i) => ex(i.exerciseId)?.category));
  const hasWarm = segs?.length ? segs.some(isWarm) || cats.has('riscaldamento') : cats.has('riscaldamento');
  const hasCool = segs?.length ? segs.some(isCool) || cats.has('defaticamento') : cats.has('defaticamento');
  const badDose = items.filter((i) => !dosageOk(i));
  const out: Check[] = [
    { id: 'no_pain_zones', passed: painHits.length === 0, detail: painHits.map((i) => i.exerciseId).join(', ') || undefined },
    // la seduta non deve mai superare il tempo che hai (+10%); più corta va bene, ma non vuota
    { id: 'duration_ok', passed: est <= ctx.minutes * 1.1 + 0.5 && est >= Math.min(5, ctx.minutes * 0.4), detail: `${Math.round(est)} min stimati su ${ctx.minutes}` },
    { id: 'warmup_cooldown', passed: hasWarm && hasCool },
    { id: 'dosage_limits', passed: badDose.length === 0, detail: badDose.map((i) => i.exerciseId).join(', ') || undefined },
    { id: 'no_impact', passed: impactHits.length === 0, detail: impactHits.join(', ') || undefined },
    { id: 'reason_safe', passed: !REASON_FORBIDDEN.test(d.reason ?? '') },
    { id: 'no_red_flag', passed: ctx.redFlags.length === 0 },
  ].map((c) => ({ ...c, label: CHECK_LABELS[c.id] }));
  return out;
}

const failed = (checks: Check[]) => checks.filter((c) => !c.passed).map((c) => c.id);

/**
 * Applica gli invarianti: corregge quando si può (togli l'esercizio, riporta i dosaggi nei limiti, accorcia,
 * passa alla camminata, riscrivi la reason); se resta una violazione, chi chiama usa la seduta di riserva.
 */
export function enforce<T extends DraftSession>(draft: T, ctx: CheckContext, opts: { safeReason: string }): { draft: T; before: string[]; after: string[]; repaired: boolean; checks: Check[] } {
  const before = failed(runChecks(draft, ctx));
  if (!before.length) return { draft, before, after: [], repaired: false, checks: runChecks(draft, ctx) };
  const d: T = { ...draft, items: draft.items.map((i) => ({ ...i })), segments: draft.segments?.map((s) => ({ ...s, recovery: s.recovery ? { ...s.recovery } : undefined })) ?? draft.segments };
  // (1) e (5): via gli esercizi sulle zone doloranti o ad impatto vietato, e quelli sconosciuti
  d.items = d.items.filter((i) => {
    const e = ex(i.exerciseId);
    return e && !e.zones.some((z) => ctx.pain.includes(z)) && !(!ctx.impactAllowed && e.impact);
  });
  if (!ctx.impactAllowed && d.segments) {
    const walk = <S extends { label: string; motion: string; rpe: number }>(s: S): S => (IMPACT_MOTIONS.has(s.motion) ? { ...s, motion: 'camminata_veloce', rpe: Math.min(s.rpe, 5) } : s);
    d.segments = d.segments.map((s) => ({ ...walk(s), ...(s.recovery ? { recovery: walk(s.recovery) } : {}) }));
  }
  // (4) dosaggi nei limiti del catalogo
  d.items = d.items.map((i) => {
    const e = ex(i.exerciseId)!;
    const it: Item = { ...i, sets: Math.min(4, Math.max(1, i.sets)), restSec: Math.min(120, Math.max(0, i.restSec)) };
    if (e.prescription.type === 'reps') { it.reps = Math.min(Math.ceil(e.prescription.default * 1.6), Math.max(1, it.reps ?? e.prescription.default)); delete it.seconds; }
    else { it.seconds = Math.min(Math.max(e.prescription.default * 2, 3600), Math.max(5, it.seconds ?? e.prescription.default)); delete it.reps; }
    return it;
  });
  // (2) troppo lunga: meno serie, poi cardio più corto, poi via l'ultimo esercizio di forza
  const limit = (ctx.minutes * 1.1 + 0.5) * 60;
  for (let guard = 0; guard < 30 && estimateSeconds(d) > limit; guard++) {
    if (d.segments?.length) {
      const main = [...d.segments].filter((s) => !isWarm(s) && !isCool(s) && !s.repeat).sort((a, b) => b.minutes - a.minutes)[0];
      if (main && main.minutes > 3) { main.minutes = Math.max(3, Math.round((main.minutes - (estimateSeconds(d) - limit) / 60 - 0.5) * 4) / 4); continue; }
      const rep = d.segments.find((s) => s.repeat && s.repeat > 2);
      if (rep) { rep.repeat! -= 1; continue; }
      break;
    }
    const multi = [...d.items].filter((i) => i.sets > 1).sort((a, b) => b.sets - a.sets)[0];
    if (multi) { multi.sets -= 1; continue; }
    const cardio = d.items.find((i) => ex(i.exerciseId)?.category === 'cardio' && (i.seconds ?? 0) > 180);
    if (cardio) { cardio.seconds = Math.max(120, Math.round(((cardio.seconds ?? 0) - (estimateSeconds(d) - limit)) / 30) * 30); continue; }
    const strengthIdx = d.items.map((i) => ex(i.exerciseId)?.category).lastIndexOf('forza');
    if (strengthIdx >= 0 && d.items.length > 3) { d.items.splice(strengthIdx, 1); continue; }
    break;
  }
  // (6) reason sicura
  if (REASON_FORBIDDEN.test(d.reason ?? '')) d.reason = opts.safeReason;
  if (d.segments) d.minutes = Math.round(estimateSeconds(d) / 60);
  const checks = runChecks(d, ctx);
  return { draft: d, before, after: failed(checks), repaired: true, checks };
}

/** Esercizi esclusi dal filtro per questa persona e oggi, con il motivo (per "Perché questa seduta"). */
export function exclusions(f: { level: number; equipment: string[]; pain: BodyZone[]; noImpact?: boolean; cautionOnly?: boolean }, isAllowed: (e: Exercise) => boolean) {
  const eq = new Set([...f.equipment, 'muro']);
  const ZL: Record<string, string> = { schiena_alta: 'la schiena alta', schiena_bassa: 'la schiena bassa' };
  const out: { exerciseId: string; name: string; reason: string }[] = [];
  for (const e of content.exercises()) {
    if (isAllowed(e) || e.minLevel > f.level) continue; // quelli di livello superiore non sono "esclusi", non sono ancora arrivati
    const z = e.zones.find((x) => f.pain.includes(x));
    const reason = z ? `coinvolge ${ZL[z] ?? `le ${z}`.replace('le collo', 'il collo').replace('le petto', 'il petto').replace('le polsi', 'i polsi')}`
      : f.noImpact && e.impact ? 'impatto non consentito'
        : f.cautionOnly ? 'in prudenza solo camminata, mobilità e respiro'
          : e.equipment.some((x) => !eq.has(x)) ? `serve: ${e.equipment.filter((x) => !eq.has(x)).join(', ')}`
            : 'non adatto oggi';
    out.push({ exerciseId: e.id, name: e.name, reason });
  }
  return out;
}
