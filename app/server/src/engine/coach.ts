import { z } from 'zod';
import { aiMode, askJson } from '../ai/claude.js';
import { COACH_SYSTEM } from '../ai/prompts/coach.js';
import { BODY_ZONES, type BodyZone, type RedFlag } from '../content.js';
import { addDays, today, weekday, weekStart } from '../dates.js';
import { db } from '../db.js';
import { freeSlots, loadBusy, suggestDays, type FreeSlot } from './calendar.js';
import { detectRedFlag, normalize } from './redflags.js';
import { personSummary } from './person.js';
import { getUser, levelInfo, profileOf, replanFrom, sessionsBetween, sessionsPerWeek, updateSession } from './store.js';
import type { PreferredTime, Profile, UserRow } from './types.js';

export interface CoachMessage { role: 'user' | 'assistant'; content: string }
export interface CoachReply { reply: string; quickReplies: string[]; applied: string[]; redFlag: RedFlag | null }

const EQUIPMENT = ['sedia', 'muro', 'tappetino', 'scalino', 'elastico', 'manubri'] as const;
const ZONE_LABEL: Record<string, string> = { schiena_alta: 'schiena alta', schiena_bassa: 'schiena bassa' };
const zl = (z: string) => ZONE_LABEL[z] ?? z;
const TIME_LABEL: Record<PreferredTime, string> = { mattina: 'mattina', pausa_pranzo: 'pausa pranzo', sera: 'sera' };
const DAY = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const joinIt = (l: string[]) => (l.length > 1 ? `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}` : l[0] ?? '');

const Changes = z.object({
  limitationsAdd: z.array(z.string()).nullish(),
  limitationsRemove: z.array(z.string()).nullish(),
  daysPerWeek: z.number().nullish(),
  minutesPerSession: z.number().nullish(),
  preferredTime: z.enum(['mattina', 'pausa_pranzo', 'sera']).nullish(),
  equipmentAdd: z.array(z.string()).nullish(),
  equipmentRemove: z.array(z.string()).nullish(),
  goal: z.string().max(160).nullish(),
  healthAdd: z.array(z.string()).nullish(),
  healthRemove: z.array(z.string()).nullish(),
  healthNote: z.string().max(200).nullish(),
  medicalClearance: z.boolean().nullish(),
  sleepHours: z.number().nullish(),
  job: z.enum(['seduto', 'in_piedi', 'fisico']).nullish(),
  replanWeek: z.boolean().nullish(),
  useFreeSlots: z.boolean().nullish(),
});
type Changes = z.infer<typeof Changes>;

const AiCoach = z.object({
  reply: z.string().min(1).max(500),
  quickReplies: z.array(z.string().max(40)).max(4).nullish(),
  changes: Changes.nullish(),
});

// ---------- Applicazione delle modifiche (validate dal server) ----------

