import { z } from 'zod';
import { content } from '../content.js';
import type { Profile } from './types.js';

/** La scheda "chi sei + salute" (PAR-Q+), compilata nel form prima della conversazione. */
export const HealthSchema = z.object({
  heartCondition: z.boolean().default(false),
  chestPain: z.boolean().default(false),
  dizziness: z.boolean().default(false),
  jointIssue: z.boolean().default(false),
  medication: z.boolean().default(false),
  pregnancy: z.boolean().default(false),
  otherCondition: z.boolean().default(false),
  notes: z.string().max(500).default(''),
});
export type Health = z.infer<typeof HealthSchema>;

export const CardSchema = z.object({
  name: z.string().trim().min(1).max(40),
  age: z.coerce.number().int().min(8).max(110),
  sex: z.enum(['f', 'm', 'altro', 'non_dico']).default('non_dico'),
  heightCm: z.coerce.number().min(100).max(230).nullish(),
  weightKg: z.coerce.number().min(25).max(350).nullish(),
  job: z.enum(['seduto', 'in_piedi', 'fisico']).default('seduto'),
  sleepHours: z.coerce.number().min(2).max(14).default(7),
  health: HealthSchema.default({} as never),
});
export type Card = z.infer<typeof CardSchema>;

/** Per PATCH: tutti i campi facoltativi (il peso vuoto non cambia il peso salvato). */
export const CardPatchSchema = CardSchema.partial().extend({ health: HealthSchema.partial().optional() });

const CAUTION_KEYS = ['heartCondition', 'chestPain', 'dizziness', 'medication', 'pregnancy', 'otherCondition'] as const;

/** Modalità prudenza: almeno un "sì" nel PAR-Q+, tranne il problema articolare da solo. */
export function cautionFromHealth(h?: Partial<Health> | null): boolean {
  return !!h && CAUTION_KEYS.some((k) => h[k] === true);
}

/** Messaggio di prudenza deterministico (testi di copy.json), dal "sì" più importante. */
export function cautionMessage(h?: Partial<Health> | null): string | null {
  if (!h) return null;
  if (h.chestPain) return content.text('profile.caution_chest', 'Hai segnalato dolore al petto: è importante sentire un medico prima di allenarti. Se il dolore è forte o improvviso, chiama il 112.');
  if (h.heartCondition || h.medication) return content.text('profile.caution_heart', 'Hai segnalato un problema al cuore o alla pressione: prima di iniziare parlane con il tuo medico. Nel frattempo ti propongo solo camminata, mobilità e respirazione.');
  if (h.dizziness) return content.text('profile.caution_dizziness', 'Hai segnalato capogiri o svenimenti: prima di aumentare l\'attività parlane con il tuo medico. Intanto partiamo molto piano.');
  if (h.pregnancy) return content.text('profile.caution_pregnancy', 'In gravidanza muoversi fa bene, con il via libera del medico o dell\'ostetrica. Intanto ti propongo solo attività dolci.');
  if (h.otherCondition) return content.text('profile.caution_other', 'Con una condizione cronica è meglio un parere del medico prima di aumentare lo sforzo. Intanto partiamo con attività dolci.');
  if (h.jointIssue) return content.text('profile.caution_joint', 'Terremo d\'occhio quella zona: esercizi più dolci e niente salti finché non sta meglio.');
  return null;
}

export function bmiOf(p: Partial<Profile>): number | null {
  if (!p.heightCm || !p.weightKg) return null;
  const m = p.heightCm / 100;
  return Math.round((p.weightKg / (m * m)) * 10) / 10;
}

export function bmiBand(bmi: number | null): string {
  if (bmi === null) return 'non nota';
  if (bmi < 18.5) return 'sotto la norma';
  if (bmi < 25) return 'nella norma';
  if (bmi < 30) return 'sopra la norma';
  if (bmi < 35) return 'obesità di primo grado';
  return 'obesità di secondo grado o oltre';
}

