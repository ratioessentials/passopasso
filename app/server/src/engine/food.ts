import { z } from 'zod';
import { aiMode, askJson } from '../ai/claude.js';
import { TONO } from '../ai/prompts/tono.js';
import { content, type Habit } from '../content.js';
import { addDays, today, weekStart } from '../dates.js';
import { db } from '../db.js';
import { currentHabit, profileOf, sessionsBetween } from './store.js';
import type { FoodProfile, Profile, UserRow } from './types.js';

export const FoodSchema = z.object({
  breakfast: z.coerce.boolean(),
  veggiesPerDay: z.coerce.number().int().min(0).max(10),
  sugaryDrinks: z.enum(['mai', 'raramente', 'a_volte', 'spesso']).transform((v) => (v === 'raramente' ? 'a_volte' : v) as FoodProfile['sugaryDrinks']),
  mealsOut: z.coerce.number().int().min(0).max(21),
  cooks: z.enum(['mai', 'raramente', 'a_volte', 'spesso']),
});

type Signal = { field: string; op: 'eq' | 'in' | 'lte' | 'gte'; value: unknown; why: string; effect?: 'skip' | 'advance' };
type HabitWithSignals = Habit & { signals?: Signal[]; phase?: string };

function matches(sig: Signal, food: Record<string, unknown>): boolean {
  const v = food[sig.field];
  if (v === undefined) return false;
  switch (sig.op) {
    case 'eq': return v === sig.value;
    case 'in': return Array.isArray(sig.value) && sig.value.includes(v);
    case 'lte': return typeof v === 'number' && v <= Number(sig.value);
    case 'gte': return typeof v === 'number' && v >= Number(sig.value);
    default: return false;
  }
}

export const PHASES = [
  { id: 'sostituire', title: 'Sostituire', weeks: '1-3' },
  { id: 'aggiungere', title: 'Aggiungere', weeks: '4-7' },
  { id: 'come_mangi', title: 'Come mangi', weeks: '8-12' },
];
const phaseOf = (h: HabitWithSignals) => h.phase ?? (h.week <= 3 ? 'sostituire' : h.week <= 7 ? 'aggiungere' : 'come_mangi');

/**
 * Il percorso alimentare personalizzato: le fasi restano in ordine ("prima togli, poi aggiungi, poi impari come mangi");
 * dentro ogni fase salgono le tappe con un segnale "advance"; quelle con "skip" sono già acquisite.
 */
export function orderPath(food: Record<string, unknown> | null) {
  const habits = [...(content.habits() as HabitWithSignals[])].sort((a, b) => a.week - b.week);
  const ordered: { habit: Habit; why: string | null; phase: string }[] = [];
  const skipped: { habit: Habit; why: string; phase: string }[] = [];
  for (const ph of PHASES) {
    const inPhase = habits.filter((h) => phaseOf(h) === ph.id);
    const adv: typeof ordered = [];
    const rest: typeof ordered = [];
    for (const h of inPhase) {
      const sigs = food ? (h.signals ?? []).filter((s) => matches(s, food)) : [];
      const skip = sigs.find((s) => s.effect === 'skip');
      if (skip) { skipped.push({ habit: h, why: skip.why, phase: ph.id }); continue; }
      const advance = sigs.find((s) => s.effect === 'advance' || !s.effect);
      (advance ? adv : rest).push({ habit: h, why: advance?.why ?? null, phase: ph.id });
    }
    ordered.push(...adv, ...rest);
  }
  return { ordered, skipped };
}

/** Abitudini in ordine di percorso per questa persona (senza le tappe saltate e quelle escluse). */
export function rankHabits(food: Record<string, unknown> | null, exclude: string[] = []): { habit: Habit; why: string | null }[] {
  return orderPath(food).ordered.filter((x) => !exclude.includes(x.habit.id)).map(({ habit, why }) => ({ habit, why }));
}

// ---------- Abitudine della settimana ----------

export function setHabit(userId: string, ws: string, habitId: string, why: string | null) {
  db.prepare('INSERT INTO user_habits (user_id, week_start, habit_id, why) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, week_start) DO UPDATE SET habit_id = excluded.habit_id, why = excluded.why')
    .run(userId, ws, habitId, why);
}

