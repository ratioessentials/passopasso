import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

export type BodyZone = 'collo' | 'spalle' | 'schiena_alta' | 'schiena_bassa' | 'petto' | 'braccia' | 'polsi' | 'anche' | 'ginocchia' | 'caviglie';
export const BODY_ZONES: BodyZone[] = ['collo', 'spalle', 'schiena_alta', 'schiena_bassa', 'petto', 'braccia', 'polsi', 'anche', 'ginocchia', 'caviglie'];
export type Category = 'riscaldamento' | 'cardio' | 'forza' | 'mobilita' | 'defaticamento';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  minLevel: number;
  zones: BodyZone[];
  equipment: string[];
  prescription: { type: 'reps' | 'seconds'; default: number };
  instructions: string[];
  commonMistakes: string[];
  regression: string | null;
  progression: string | null;
  formCheck: boolean;
  impact?: boolean;
  motion?: string | null;
}
export interface Block { category: Category; count: number; seconds?: number }
export interface SessionTemplate { minutes: number; blocks: Block[] }
export interface Level {
  n: number; name: string; verb: string; goal: string; weeks: number[]; sessionsPerWeek: number;
  sessionTemplate: SessionTemplate;
  readiness: { minSessions: number; minConsistency: number; maxHardFeedbackLast3: number } | null;
  [k: string]: unknown;
}
export interface Program {
  levels: Level[];
  restartSession: { title?: string; intensity?: number; bonusPoints: number; sessionTemplate: SessionTemplate };
  tracks?: Record<string, unknown>;
  [k: string]: unknown;
}
export interface Habit { id: string; week: number; title: string; why: string; tips: string[]; photoPrompt: string }
export interface RedFlag { id: string; label: string; message: string; urgent: boolean }
export interface WinDef { id: string; title: string; condition: unknown; icon?: string; [k: string]: unknown }

/** Legge da CONTENT_DIR se il file esiste, altrimenti dalle fixture. Ricarica quando il file cambia. */
const cache = new Map<string, { mtime: number; file: string; data: unknown }>();
function load<T>(name: string): T {
  const real = path.join(config.contentDir, name);
  const file = fs.existsSync(real) ? real : path.join(config.fixturesDir, name);
  const mtime = fs.statSync(file).mtimeMs;
  const hit = cache.get(name);
  if (hit && hit.file === file && hit.mtime === mtime) return hit.data as T;
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8')) as T;
    cache.set(name, { mtime, file, data });
    return data;
  } catch (err) {
    // JSON in scrittura o rotto: tieni l'ultima versione buona
    if (hit) return hit.data as T;
    if (file === real) return JSON.parse(fs.readFileSync(path.join(config.fixturesDir, name), 'utf8')) as T;
    throw err;
  }
}

export const content = {
  exercises: () => load<Exercise[]>('exercises.json'),
  exercise: (id: string) => load<Exercise[]>('exercises.json').find((e) => e.id === id),
  program: () => load<Program>('program.json'),
  /** Livello base, con le sostituzioni del percorso (`tracks.<track>.levels`) se ci sono. */
  level: (n: number, track?: string): Level => {
    const program = load<Program>('program.json');
    const base = program.levels.find((l) => l.n === n) ?? program.levels[0];
    if (!track) return base;
    const tracks = (program.tracks ?? load<Program>('tracks.json').tracks) as Record<string, { levels?: unknown }> | undefined;
    const tl = tracks?.[track]?.levels;
    const over = (Array.isArray(tl) ? tl.find((l) => (l as Level).n === n) ?? tl[n - 1] : (tl as Record<string, unknown> | undefined)?.[String(n)]) as Partial<Level> | undefined;
    return over ? { ...base, ...over, n: base.n, name: base.name } as Level : base;
  },
  tracks: () => {
    const program = load<Program>('program.json');
    return (program.tracks ?? load<Program>('tracks.json').tracks ?? {}) as Record<string, Record<string, unknown>>;
  },
  habits: () => load<Habit[]>('habits.json'),
  redFlags: () => load<RedFlag[]>('red_flags.json'),
  wins: () => load<WinDef[]>('wins.json'),
  copy: () => load<Record<string, string>>('copy.json'),
  text: (key: string, fallback: string) => {
    const v = load<Record<string, unknown>>('copy.json')[key];
    return typeof v === 'string' && v ? v : fallback;
  },
  sources: () => Object.fromEntries(
    ['exercises.json', 'program.json', 'habits.json', 'red_flags.json', 'wins.json', 'copy.json'].map((n) => [
      n, fs.existsSync(path.join(config.contentDir, n)) ? 'content' : 'fixtures',
    ]),
  ),
};
