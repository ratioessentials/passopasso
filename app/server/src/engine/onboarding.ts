import { z } from 'zod';
import { askJson, aiMode } from '../ai/claude.js';
import { ONBOARDING_SYSTEM } from '../ai/prompts/onboarding.js';
import { BODY_ZONES, type BodyZone } from '../content.js';
import type { Experience, PreferredTime, Profile } from './types.js';

export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface OnboardingReply { reply: string; done: boolean; quickReplies?: string[]; profile?: Profile }

const EQUIPMENT = ['sedia', 'muro', 'tappetino', 'scalino'];

export function startLevelFor(experience: Experience): number {
  return experience === 'qualche_volta' ? 2 : 1;
}

/** Porta un profilo (dall'AI o dal copione) dentro i limiti dello schema. */
export function normalizeProfile(p: Partial<Profile> & { name: string }): Profile {
  const experience: Experience = (['nessuna', 'poca', 'qualche_volta'] as const).includes(p.experience as Experience) ? (p.experience as Experience) : 'poca';
  const preferredTime: PreferredTime = (['mattina', 'pausa_pranzo', 'sera'] as const).includes(p.preferredTime as PreferredTime) ? (p.preferredTime as PreferredTime) : 'sera';
  const clamp = (x: unknown, lo: number, hi: number, d: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(Math.min(hi, Math.max(lo, x))) : d);
  return {
    name: String(p.name).trim().slice(0, 40) || 'Amico',
    age: typeof p.age === 'number' && p.age > 0 && p.age < 110 ? Math.round(p.age) : null,
    goal: (p.goal ?? '').toString().trim().slice(0, 160) || 'Muovermi con regolarità e sentirmi meglio',
    experience,
    daysPerWeek: clamp(p.daysPerWeek, 2, 6, 3),
    minutesPerSession: clamp(p.minutesPerSession, 10, 45, 20),
    equipment: [...new Set((p.equipment ?? []).filter((e) => EQUIPMENT.includes(e)))],
    limitations: [...new Set((p.limitations ?? []).filter((z): z is BodyZone => BODY_ZONES.includes(z as BodyZone)))],
    preferredTime,
    startLevel: startLevelFor(experience),
  };
}

// ---------- Copione di riserva (AI spenta o in errore) ----------

const SCRIPT: { q: (name: string) => string; quick: string[] }[] = [
  { q: (n) => `Piacere, ${n}! Quanto ti muovi in una settimana normale?`, quick: ['Quasi mai', "Cammino un po'", 'Qualche volta'] },
  { q: () => 'Bello. Cosa ti piacerebbe riuscire a fare tra qualche mese?', quick: ['Correre 20 minuti', 'Fare le scale senza fiatone', 'Sentirmi più in forma'] },
  { q: () => 'Quanti giorni a settimana puoi dedicarci, e per quanti minuti?', quick: ['2 giorni, 15 minuti', '3 giorni, 20 minuti', '4 giorni, 30 minuti'] },
  { q: () => 'Cosa hai in casa che possiamo usare?', quick: ['Niente', 'Una sedia', 'Sedia e tappetino', 'Sedia, tappetino e scalino'] },
  { q: () => "C'è qualche zona del corpo che ti dà fastidio o che vuoi tenere d'occhio?", quick: ['Nessuna', 'Ginocchia', 'Schiena bassa', 'Spalle'] },
  { q: () => 'Ultima cosa: quando preferisci allenarti?', quick: ['Mattina', 'Pausa pranzo', 'Sera'] },
];