export function habitFor(user: UserRow, ws = weekStart(today())): { habit: Habit; why: string | null } | null {
  const row = db.prepare('SELECT habit_id, why FROM user_habits WHERE user_id = ? AND week_start = ?').get(user.id, ws) as { habit_id: string; why: string | null } | undefined;
  const h = row && content.habits().find((x) => x.id === row.habit_id);
  if (h) return { habit: h, why: row!.why };
  // settimana nuova: se c'è il profilo alimentare, la prossima abitudine nasce dai segnali (senza ripetere le passate)
  const profile = profileOf(user);
  if (profile?.food) {
    const done = (db.prepare('SELECT habit_id FROM user_habits WHERE user_id = ?').all(user.id) as { habit_id: string }[]).map((r) => r.habit_id);
    const [first] = rankHabits(profile.food as unknown as Record<string, unknown>, done);
    if (first) { setHabit(user.id, ws, first.habit.id, first.why); return first; }
  }
  return null;
}

const ChooseSchema = z.object({ habitId: z.string(), why: z.string().min(5).max(200) });

/** Mini-onboarding alimentare → abitudine di partenza scelta per questa persona (AI tra i candidati, o regole). */
export async function saveFoodProfile(user: UserRow, food: z.infer<typeof FoodSchema>) {
  const profile = profileOf(user)!;
  db.prepare('UPDATE users SET profile = ? WHERE id = ?').run(JSON.stringify({ ...profile, food }), user.id);
  const ranked = rankHabits(food as unknown as Record<string, unknown>);
  let choice = ranked[0];
  if (aiMode() !== 'off') {
    const candidates = ranked.slice(0, 2); // l'AI sceglie tra le prime due tappe del percorso, mai fuori ordine
    try {
      const ai = await askJson(`${TONO}\n\nCOMPITO: scegli l'abitudine alimentare da cui partire per questa persona, tra i CANDIDATI. Una sola, la più utile e la più facile per lei. Mai diete, calorie, peso o numeri. "why": una frase, massimo 20 parole, che spiega la scelta partendo dalle sue risposte (es. "Bevi già abbastanza: partiamo dalla colazione, che salti spesso.").`,
        `RISPOSTE: colazione ${food.breakfast ? 'sì' : 'spesso no'}; verdura ${food.veggiesPerDay} volte al giorno; bibite zuccherate ${food.sugaryDrinks}; pasti fuori ${food.mealsOut} a settimana; cucina ${food.cooks}.
CANDIDATI:\n${candidates.map((c) => `- ${c.habit.id}: ${c.habit.title}${c.why ? ` (segnale: ${c.why})` : ''}`).join('\n')}`,
        ChooseSchema, { label: 'cibo', maxTokens: 600 });
      const pick = candidates.find((c) => c.habit.id === ai.habitId);
      if (pick && !/\d|calori|peso|dieta/i.test(ai.why)) choice = { habit: pick.habit, why: ai.why.trim() };
    } catch (err) {
      console.warn(`[cibo] scelta di riserva: ${(err as Error).message}`);
    }
  }
  setHabit(user.id, weekStart(today()), choice.habit.id, choice.why);
  return { habit: choice.habit, why: choice.why ?? `Partiamo da qui: ${choice.habit.why}` };
}

// ---------- Prima e dopo la seduta ----------

type Fuel = { slots: Record<string, { from: string; to: string }>; advice: { slot: string; type: string; before: string; after: string }[]; trackNotes?: Record<string, string>; safety?: string };
const SESSION_AT: Record<Profile['preferredTime'], string> = { mattina: '07:30', pausa_pranzo: '13:00', sera: '19:00' };
const SLOT_OF: Record<Profile['preferredTime'], string> = { mattina: 'mattina', pausa_pranzo: 'pranzo', sera: 'sera' };

