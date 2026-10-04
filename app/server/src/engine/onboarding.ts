import { z } from 'zod';
import { askJson, aiMode } from '../ai/claude.js';
import { ONBOARDING_SYSTEM } from '../ai/prompts/onboarding.js';
import { BODY_ZONES, content, type BodyZone } from '../content.js';
import { derive, personSummary, type Card } from './person.js';
import type { Experience, PreferredTime, Profile, Runner, Track } from './types.js';

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface OnboardingReply { reply: string; done: boolean; quickReplies?: string[]; profile?: Profile; minor?: boolean }

export const EQUIPMENT = ['sedia', 'muro', 'tappetino', 'scalino', 'elastico', 'manubri'];
const TRACK_NAME: Record<Track, string> = { corsa: 'Corsa', forza: 'Forza', mobilita: 'Mobilità' };

/** L'obiettivo decide il percorso (in dubbio: corsa). */
export function trackFromGoal(goal: string): Track {
  const t = goal.toLowerCase();
  if (/schiena|postur|rigid|collo|cervical|seduto|scrivania|mobilit|flessibil|sciolt/.test(t)) return 'mobilita';
  if (/forz|ton|muscol|sollev|braccia|gambe forti|pi[uù] fort|rassod/.test(t)) return 'forza';
  return 'corsa';
}

/** Livello di partenza: chi corre già 4 (< 20 km/sett.) o 5; altrimenti dall'esperienza. Minorenni max 3, prudenza 1. */
export function startLevelFor(p: { experience: Experience; runner?: Runner | null; age?: number | null; caution?: boolean; track?: Track }): number {
  let level = p.experience === 'qualche_volta' ? 2 : 1;
  if (p.runner && p.track === 'corsa') level = p.runner.kmPerWeek >= 20 ? 5 : 4;
  else if (p.runner) level = 3;
  if ((p.age ?? 30) < 18) level = Math.min(level, 3);
  if (p.caution) level = 1;
  return level;
}

/** Unisce scheda e conversazione e porta tutto dentro i limiti dello schema. */
export function normalizeProfile(card: Partial<Card> & { caution?: boolean }, p: Partial<Profile>): Profile {
  const experience: Experience = (['nessuna', 'poca', 'qualche_volta'] as const).includes(p.experience as Experience) ? (p.experience as Experience) : 'poca';
  const preferredTime: PreferredTime = (['mattina', 'pausa_pranzo', 'sera'] as const).includes(p.preferredTime as PreferredTime) ? (p.preferredTime as PreferredTime) : 'sera';
  const clamp = (x: unknown, lo: number, hi: number, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(Math.min(hi, Math.max(lo, x))) : d);
  const goal = (p.goal ?? '').toString().trim().slice(0, 160) || 'Muovermi con regolarità e sentirmi meglio';
  const track: Track = (['corsa', 'forza', 'mobilita'] as const).includes(p.track as Track) ? (p.track as Track) : trackFromGoal(goal);
  const r = p.runner;
  const runner: Runner | null = r && typeof r.kmPerWeek === 'number' && r.kmPerWeek > 0 ? {
    kmPerWeek: clamp(r.kmPerWeek, 1, 150, 10),
    longestRunMin: clamp(r.longestRunMin, 10, 300, 40),
    easyPaceMinKm: typeof r.easyPaceMinKm === 'number' && r.easyPaceMinKm >= 3 && r.easyPaceMinKm <= 12 ? Math.round(r.easyPaceMinKm * 10) / 10 : null,
    runGoal: (r.runGoal ?? '').toString().slice(0, 60) || goal,
  } : null;
  const health = card.health ?? { heartCondition: false, chestPain: false, dizziness: false, jointIssue: false, medication: false, pregnancy: false, otherCondition: false, notes: '' };
  const caution = card.caution ?? false;
  const profile: Profile = {
    name: String(card.name ?? p.name ?? '').trim().slice(0, 40) || 'Amico',
    age: card.age ?? p.age ?? null,
    sex: card.sex ?? 'non_dico',
    heightCm: card.heightCm ?? null,
    weightKg: card.weightKg ?? null,
    job: card.job ?? 'seduto',
    sleepHours: card.sleepHours ?? 7,
    health,
    caution,
    medicalOk: null,
    calendarUrl: null,
    track,
    runner,
    food: null,
    goal,
    experience: runner ? 'qualche_volta' : experience,
    daysPerWeek: clamp(p.daysPerWeek, 2, 6, 3),
    minutesPerSession: clamp(p.minutesPerSession, 10, runner ? 90 : 60, 20),
    equipment: [...new Set((p.equipment ?? []).filter((e) => EQUIPMENT.includes(e)))],
    limitations: [...new Set((p.limitations ?? []).filter((z): z is BodyZone => BODY_ZONES.includes(z as BodyZone)))],
    preferredTime,
    startLevel: 1,
  };
  profile.startLevel = startLevelFor(profile);
  return profile;
}