export function applyChanges(user: UserRow, ch: Changes, slots: FreeSlot[] | null): string[] {
  const profile = profileOf(user)!;
  const next: Profile = { ...profile, limitations: [...profile.limitations], equipment: [...profile.equipment] };
  const applied: string[] = [];
  const zones = (l?: string[] | null) => (l ?? []).map((z) => z.toLowerCase().trim()).filter((z): z is BodyZone => BODY_ZONES.includes(z as BodyZone));

  const add = zones(ch.limitationsAdd).filter((z) => !next.limitations.includes(z));
  const remove = zones(ch.limitationsRemove).filter((z) => next.limitations.includes(z) && !add.includes(z));
  if (add.length) { next.limitations.push(...add); applied.push(`Da tenere d'occhio: ${joinIt(add.map(zl))}`); }
  if (remove.length) { next.limitations = next.limitations.filter((z) => !remove.includes(z)); applied.push(`Di nuovo libero: ${joinIt(remove.map(zl))}`); }

  if (typeof ch.daysPerWeek === 'number') {
    const d = Math.round(Math.min(6, Math.max(2, ch.daysPerWeek)));
    if (d !== profile.daysPerWeek) { next.daysPerWeek = d; applied.push(`Giorni a settimana: ${d}`); }
  }
  if (typeof ch.minutesPerSession === 'number') {
    const m = Math.round(Math.min(45, Math.max(10, ch.minutesPerSession)) / 5) * 5;
    if (m !== profile.minutesPerSession) { next.minutesPerSession = m; applied.push(`Minuti per seduta: ${m}`); }
  }
  if (ch.preferredTime && ch.preferredTime !== profile.preferredTime) {
    next.preferredTime = ch.preferredTime;
    applied.push(`Momento preferito: ${TIME_LABEL[ch.preferredTime]}`);
  }
  const eqAdd = (ch.equipmentAdd ?? []).filter((e) => (EQUIPMENT as readonly string[]).includes(e) && !next.equipment.includes(e));
  const eqRemove = (ch.equipmentRemove ?? []).filter((e) => next.equipment.includes(e));
  if (eqAdd.length) { next.equipment.push(...eqAdd); applied.push(`Attrezzatura: + ${joinIt(eqAdd)}`); }
  if (eqRemove.length) { next.equipment = next.equipment.filter((e) => !eqRemove.includes(e)); applied.push(`Attrezzatura: − ${joinIt(eqRemove)}`); }
  const goal = ch.goal?.trim();
  if (goal && goal.length >= 3 && normalize(goal) !== normalize(profile.goal)) { next.goal = goal; applied.push(`Nuovo obiettivo: ${goal}`); }

  // scheda: salute, sonno, lavoro
  const H_LABEL: Record<string, string> = {
    heartCondition: 'problema al cuore o pressione', chestPain: 'dolore al petto', dizziness: 'capogiri', jointIssue: 'problema articolare',
    medication: 'farmaci per cuore o pressione', pregnancy: 'gravidanza', otherCondition: 'condizione cronica',
  };
  const health = { ...(profile.health ?? { heartCondition: false, chestPain: false, dizziness: false, jointIssue: false, medication: false, pregnancy: false, otherCondition: false, notes: '' }) };
  const hAdd = (ch.healthAdd ?? []).filter((k) => k in H_LABEL && !(health as Record<string, unknown>)[k]);
  const hRemove = (ch.healthRemove ?? []).filter((k) => k in H_LABEL && (health as Record<string, unknown>)[k] && !hAdd.includes(k));
  for (const k of hAdd) (health as Record<string, unknown>)[k] = true;
  for (const k of hRemove) (health as Record<string, unknown>)[k] = false;
  if (ch.healthNote?.trim()) health.notes = [health.notes, ch.healthNote.trim()].filter(Boolean).join('; ').slice(0, 500);
  if (hAdd.length || hRemove.length || ch.healthNote?.trim()) {
    next.health = health;
    if (hAdd.length) applied.push(`Scheda: ${joinIt(hAdd.map((k) => H_LABEL[k]))}`);
    if (hRemove.length) applied.push(`Scheda: tolto ${joinIt(hRemove.map((k) => H_LABEL[k]))}`);
    if (!hAdd.length && !hRemove.length) applied.push('Scheda aggiornata');
  }
  const cautionKeys = ['heartCondition', 'chestPain', 'dizziness', 'medication', 'pregnancy', 'otherCondition'];
  const newCaution = hAdd.some((k) => cautionKeys.includes(k));
  const anyCaution = cautionKeys.some((k) => (health as Record<string, unknown>)[k]);
  if (newCaution && !profile.caution) { next.caution = true; next.medicalOk = null; applied.push('Modalità prudenza: camminata, mobilità e respiro'); }
  else if (!anyCaution && profile.caution) { next.caution = false; applied.push('Modalità prudenza disattivata'); }
  else if (ch.medicalClearance && profile.caution && !newCaution) { next.caution = false; next.medicalOk = today(); applied.push('Via libera del medico: si sblocca tutto il piano'); }
  if (typeof ch.sleepHours === 'number' && ch.sleepHours >= 2 && ch.sleepHours <= 14 && ch.sleepHours !== profile.sleepHours) {
    next.sleepHours = Math.round(ch.sleepHours * 2) / 2; applied.push(`Ore di sonno: ${next.sleepHours}`);
  }
  if (ch.job && ch.job !== profile.job) { next.job = ch.job; applied.push(`Lavoro: ${ch.job.replace('_', ' ')}`); }

  const profileChanged = applied.length > 0;
  if (profileChanged) db.prepare('UPDATE users SET profile = ? WHERE id = ?').run(JSON.stringify(next), user.id);

  const planChanged = next.caution !== profile.caution || add.length || remove.length || next.daysPerWeek !== profile.daysPerWeek || next.minutesPerSession !== profile.minutesPerSession || eqAdd.length || eqRemove.length;
  const fresh = getUser(user.id)!;
  if (ch.useFreeSlots && slots?.length) {
    const { dates } = suggestDays(slots, sessionsPerWeek(fresh, next), next);
    const placed = replanFrom(fresh, next, { prefer: dates, pain: next.limitations, weeks: 2 }).filter((d) => dates.includes(d));
    applied.push(placed.length ? `Sedute spostate negli spazi liberi: ${joinIt(placed.map((d) => DAY[weekday(d)]))}` : 'Settimana riorganizzata');
  } else if (planChanged || ch.replanWeek) {
    replanFrom(fresh, next, { pain: next.limitations });
    applied.push('Settimana riorganizzata');
  }
  return applied;
}