export function trainingFuel(user: UserRow): { sessionAt: string; before: string; after: string; note?: string; safety?: string } | null {
  const profile = profileOf(user)!;
  const row = sessionsBetween(user.id, today(), today()).find((s) => s.status === 'planned' || s.status === 'done');
  if (!row) return null;
  let fuel: Fuel;
  try { fuel = content.fuel() as Fuel; } catch { return null; }
  const type = row.run_type === 'lungo' ? 'corsa_lunga'
    : row.segments && row.minutes >= 30 ? 'corsa'
      : row.run_type === 'forza' || (profile.track === 'forza' && user.level >= 2) ? 'forza'
        : 'leggera';
  const slot = SLOT_OF[profile.preferredTime];
  const advice = fuel.advice.find((a) => a.slot === slot && a.type === type) ?? fuel.advice.find((a) => a.slot === slot && a.type === 'leggera');
  if (!advice) return null;
  return { sessionAt: SESSION_AT[profile.preferredTime], before: advice.before, after: advice.after, note: fuel.trackNotes?.[profile.track ?? 'corsa'], safety: fuel.safety };
}

// ---------- Percorso alimentare ----------

export function foodPath(user: UserRow) {
  const profile = profileOf(user)!;
  const ws = weekStart(today());
  habitFor(user);
  const history = db.prepare('SELECT week_start, habit_id FROM user_habits WHERE user_id = ? ORDER BY week_start').all(user.id) as { week_start: string; habit_id: string }[];
  const done = history.filter((h) => h.week_start < ws).map((h) => h.habit_id);
  const current = history.find((h) => h.week_start === ws)?.habit_id ?? currentHabitId(user);
  const { ordered, skipped } = orderPath((profile.food ?? null) as Record<string, unknown> | null);
  const doneSet = new Set(done);
  const steps: { habit: Habit; order: number; status: 'done' | 'current' | 'next' | 'skipped'; phase: string; why?: string | null; skippedWhy?: string }[] = [];
  // prima le tappe fatte (nell'ordine in cui sono state fatte), poi quella di adesso, poi le prossime; le saltate nella loro fase
  const all = [...ordered.map((o) => ({ ...o, skip: null as string | null })), ...skipped.map((s) => ({ habit: s.habit, why: null, phase: s.phase, skip: s.why }))];
  const phaseIdx = (p: string) => PHASES.findIndex((x) => x.id === p);
  // per fase; dentro la fase: fatte (nell'ordine in cui sono state fatte), saltate, quella di adesso, le prossime
  const rank = (x: typeof all[0]) => {
    const group = doneSet.has(x.habit.id) ? 0 : x.habit.id === current ? 2 : x.skip ? 1 : 3;
    const within = group === 0 ? done.indexOf(x.habit.id) : ordered.findIndex((o) => o.habit.id === x.habit.id);
    return phaseIdx(x.phase) * 10000 + group * 1000 + within;
  };
  let order = 0;
  for (const x of [...all].sort((a, b) => rank(a) - rank(b))) {
    const status = x.skip && !doneSet.has(x.habit.id) && x.habit.id !== current ? 'skipped' : doneSet.has(x.habit.id) ? 'done' : x.habit.id === current ? 'current' : 'next';
    steps.push({ habit: x.habit, order: ++order, status, phase: x.phase, ...(status === 'skipped' ? { skippedWhy: x.skip! } : { why: x.why }) });
  }
  return {
    phases: PHASES.map((p) => ({ ...p, title: content.text(`foodpath.phase_${p.id}`, p.title), note: content.text(`foodpath.phase_${p.id}_note`, '') || null })),
    steps,
    intro: content.text('foodpath.intro', 'Ora che ti alleni non devi mangiare perfetto. Cambiamo una cosa sola alla volta.'),
    hasFoodProfile: !!profile.food,
  };
}

function currentHabitId(user: UserRow): string | null {
  return habitFor(user)?.habit.id ?? currentHabit(user).id;
}

// ---------- Fame dopo la seduta ----------

const AFTER_FOOD: Record<string, string> = {
  mattina: 'Avere fame adesso è normale: fai colazione come sempre, con qualcosa di proteico come yogurt o latte.',
  pranzo: 'Avere fame adesso è normale: pranza come sempre, con verdura, proteine e cereali.',
  sera: 'Avere fame adesso è normale: un frutto o uno yogurt, poi cena come sempre.',
  tardi: 'Avere fame adesso è normale: se la cena è già passata, uno yogurt o un frutto bastano.',
};