function parseName(s: string) {
  const cleaned = s.replace(/^(ciao|salve|hey)[,!. ]*/i, '').replace(/^(mi chiamo|sono|io sono|il mio nome è)\s+/i, '').trim();
  const w = (cleaned.split(/[\s,.!]+/)[0] || s.trim()).slice(0, 30);
  return w.charAt(0).toUpperCase() + w.slice(1);
}
function parseExperience(s: string): Experience {
  const t = s.toLowerCase();
  if (/qualche volta|spesso|palestra|corro|sport|regolar|abbastanza|due volte|tre volte/.test(t)) return 'qualche_volta';
  if (/quasi mai|^mai|niente|zero|per nulla|sedentari|poco o niente|non mi muovo/.test(t)) return 'nessuna';
  return 'poca';
}
function parseDaysMinutes(s: string) {
  const t = s.toLowerCase();
  const nums = [...t.matchAll(/\d+/g)].map((m) => Number(m[0]));
  const days = Number(t.match(/(\d+)\s*(giorn|volt|sedut)/)?.[1] ?? nums.find((n) => n >= 1 && n <= 7) ?? 3);
  const minutes = Number(t.match(/(\d+)\s*min/)?.[1] ?? nums.find((n) => n >= 10) ?? 20);
  return { daysPerWeek: days, minutesPerSession: minutes };
}
function parseEquipment(s: string) {
  const t = s.toLowerCase();
  return EQUIPMENT.filter((e) => t.includes(e) || (e === 'tappetino' && t.includes('tappeto')) || (e === 'scalino' && /scal|gradin/.test(t)));
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

function scripted(messages: ChatMessage[]): OnboardingReply {
  const answers = messages.filter((m) => m.role === 'user').map((m) => m.content);
  const name = parseName(answers[0] ?? '');
  const step = answers.length; // 1 = ha detto il nome
  if (step <= SCRIPT.length) {
    const s = SCRIPT[Math.max(0, step - 1)];
    return { reply: s.q(name), done: false, quickReplies: s.quick };
  }
  const experience = parseExperience(answers[1] ?? '');
  const profile = normalizeProfile({
    name, experience, goal: answers[2], ...parseDaysMinutes(answers[3] ?? ''),
    equipment: parseEquipment(answers[4] ?? ''), limitations: parseZones(answers[5] ?? ''), preferredTime: parseTime(answers[6] ?? ''),
  });
  return { reply: finalReply(profile), done: true, profile };
}

const LEVEL_NAMES: Record<number, string> = { 1: 'Attivazione', 2: 'Fondamenta' };
function finalReply(p: Profile) {
  return `Perfetto, ${p.name}. Si parte dal livello ${p.startLevel}: ${LEVEL_NAMES[p.startLevel] ?? ''}. Un passo alla volta, ci arriviamo insieme.`;
}

// ---------- Con Claude ----------

const AiProfile = z.object({
  name: z.string().min(1),
  age: z.number().nullish(),
  goal: z.string(),
  experience: z.enum(['nessuna', 'poca', 'qualche_volta']),
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

export async function onboardingStep(messages: ChatMessage[]): Promise<OnboardingReply> {
  const userTurns = messages.filter((m) => m.role === 'user').length;
  // conversazione troppo lunga: chiudiamo con quello che abbiamo
  if (userTurns > 12) return scripted(messages.slice(0, 1 + 2 * SCRIPT.length + 1));
  if (aiMode() === 'off') return scripted(messages);
  const transcript = messages.map((m) => `${m.role === 'user' ? 'UTENTE' : 'COACH'}: ${m.content}`).join('\n');
  try {
    const ai = await askJson(ONBOARDING_SYSTEM, `Conversazione finora:\n${transcript}\n\nScrivi il prossimo messaggio del COACH.`, AiReply, { label: 'onboarding', maxTokens: 1500 });
    if (ai.done && ai.profile) {
      const profile = normalizeProfile({ ...ai.profile, equipment: ai.profile.equipment, limitations: ai.profile.limitations as BodyZone[] });
      return { reply: ai.reply, done: true, profile };
    }
    if (ai.done) return scripted(messages);
    return { reply: ai.reply, done: false, quickReplies: (ai.quickReplies ?? []).slice(0, 4) };
  } catch (err) {
    console.warn(`[onboarding] copione di riserva: ${(err as Error).message}`);
    return scripted(messages);
  }
}