// ---------- Contesto per l'AI ----------

async function calendarSlots(profile: Profile): Promise<FreeSlot[] | null> {
  const url = (profile as Profile & { calendarUrl?: string }).calendarUrl;
  if (!url) return null;
  try {
    return freeSlots(await loadBusy(url), profile.minutesPerSession + 15);
  } catch (err) {
    console.warn(`[coach] calendario non leggibile: ${(err as Error).message}`);
    return null;
  }
}

function context(user: UserRow, profile: Profile, slots: FreeSlot[] | null): string {
  const t = today();
  const info = levelInfo(user);
  const ws = weekStart(t);
  const week = sessionsBetween(user.id, ws, addDays(ws, 6))
    .map((s) => `- ${DAY[weekday(s.date)]} ${s.date}${s.date === t ? ' (oggi)' : ''}: ${s.title}, ${s.minutes} min, ${s.kind}, stato ${s.status}`).join('\n') || '- nessuna seduta';
  const { calendarUrl, weightKg: _w, heightCm: _h, ...visible } = profile;
  const slotText = slots === null
    ? (calendarUrl ? 'collegato ma non leggibile ora' : 'non collegato')
    : slots.length ? slots.slice(0, 14).map((s) => `${DAY[weekday(s.date)]} ${s.date} ${s.start}-${s.end}`).join('; ') : 'collegato, nessuno spazio libero';
  return `OGGI: ${DAY[weekday(t)]} ${t}.
PROFILO: ${JSON.stringify(visible)}
CHI È: ${personSummary(profile)}
LIVELLO: ${info.n} "${info.name}" (${info.verb}), avanzamento ${Math.round(info.progress * 100)}%, costanza ${info.consistency}/100.
SETTIMANA:
${week}
CALENDARIO (spazi liberi nei prossimi 7 giorni): ${slotText}`;
}

// ---------- Riserva senza AI ----------

const ZONE_WORDS: [RegExp, BodyZone][] = [
  [/ginocch/, 'ginocchia'], [/schiena alta|dorsal/, 'schiena_alta'], [/schiena|lomb/, 'schiena_bassa'], [/spall/, 'spalle'], [/collo|cervical/, 'collo'],
  [/pols/, 'polsi'], [/anc[ah]/, 'anche'], [/cavigl/, 'caviglie'], [/bracc|gomit/, 'braccia'],
];

function ruleCoach(text: string, profile: Profile, slots: FreeSlot[] | null): { reply: string; quickReplies: string[]; changes: Changes } {
  const t = normalize(text);
  const changes: Changes = {};
  const zones = ZONE_WORDS.filter(([re]) => re.test(t)).map(([, z]) => z);
  if (zones.length && /passat|meglio|guarit|non fa piu male/.test(t)) changes.limitationsRemove = zones;
  else if (zones.length) changes.limitationsAdd = zones;
  if (/poco tempo|pochissimo tempo|impegnat|di corsa|settimana piena|lavoro tanto/.test(t)) changes.minutesPerSession = Math.max(10, profile.minutesPerSession - 5);
  const days = t.match(/(\d)\s*(giorni|volte)/);
  if (days) changes.daysPerWeek = Number(days[1]);
  if (/(di|la|al) mattin/.test(t)) changes.preferredTime = 'mattina';
  else if (/pausa pranzo|a pranzo/.test(t)) changes.preferredTime = 'pausa_pranzo';
  else if (/(di|la) sera/.test(t)) changes.preferredTime = 'sera';
  if (/pressione alta|ipertes|problema al cuore|cardiopat/.test(t)) { changes.healthAdd = ['heartCondition']; changes.healthNote = 'Segnalato al coach: pressione o cuore'; }
  if (/diabet|asma/.test(t)) { changes.healthAdd = [...(changes.healthAdd ?? []), 'otherCondition']; }
  if (/incinta|gravidanza/.test(t)) changes.healthAdd = [...(changes.healthAdd ?? []), 'pregnancy'];
  if (/medico.*(via libera|ok|posso allenarmi)|via libera del medico|ok dal medico/.test(t)) changes.medicalClearance = true;
  if (/spazi liberi|spostale|sposta le sedute|si, sposta|si sposta/.test(t) && slots?.length) changes.useFreeSlots = true;
  if (/calendari/.test(t) && slots !== null && !changes.useFreeSlots) {
    const { suggestion } = suggestDays(slots, profile.daysPerWeek, profile);
    return { reply: `Il calendario è già collegato. ${suggestion}`, quickReplies: ['Sì, spostale', 'Lascia così'], changes };
  }
  if (/calendari/.test(t) && slots === null && !changes.useFreeSlots) {
    return { reply: 'Tocca "Collega il calendario" e incolla il link iCal: così trovo gli spazi liberi per le sedute.', quickReplies: ['Collega il calendario'], changes };
  }
  const any = Object.keys(changes).length > 0;
  return {
    reply: any ? 'Capito, ho adattato il piano a questa settimana. Andiamo avanti con calma.' : 'Ti ascolto. Se cambia qualcosa tra tempo, dolori, giorni o orari, dimmelo e adatto il piano.',
    quickReplies: any ? ['Va bene', 'Grazie'] : ['Questa settimana ho poco tempo', 'Ho un dolore nuovo'],
    changes,
  };
}