export function minorReply(): OnboardingReply {
  return {
    reply: content.text('minor.message', 'Che bello che vuoi muoverti! Sotto i 16 anni PassoPasso si usa insieme a un adulto: chiedi a un genitore, al medico o all\'allenatore della tua scuola di seguirti.'),
    done: true,
    minor: true,
  };
}

// ---------- Copione di riserva (AI spenta o in errore) ----------

type Step = 'goal' | 'experience' | 'km' | 'longest' | 'pace' | 'daysMinutes' | 'equipment' | 'pain' | 'time';
const QUESTIONS: Record<Step, { q: (name: string) => string; quick: string[] }> = {
  goal: { q: (n) => `Piacere, ${n}! Cosa ti piacerebbe riuscire a fare tra qualche mese?`, quick: ['Correre 20 minuti', 'Sentirmi più forte', 'Meno rigidità alla schiena'] },
  experience: { q: () => 'Bello. Quanto ti muovi oggi, in una settimana normale?', quick: ['Quasi mai', "Cammino un po'", 'Qualche volta', 'Corro già'] },
  km: { q: () => 'Ottimo! Quanti km corri in una settimana, più o meno?', quick: ['Meno di 10', '10-20 km', 'Più di 20 km'] },
  longest: { q: () => 'E la corsa più lunga delle ultime settimane, quanti minuti?', quick: ['30 minuti', '45 minuti', "Un'ora o più"] },
  pace: { q: () => 'A che ritmo corri comodo, in minuti al km?', quick: ['5:30', '6:00', '6:30', 'Non lo so'] },
  daysMinutes: { q: () => 'Quanti giorni a settimana puoi dedicarci, e per quanti minuti?', quick: ['2 giorni, 15 minuti', '3 giorni, 20 minuti', '4 giorni, 30 minuti'] },
  equipment: { q: () => 'Cosa hai in casa che possiamo usare?', quick: ['Niente', 'Una sedia', 'Sedia e tappetino', 'Elastico o manubri'] },
  pain: { q: () => "C'è qualche zona del corpo che ti dà fastidio o che vuoi tenere d'occhio?", quick: ['Nessuna', 'Ginocchia', 'Schiena bassa', 'Spalle'] },
  time: { q: () => 'Ultima cosa: quando preferisci allenarti?', quick: ['Mattina', 'Pausa pranzo', 'Sera'] },
};