export interface Derived {
  bmi: number | null;
  impactAllowed: boolean;
  cardioCap: number | null;   // minuti di cardio continuo, null = nessun limite
  caution: boolean;           // prudenza attiva (senza via libera del medico)
  minor: boolean;
  maxLevel: number;
}

/** Derivati dal server (regola 4b), mai salvati. */
export function derive(p: Partial<Profile>): Derived {
  const bmi = bmiOf(p);
  const caution = !!p.caution;
  const age = p.age ?? 30;
  const impactAllowed = !(caution || (bmi !== null && bmi >= 30) || p.health?.jointIssue || age >= 65);
  let cap: number | null = p.runner ? null : p.experience === 'qualche_volta' ? 30 : p.experience === 'poca' ? 20 : 15;
  if (cap !== null || caution || age >= 65 || (bmi ?? 0) >= 35) {
    cap ??= 40;
    if (caution) cap = Math.min(cap, 10);
    if (age >= 65) cap = Math.min(cap, 15);
    if ((bmi ?? 0) >= 35) cap = Math.min(cap, 10);
    else if ((bmi ?? 0) >= 30) cap = Math.min(cap, 15);
  }
  return { bmi, impactAllowed, cardioCap: cap, caution, minor: age < 18, maxLevel: age < 18 ? 3 : 5 };
}

/** Intensità di partenza: età ≥ 65 o sonno < 6 h → 0.9. */
export const startIntensity = (p: Partial<Profile>) => ((p.age ?? 30) >= 65 || (p.sleepHours ?? 7) < 6 ? 0.9 : 1.0);

const SEX: Record<string, string> = { f: 'donna', m: 'uomo', altro: 'altro', non_dico: 'non indicato' };
const JOB: Record<string, string> = { seduto: 'lavoro seduto', in_piedi: 'lavoro in piedi', fisico: 'lavoro fisico' };

/** Riassunto della persona per i prompt: contesto per i dosaggi, da non citare mai nei testi. */
export function personSummary(p: Profile): string {
  const d = derive(p);
  const h = p.health;
  const conditions = h ? [
    h.heartCondition && 'problema cardiaco o pressione alta', h.chestPain && 'dolore al petto segnalato', h.dizziness && 'capogiri o svenimenti',
    h.jointIssue && 'problema articolare', h.medication && 'farmaci per cuore o pressione', h.pregnancy && 'gravidanza', h.otherCondition && 'altra condizione cronica',
  ].filter(Boolean) : [];
  const parts = [
    p.age ? `${p.age} anni` : null,
    p.sex ? SEX[p.sex] : null,
    `BMI ${bmiBand(d.bmi)}`,
    p.job ? JOB[p.job] : null,
    p.sleepHours ? `dorme circa ${p.sleepHours} ore` : null,
    conditions.length ? `condizioni: ${conditions.join(', ')}` : 'nessuna condizione segnalata',
    h?.notes ? `note: ${h.notes.slice(0, 200)}` : null,
    d.impactAllowed ? null : 'niente esercizi ad impatto',
    d.cardioCap ? `cardio continuo al massimo ${d.cardioCap} minuti` : null,
    d.caution ? 'PRUDENZA: solo camminata, mobilità e respirazione' : null,
    p.runner ? `corre già: ${p.runner.kmPerWeek} km a settimana, corsa più lunga ${p.runner.longestRunMin} min` : null,
  ].filter(Boolean);
  return `${parts.join('; ')}.\n(Contesto riservato per i dosaggi: NON citare mai peso, BMI, corpo o età nei testi per la persona.)`;
}

/** Il profilo come lo vede il client: il peso non torna mai indietro. */
export function publicProfile(p: Profile | null) {
  if (!p) return null;
  const { weightKg: _w, ...rest } = p;
  const d = derive(p);
  return { ...rest, impactAllowed: d.impactAllowed, cardioCap: d.cardioCap, hasWeight: typeof p.weightKg === 'number' };
}