/** Una riga sulla fame dopo la seduta, per orario (content/fuel.json → afterFood, altrimenti riserva). */
export function afterFood(now = new Date()): string {
  const h = now.getHours() + now.getMinutes() / 60;
  const slot = h < 11 ? 'mattina' : h < 15 ? 'pranzo' : h < 21.5 ? 'sera' : 'tardi';
  let fromContent: unknown;
  try { fromContent = (content.fuel() as Record<string, unknown>).afterFood; } catch { /* niente fuel.json */ }
  if (fromContent && typeof fromContent === 'object') {
    if (Array.isArray(fromContent)) {
      const hit = (fromContent as { slot?: string; text?: string }[]).find((x) => x.slot === slot);
      if (hit?.text) return hit.text;
    } else {
      const map = fromContent as Record<string, string>;
      const v = map[slot] ?? (slot === 'tardi' ? map.sera : undefined);
      if (typeof v === 'string') return v;
    }
  } else if (typeof fromContent === 'string') return fromContent;
  return AFTER_FOOD[slot];
}

// ---------- Riepilogo della settimana ----------

interface MealRow { date: string; feedback: string }

export function foodRecap(user: UserRow) {
  const t = today();
  const rows = db.prepare('SELECT date, feedback FROM meals WHERE user_id = ? AND date >= ? ORDER BY date').all(user.id, addDays(t, -6)) as MealRow[];
  const fbs = rows.map((r) => JSON.parse(r.feedback) as { plate?: { veggies: number; protein: number; grains: number } | null; habitMatch?: boolean; positives?: string[] });
  const plates = fbs.map((f) => f.plate).filter((p): p is { veggies: number; protein: number; grains: number } => !!p);
  const avg = (k: 'veggies' | 'protein' | 'grains') => (plates.length ? plates.reduce((a, p) => a + p[k], 0) / plates.length : null);
  const strengths: string[] = [];
  const gaps: string[] = [];
  const v = avg('veggies'); const p = avg('protein'); const g = avg('grains');
  if (v !== null) (v >= 0.4 ? strengths : gaps).push(v >= 0.4 ? 'Tanta verdura nel piatto' : 'La verdura può avere più spazio');
  if (p !== null) (p >= 0.2 ? strengths : gaps).push(p >= 0.2 ? 'Le proteine non mancano' : 'Qualche fonte di proteine in più');
  if (g !== null && g > 0.55) gaps.push('Cereali un po\' padroni del piatto');
  const matched = fbs.filter((f) => f.habitMatch).length;
  if (matched) strengths.push(matched > 1 ? `L'abitudine della settimana si è vista ${matched} volte` : "L'abitudine della settimana si è vista nel piatto");
  if (!rows.length) gaps.push('Nessuna foto questa settimana: anche una sola aiuta a orientarsi');
  // la prossima abitudine: dai segnali del profilo e dai punti da migliorare, senza ripetere le passate
  const profile = profileOf(user)!;
  const done = (db.prepare('SELECT habit_id FROM user_habits WHERE user_id = ?').all(user.id) as { habit_id: string }[]).map((r) => r.habit_id);
  const current = habitFor(user)?.habit.id;
  const ranked = rankHabits((profile.food ?? null) as Record<string, unknown> | null, [...done, ...(current ? [current] : [])]);
  const gapPick = p !== null && p < 0.2 ? ranked.find((r) => /protein/.test(r.habit.id)) : v !== null && v < 0.4 ? ranked.find((r) => /verdur|colori|piatto/.test(r.habit.id)) : undefined;
  const next = gapPick ?? ranked[0];
  const nextWs = addDays(weekStart(t), 7);
  if (next && !db.prepare('SELECT 1 FROM user_habits WHERE user_id = ? AND week_start = ?').get(user.id, nextWs)) {
    setHabit(user.id, nextWs, next.habit.id, gapPick ? `Dalle tue foto: ${gaps[0]?.toLowerCase() ?? 'un passo in più'}.` : next.why);
  }
  const chosen = habitFor(user, nextWs);
  return {
    photos: rows.length,
    strengths,
    gaps,
    nextHabit: chosen?.habit ?? next?.habit ?? null,
    why: chosen?.why ?? next?.why ?? (chosen ? chosen.habit.why : 'Un passo alla volta.'),
  };
}