function parseExperience(s: string): Experience {
  const t = s.toLowerCase();
  if (/qualche volta|spesso|palestra|corro|sport|regolar|abbastanza|due volte|tre volte/.test(t)) return 'qualche_volta';
  if (/quasi mai|^mai|niente|zero|per nulla|sedentari|poco o niente|non mi muovo/.test(t)) return 'nessuna';
  return 'poca';
}
const runsAlready = (s: string) => /corro|corsa regolar|faccio corsa|running|\bkm\b/.test(s.toLowerCase());
function nums(s: string) { return [...s.replace(',', '.').matchAll(/\d+(\.\d+)?/g)].map((m) => Number(m[0])); }
function parseDaysMinutes(s: string) {
  const t = s.toLowerCase();
  const n = nums(t);
  const days = Number(t.match(/(\d+)\s*(giorn|volt|sedut)/)?.[1] ?? n.find((x) => x >= 1 && x <= 7) ?? 3);
  const minutes = Number(t.match(/(\d+)\s*min/)?.[1] ?? n.find((x) => x >= 10) ?? 20);
  return { daysPerWeek: days, minutesPerSession: minutes };
}
function parseEquipment(s: string) {
  const t = s.toLowerCase();
  return EQUIPMENT.filter((e) => t.includes(e) || (e === 'tappetino' && t.includes('tappeto')) || (e === 'scalino' && /scal|gradin/.test(t))
    || (e === 'manubri' && /manubr|pesi/.test(t)) || (e === 'elastico' && /elastic/.test(t)));
}
function parseZones(s: string): BodyZone[] {
  const t = s.toLowerCase();
  if (/^(nessun|niente|no\b|tutto bene)/.test(t)) return [];
  const map: [RegExp, BodyZone][] = [
    [/ginocch/, 'ginocchia'], [/schiena alta|dorsal|scapol/, 'schiena_alta'], [/schiena bassa|lomb|schiena(?! alta)/, 'schiena_bassa'],
    [/spall/, 'spalle'], [/collo|cervical/, 'collo'], [/pols/, 'polsi'], [/anc[ah]/, 'anche'], [/cavigl/, 'caviglie'], [/bracc|gomit/, 'braccia'], [/petto/, 'petto'],
  ];
  return map.filter(([re]) => re.test(t)).map(([, z]) => z);
}
function parseTime(s: string): PreferredTime {
  const t = s.toLowerCase();
  if (/mattin|presto|colazione/.test(t)) return 'mattina';
  if (/pranzo|mezzogiorno|pausa/.test(t)) return 'pausa_pranzo';
  return 'sera';
}

function scripted(messages: ChatMessage[], card: Partial<Card> & { caution?: boolean }): OnboardingReply {
  let answers = messages.filter((m) => m.role === 'user').map((m) => m.content.trim());
  // se il client chiede ancora il nome, la prima risposta è il nome: la saltiamo
  if (!card.name && answers[0]) {
    // senza scheda (client vecchio): la prima risposta è il nome
    const w = answers[0].replace(/^(ciao|salve)[,!. ]*/i, '').replace(/^(mi chiamo|sono)\s+/i, '').split(/[\s,.!]+/)[0] ?? '';
    card = { ...card, name: w.charAt(0).toUpperCase() + w.slice(1) };
    answers = answers.slice(1);
  } else if (answers[0] && card.name && answers[0].toLowerCase().replace(/[^a-zà-ù ]/g, '').includes(card.name.toLowerCase()) && answers[0].split(/\s+/).length <= 4) answers = answers.slice(1);
  const steps: Step[] = ['goal', 'experience'];
  if (answers[1] && runsAlready(answers[1])) steps.push('km', 'longest', 'pace');
  steps.push('daysMinutes', 'equipment', 'pain', 'time');
  if (answers.length < steps.length) {
    const s = QUESTIONS[steps[answers.length]];
    return { reply: s.q(card.name ?? ''), done: false, quickReplies: s.quick };
  }
  const a = Object.fromEntries(steps.map((s, i) => [s, answers[i] ?? ''])) as Record<Step, string>;
  const km = nums(a.km ?? '');
  const runner: Runner | null = steps.includes('km') ? {
    kmPerWeek: /più di 20/i.test(a.km) ? 25 : km.length > 1 ? (km[0] + km[1]) / 2 : km[0] ?? 10,
    longestRunMin: /ora/.test(a.longest) && !nums(a.longest).length ? 60 : nums(a.longest)[0] ?? 40,
    easyPaceMinKm: (() => { const m = a.pace.match(/(\d+)[:.,](\d+)/); return m ? Number(m[1]) + Number(m[2]) / 60 : nums(a.pace)[0] ?? null; })(),
    runGoal: a.goal,
  } : null;
  const profile = normalizeProfile(card, {
    goal: a.goal, experience: parseExperience(a.experience), runner, ...parseDaysMinutes(a.daysMinutes),
    equipment: parseEquipment(a.equipment), limitations: parseZones(a.pain), preferredTime: parseTime(a.time),
  });
  return { reply: finalReply(profile), done: true, profile };
}