// mi faccio vomitare, digiuno per dimagrire, salto i pasti per dimagrire, mi abbuffo, mi sento in colpa quando mangio…
const FOOD_RISK = /mi faccio vomitare|vomito dopo (i pasti|mangiato|aver mangiato)|(digiun|salt\w* (i )?pasti|non mangio)\w* .{0,20}(dimagr|perdere peso|compensare)|mi abbuff|abbuffat|in colpa (quando|dopo aver|se) mang|(brucia|compens)\w* quello che (ho )?mangi/;

// ---------- Messaggio ----------

export async function coachMessage(user: UserRow, messages: CoachMessage[]): Promise<CoachReply> {
  const profile = profileOf(user)!;
  const last = messages[messages.length - 1].content;

  // 1. Bandiere rosse sul testo: deterministico, prima dell'AI
  const redFlag = detectRedFlag(last);
  if (redFlag) {
    const applied: string[] = [];
    const todayRow = sessionsBetween(user.id, today(), today()).find((s) => s.status === 'planned');
    if (todayRow) { updateSession(todayRow.id, { status: 'blocked' }); applied.push('Seduta di oggi in pausa'); }
    return { reply: redFlag.message, quickReplies: ['Ok, oggi riposo', 'Ho scritto male'], applied, redFlag };
  }

  // 1b. Segnali di rapporto difficile con il cibo: risposta di cura, deterministica
  if (FOOD_RISK.test(normalize(last))) {
    return {
      reply: 'Grazie di avermelo detto, non è una cosa da poco. Su questo non ti do consigli sul cibo: parlane con il tuo medico o con un centro per i disturbi alimentari, ti sapranno aiutare davvero.',
      quickReplies: ['Va bene', 'Parliamo d\'altro'],
      applied: [],
      redFlag: null,
    };
  }

  const slots = await calendarSlots(profile);
  let result: { reply: string; quickReplies: string[]; changes: Changes };
  if (aiMode() === 'off') {
    result = ruleCoach(last, profile, slots);
  } else {
    const transcript = messages.slice(-20).map((m) => `${m.role === 'user' ? 'PERSONA' : 'COACH'}: ${m.content}`).join('\n');
    try {
      const ai = await askJson(COACH_SYSTEM, `${context(user, profile, slots)}\n\nCONVERSAZIONE:\n${transcript}\n\nScrivi la risposta del COACH all'ultimo messaggio.`, AiCoach, { label: 'coach', maxTokens: 1500 });
      result = { reply: ai.reply.trim(), quickReplies: (ai.quickReplies ?? []).slice(0, 3), changes: ai.changes ?? {} };
    } catch (err) {
      console.warn(`[coach] risposta di riserva: ${(err as Error).message}`);
      result = ruleCoach(last, profile, slots);
    }
  }
  const applied = applyChanges(user, result.changes, slots);
  return { reply: result.reply, quickReplies: result.quickReplies, applied, redFlag: null };
}

// ---------- Calendario ----------

export async function connectCalendar(user: UserRow, url: string) {
  const profile = profileOf(user)!;
  const busy = await loadBusy(url);
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 86400_000);
  const eventsNext7Days = busy.filter((b) => b.end > now && b.start < in7).length;
  const slots = freeSlots(busy, profile.minutesPerSession + 15);
  const { suggestion } = suggestDays(slots, sessionsPerWeek(user, profile), profile);
  db.prepare('UPDATE users SET profile = ? WHERE id = ?').run(JSON.stringify({ ...profile, calendarUrl: url }), user.id);
  return { ok: true, eventsNext7Days, freeSlots: slots, suggestion };
}

export function disconnectCalendar(user: UserRow) {
  const { calendarUrl: _drop, ...rest } = profileOf(user)! as Profile & { calendarUrl?: string };
  db.prepare('UPDATE users SET profile = ? WHERE id = ?').run(JSON.stringify(rest), user.id);
  return { ok: true };
}