function finalReply(p: Profile) {
  const lvl = content.level(p.startLevel, p.track);
  return `Perfetto, ${p.name}. Percorso ${TRACK_NAME[p.track ?? 'corsa']}, si parte dal livello ${p.startLevel}: ${lvl.name}. Un passo alla volta, ci arriviamo insieme.`;
}

// ---------- Con Claude ----------

const AiProfile = z.object({
  name: z.string().nullish(),
  goal: z.string(),
  track: z.enum(['corsa', 'forza', 'mobilita']).nullish(),
  experience: z.enum(['nessuna', 'poca', 'qualche_volta']),
  runner: z.object({ kmPerWeek: z.number(), longestRunMin: z.number(), easyPaceMinKm: z.number().nullish(), runGoal: z.string().nullish() }).nullish(),
  daysPerWeek: z.number(),
  minutesPerSession: z.number(),
  equipment: z.array(z.string()),
  limitations: z.array(z.string()),
  preferredTime: z.enum(['mattina', 'pausa_pranzo', 'sera']),
});
const AiReply = z.object({
  reply: z.string().min(1).max(600),
  done: z.boolean(),
  quickReplies: z.array(z.string().max(40)).max(4).nullish(),
  profile: AiProfile.nullish(),
});

export async function onboardingStep(messages: ChatMessage[], card: Partial<Card> & { caution?: boolean }): Promise<OnboardingReply> {
  if ((card.age ?? 30) < 16) return minorReply();
  const userTurns = messages.filter((m) => m.role === 'user').length;
  if (userTurns > 14) return scripted(messages.slice(0, 22), card);
  if (aiMode() === 'off') return scripted(messages, card);
  const transcript = messages.map((m) => `${m.role === 'user' ? 'PERSONA' : 'COACH'}: ${m.content}`).join('\n');
  const scheda = card.name
    ? `SCHEDA GIÀ COMPILATA: nome ${card.name}. ${personSummary({ ...(card as Profile), limitations: [], equipment: [], experience: 'poca' })}${(card.age ?? 30) < 18 ? '\nMINORENNE (16-17 anni): tono adatto, nessuna corsa a ritmo alto.' : ''}`
    : 'SCHEDA non compilata: chiedi prima il nome.';
  try {
    const ai = await askJson(ONBOARDING_SYSTEM, `${scheda}\n\nConversazione finora:\n${transcript}\n\nScrivi il prossimo messaggio del COACH.`, AiReply, { label: 'onboarding', maxTokens: 1500 });
    if (ai.done && ai.profile) {
      const profile = normalizeProfile(card, { ...ai.profile, name: card.name ?? ai.profile.name ?? undefined, runner: ai.profile.runner ? { ...ai.profile.runner, easyPaceMinKm: ai.profile.runner.easyPaceMinKm ?? null, runGoal: ai.profile.runner.runGoal ?? '' } : null, track: ai.profile.track ?? undefined, limitations: ai.profile.limitations as BodyZone[] });
      return { reply: ai.reply, done: true, profile };
    }
    if (ai.done) return scripted(messages, card);
    return { reply: ai.reply, done: false, quickReplies: (ai.quickReplies ?? []).slice(0, 4) };
  } catch (err) {
    console.warn(`[onboarding] copione di riserva: ${(err as Error).message}`);
    return scripted(messages, card);
  }
}

export { derive };
