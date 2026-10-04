import cron from 'node-cron';
import { z } from 'zod';
import { aiMode, askJson } from '../ai/claude.js';
import { TONO } from '../ai/prompts/tono.js';
import { content } from '../content.js';
import { addDays, diffDays, today, weekday, weekStart } from '../dates.js';
import { db } from '../db.js';
import { readiness } from './health.js';
import { sendTo } from './push.js';
import { allSessions, getUser, profileOf, rid, sessionsBetween, updateSession } from './store.js';
import type { Segment, SessionRow, UserRow } from './types.js';

/**
 * Coach proattivo: trigger deterministici su sedute, feedback, prontezza e aperture dell'app.
 * Il codice decide SE e PERCHÉ scrivere; l'AI scrive solo il testo (con filtro di tono e testo di riserva).
 */

export const TRIGGERS = ['ripartenza_fatta', 'assenza_3_giorni', 'pattern_giorno_saltato', 'due_duro', 'prontezza_bassa_2gg', 'record_personale', 'fine_settimana_1', 'inizio_settimana_2', 'livello_nuovo'] as const;
export type Trigger = typeof TRIGGERS[number];
const WITH_WHY: Trigger[] = ['assenza_3_giorni', 'livello_nuovo', 'inizio_settimana_2'];
const CAN_FOLLOW_YESTERDAY: Trigger[] = ['prontezza_bassa_2gg', 'record_personale'];
const PRIORITY: Trigger[] = ['livello_nuovo', 'ripartenza_fatta', 'record_personale', 'prontezza_bassa_2gg', 'due_duro', 'assenza_3_giorni', 'pattern_giorno_saltato', 'inizio_settimana_2', 'fine_settimana_1'];

const DAY_CODE = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'];
const DAY_NAME = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

export interface Action { label: string; type: 'move_day'; from: string; to: string }
interface Candidate { trigger: Trigger; key: string; because: string; facts: Record<string, string | number>; actions?: Action[] }

// ---------- Aperture dell'app ----------

export function recordOpen(userId: string) {
  db.prepare('INSERT OR IGNORE INTO app_opens (user_id, date) VALUES (?, ?)').run(userId, today());
}

// ---------- Trigger (funzioni pure sui dati) ----------

/** Minuti di cardio continuo di una seduta: il segmento più lungo, o l'esercizio cardio più lungo. */
export function continuousCardio(s: SessionRow): number {
  if (s.segments) {
    const segs = JSON.parse(s.segments) as Segment[];
    return Math.max(0, ...segs.filter((g) => !/riscald|defatic/i.test(g.label)).map((g) => g.minutes));
  }
  const items = JSON.parse(s.items) as { exerciseId: string; seconds?: number }[];
  return Math.max(0, ...items.filter((i) => content.exercise(i.exerciseId)?.category === 'cardio' && i.seconds).map((i) => Math.round(i.seconds! / 60)));
}

export function candidates(user: UserRow, t = today()): Candidate[] {
  const out: Candidate[] = [];
  const all = allSessions(user.id).filter((s) => s.date <= t);
  const done = all.filter((s) => s.status === 'done');
  const recent = (s: SessionRow) => s.date >= addDays(t, -1);

  // la ripartenza appena fatta
  const restart = done.filter((s) => s.kind === 'ripartenza' && recent(s)).pop();
  if (restart) out.push({ trigger: 'ripartenza_fatta', key: restart.id, because: 'Ti scrivo perché hai completato la ripartenza', facts: { minuti: restart.minutes } });

  // nuovo livello
  const lv = db.prepare('SELECT n, from_date FROM level_history WHERE user_id = ? ORDER BY rowid DESC LIMIT 1').get(user.id) as { n: number; from_date: string } | undefined;
  const firstLevel = (db.prepare('SELECT MIN(n) AS n FROM level_history WHERE user_id = ?').get(user.id) as { n: number | null }).n;
  if (lv && lv.from_date >= addDays(t, -1) && firstLevel !== null && lv.n > firstLevel) {
    out.push({ trigger: 'livello_nuovo', key: `livello_${lv.n}`, because: `Ti scrivo perché hai raggiunto il livello ${lv.n}`, facts: { livello: lv.n, nome: content.level(lv.n, profileOf(user)?.track).name } });
  }

  // record personale di cardio continuo
  const last = done.filter((s) => recent(s) && s.kind !== 'importata').pop();
  if (last) {
    const best = continuousCardio(last);
    const before = Math.max(0, ...done.filter((s) => s.id !== last.id && s.date <= last.date).map(continuousCardio));
    if (best >= 5 && before > 0 && best > before) {
      out.push({ trigger: 'record_personale', key: `record_${last.id}`, because: `Ti scrivo perché hai fatto ${best} minuti di fila: il tuo record`, facts: { minuti: best, prima: before } });
    }
  }

  // prontezza bassa da due giorni
  const r0 = readiness(user.id, t);
  const r1 = readiness(user.id, addDays(t, -1));
  const low = (r: ReturnType<typeof readiness>) => !!r && (r.level === 'bassa' || r.signals.length >= 2);
  if (low(r0) && low(r1)) out.push({ trigger: 'prontezza_bassa_2gg', key: `pront_${t}`, because: 'Ti scrivo perché da due giorni i tuoi dati dicono stanchezza', facts: { segnali: r0!.signals.join('; ') } });

  // due sedute dure di fila
  const lastTwo = done.filter((s) => s.kind !== 'importata').slice(-2);
  if (lastTwo.length === 2 && lastTwo.every((s) => s.feedback === 'duro') && recent(lastTwo[1])) {
    out.push({ trigger: 'due_duro', key: `duro_${lastTwo[1].id}`, because: 'Ti scrivo perché le ultime due sedute ti sono sembrate dure', facts: {} });
  }

  // assenza: niente aperture né sedute da 3 giorni (ma ci si era già visti)
  const lastOpen = (db.prepare('SELECT MAX(date) AS d FROM app_opens WHERE user_id = ?').get(user.id) as { d: string | null }).d;
  const lastDone = done.at(-1)?.date ?? null;
  const lastSeen = [lastOpen, lastDone].filter(Boolean).sort().pop() ?? null;
  if (lastSeen && lastSeen <= addDays(t, -3) && user.start_date && user.start_date <= addDays(t, -4)) {
    out.push({ trigger: 'assenza_3_giorni', key: `assenza_${lastSeen}`, because: 'Ti scrivo perché non ci sentiamo da qualche giorno', facts: { giorni: diffDays(t, lastSeen) } });
  }

  // lo stesso giorno della settimana salta spesso (2 volte nelle ultime 3 settimane)
  const from = addDays(weekStart(t), -21);
  const missed = all.filter((s) => s.date >= from && s.date < weekStart(t) && (s.status === 'skipped' || (s.status === 'planned' && s.date < t)) && s.kind === 'normale');
  const byDay = new Map<number, number>();
  for (const s of missed) byDay.set(weekday(s.date), (byDay.get(weekday(s.date)) ?? 0) + 1);
  const [badDay] = [...byDay.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([d]) => d);
  if (badDay !== undefined) {
    const busy = new Set(sessionsBetween(user.id, weekStart(t), addDays(weekStart(t), 13)).map((s) => weekday(s.date)));
    const to = [1, 2, -1].map((k) => (badDay + k + 7) % 7).find((d) => !busy.has(d)) ?? (badDay + 1) % 7;
    out.push({
      trigger: 'pattern_giorno_saltato', key: `pattern_${badDay}_${weekStart(t)}`, because: `Ti scrivo perché il ${DAY_NAME[badDay]} salta spesso`,
      facts: { giorno: DAY_NAME[badDay], proposta: DAY_NAME[to] },
      actions: [{ label: `Sposta il ${DAY_NAME[badDay]} al ${DAY_NAME[to]}`, type: 'move_day', from: DAY_CODE[badDay], to: DAY_CODE[to] }],
    });
  }

  // prima settimana finita / inizio della seconda
  if (user.start_date) {
    const d = diffDays(t, user.start_date);
    if (d === 6 || d === 7 && weekday(t) === 0) out.push({ trigger: 'fine_settimana_1', key: 'settimana_1', because: 'Ti scrivo perché hai chiuso la tua prima settimana', facts: { sedute: done.filter((s) => s.date >= user.start_date!).length } });
    if (d >= 7 && d <= 8) out.push({ trigger: 'inizio_settimana_2', key: 'settimana_2', because: 'Ti scrivo perché inizia la seconda settimana, quella che di solito è più dura', facts: {} });
  }
  return out.sort((a, b) => PRIORITY.indexOf(a.trigger) - PRIORITY.indexOf(b.trigger));
}

// ---------- Anti-spam ----------

function allowed(userId: string, c: Candidate, t = today()): boolean {
  if (db.prepare('SELECT 1 FROM coach_messages WHERE user_id = ? AND key = ?').get(userId, c.key)) return false; // già scritto per questo motivo
  if (db.prepare('SELECT 1 FROM coach_messages WHERE user_id = ? AND day = ?').get(userId, t)) return false; // massimo uno al giorno
  if (!CAN_FOLLOW_YESTERDAY.includes(c.trigger) && db.prepare('SELECT 1 FROM coach_messages WHERE user_id = ? AND day = ?').get(userId, addDays(t, -1))) return false; // mai due giorni di fila
  if (db.prepare('SELECT 1 FROM coach_messages WHERE user_id = ? AND trigger = ? AND day >= ?').get(userId, c.trigger, addDays(t, -6)) && c.trigger !== 'record_personale') return false; // stesso motivo: non entro una settimana
  return true;
}

// ---------- Testo ----------

const FALLBACK: Record<Trigger, string> = {
  ripartenza_fatta: 'Di nuovo in pista. Ripartire è la cosa più difficile, ed è fatta.',
  assenza_3_giorni: 'Ciao {name}, è un po\' che non ci sentiamo. {why} Quando vuoi, ti aspetta una seduta corta.',
  pattern_giorno_saltato: 'Il {giorno} sembra un giorno complicato, e va bene così. Se vuoi, lo spostiamo al {proposta}.',
  due_duro: 'Le ultime due sedute sono state dure: ho già abbassato un po\' l\'intensità. Ascoltarsi è parte dell\'allenamento.',
  prontezza_bassa_2gg: 'Da due giorni il tuo corpo chiede recupero. Oggi va benissimo una seduta leggera, o riposo vero.',
  record_personale: '{minuti} minuti di fila: è il tuo record. Te lo dico perché te lo sei guadagnato.',
  fine_settimana_1: 'Prima settimana chiusa. La parte più difficile è iniziare, e l\'hai fatta.',
  inizio_settimana_2: 'Inizia la seconda settimana, di solito la più dura. {why} Un passo alla volta.',
  livello_nuovo: 'Livello {livello}: {nome}. {why} Si riparte con calma, come sempre.',
};

/** Filtro di tono: niente colpa, niente peso o diete, niente ordini; 1-3 frasi. */
const BAD_TONE = /colpa|dovresti|\bdevi\b|hai saltato|pigr|delus|peccato|vergogn|\bpeso\b|\bkg\b|chil|dieta|calori|bmi|non hai fatto|purtroppo/i;
/** Niente maschile o femminile riferito alla persona ("sei arrivata", "bravo", "stanca"). */
const GENDERED = /\b(sei|sono|resta|rimani)\s+(stat|arrivat|tornat|ripartit|salit|passat|pront|stanc|ricascat|riuscit|cadut|sicur|content|motivat|bloccat|fermat)[oaie]\b|\bbrav[oa]\b|\bben(tornat|venut)[oa]\b/i;
export function toneOk(text: string): boolean {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean);
  return !BAD_TONE.test(text) && !GENDERED.test(text) && sentences.length >= 1 && sentences.length <= 3 && text.length <= 320 && !/[\u{1F300}-\u{1FAFF}]/u.test(text);
}

function fill(tpl: string, user: UserRow, c: Candidate): string {
  const p = profileOf(user);
  const hasWhy = WITH_WHY.includes(c.trigger) && !!p?.why;
  // nei testi di copy.json {why} è dentro la frase; nei nostri di riserva è una frase intera
  const why = hasWhy ? (tpl.includes(': {why}') ? `"${p!.why}"` : `Ricordi perché hai iniziato: "${p!.why}".`) : '';
  let s = tpl.replace('{name}', p?.name ?? '').replace('{why}', why).replace('{day}', String(c.facts.giorno ?? ''));
  for (const [k, v] of Object.entries(c.facts)) s = s.replaceAll(`{${k}}`, String(v));
  return s.replace(/\{\w+\}/g, '').replace(/\s+/g, ' ').replace(/ \./g, '.').trim();
}

const CoachText = z.object({ text: z.string().min(10).max(320) });

async function writeText(user: UserRow, c: Candidate): Promise<string> {
  const hasWhy = WITH_WHY.includes(c.trigger) && !!profileOf(user)?.why;
  const fromCopy = content.text(`trigger.${c.trigger}.${hasWhy ? 'text' : 'text_no_why'}`, '') || content.text(`trigger.${c.trigger}.text`, '');
  const fallback = () => fill(fromCopy && (hasWhy || !fromCopy.includes('{why}')) ? fromCopy : FALLBACK[c.trigger], user, c);
  if (aiMode() === 'off') return fallback();
  const p = profileOf(user)!;
  const useWhy = WITH_WHY.includes(c.trigger) && p.why;
  try {
    const ai = await askJson(`${TONO}

COMPITO: scrivi un messaggio breve che il coach manda DI SUA INIZIATIVA (nessuno gliel'ha chiesto). 2-3 frasi, massimo 45 parole, niente emoji, niente domande insistenti.
Il messaggio deve suonare personale e motivato dal fatto indicato, mai di routine. Mai colpa, mai "devi", mai peso, diete o calorie.
Mai maschile o femminile riferito alla persona: niente "sei arrivata", "sei tornato", "brava", "bentornata". Usa forme neutre: "hai raggiunto", "di nuovo in pista", "ce l'hai fatta", "eccoti".${useWhy ? '\nCita con delicatezza il suo perché, tra virgolette, così come l\'ha scritto.' : '\nNON citare il suo perché.'}`,
    `PERSONA: ${p.name}. Obiettivo: ${p.goal}.${useWhy ? ` Il suo perché: "${p.why}".` : ''}
MOTIVO DEL MESSAGGIO (${c.trigger}): ${c.because}.
FATTI: ${JSON.stringify(c.facts)}${c.actions?.length ? `\nAZIONE PROPOSTA (mostrata come pulsante sotto il messaggio): ${c.actions[0].label}` : ''}
Rispondi con { "text": "..." }.`, CoachText, { label: 'coach-proattivo', maxTokens: 600 });
    const text = ai.text.trim();
    return toneOk(text) ? text : fallback();
  } catch (err) {
    console.warn(`[coach-proattivo] testo di riserva: ${(err as Error).message}`);
    return fallback();
  }
}

// ---------- Messaggi ----------

export interface CoachMessage { id: string; date: string; trigger: Trigger; text: string; because: string; read: boolean; actions: Action[] }

interface Row { id: string; created_at: string; trigger: Trigger; text: string; because: string; read: number; actions: string | null }
const toMsg = (r: Row): CoachMessage => ({ id: r.id, date: r.created_at, trigger: r.trigger, text: r.text, because: r.because, read: !!r.read, actions: r.actions ? JSON.parse(r.actions) : [] });

export function saveMessage(userId: string, c: Candidate, text: string, createdAt = new Date()): CoachMessage {
  const id = rid('cm', 8);
  const day = createdAt.toLocaleDateString('sv-SE');
  db.prepare('INSERT INTO coach_messages (id, user_id, created_at, day, trigger, key, text, because, read, actions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)')
    .run(id, userId, isoLocal(createdAt), day, c.trigger, c.key, text, c.because, c.actions?.length ? JSON.stringify(c.actions) : null);
  return toMsg(db.prepare('SELECT * FROM coach_messages WHERE id = ?').get(id) as Row);
}

/** ISO con il fuso locale (es. 2026-10-04T08:05:00+02:00). */
function isoLocal(d: Date): string {
  const off = -d.getTimezoneOffset();
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, '0');
  return `${d.toLocaleDateString('sv-SE')}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${off >= 0 ? '+' : '-'}${pad(off / 60)}:${pad(off % 60)}`;
}

export function inbox(userId: string) {
  const rows = db.prepare('SELECT * FROM coach_messages WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 30').all(userId) as Row[];
  return { unread: rows.filter((r) => !r.read).length, messages: rows.map(toMsg) };
}

export function markRead(userId: string, id: string): boolean {
  return db.prepare('UPDATE coach_messages SET read = 1 WHERE user_id = ? AND id = ?').run(userId, id).changes > 0;
}

/** Valuta i trigger per una persona e, se le regole lo permettono, scrive un messaggio (e la notifica: la prima frase). */
export async function evaluateUser(user: UserRow, t = today()): Promise<CoachMessage | null> {
  if (!user.profile) return null;
  const c = candidates(user, t).find((x) => allowed(user.id, x, t));
  if (!c) return null;
  const text = await writeText(user, c);
  const msg = saveMessage(user.id, c, text);
  const first = text.split(/(?<=[.!?])\s+/)[0];
  await sendTo(user.id, { title: 'Il tuo coach', body: first, url: '/coach', tag: 'coach' }).catch(() => 0);
  return msg;
}

/** Demo e test: genera subito un messaggio per il trigger indicato, senza regole anti-spam. */
export async function simulate(user: UserRow, trigger: Trigger): Promise<CoachMessage> {
  const real = candidates(user).find((c) => c.trigger === trigger);
  const p = profileOf(user)!;
  const c: Candidate = real ?? {
    trigger,
    key: `sim_${trigger}_${Date.now()}`,
    because: {
      ripartenza_fatta: 'Ti scrivo perché hai completato la ripartenza',
      assenza_3_giorni: 'Ti scrivo perché non ci sentiamo da qualche giorno',
      pattern_giorno_saltato: 'Ti scrivo perché il venerdì salta spesso',
      due_duro: 'Ti scrivo perché le ultime due sedute ti sono sembrate dure',
      prontezza_bassa_2gg: 'Ti scrivo perché da due giorni i tuoi dati dicono stanchezza',
      record_personale: 'Ti scrivo perché hai fatto 18 minuti di fila: il tuo record',
      fine_settimana_1: 'Ti scrivo perché hai chiuso la tua prima settimana',
      inizio_settimana_2: 'Ti scrivo perché inizia la seconda settimana, quella che di solito è più dura',
      livello_nuovo: `Ti scrivo perché hai raggiunto il livello ${getUser(user.id)!.level}`,
    }[trigger],
    facts: trigger === 'record_personale' ? { minuti: 18, prima: 15 } : trigger === 'pattern_giorno_saltato' ? { giorno: 'venerdì', proposta: 'sabato' } : trigger === 'livello_nuovo' ? { livello: user.level, nome: content.level(user.level, p.track).name } : {},
    actions: trigger === 'pattern_giorno_saltato' ? [{ label: 'Sposta il venerdì al sabato', type: 'move_day', from: 'ven', to: 'sab' }] : undefined,
  };
  const msg = saveMessage(user.id, { ...c, key: `sim_${trigger}_${Date.now()}` }, await writeText(user, c));
  await sendTo(user.id, { title: 'Il tuo coach', body: msg.text.split(/(?<=[.!?])\s+/)[0], url: '/coach', tag: 'coach' }).catch(() => 0);
  return msg;
}

/** Azione "sposta un giorno": la prossima seduta da fare nel giorno `from` passa al giorno `to` della stessa settimana (se libero). */
export function applyAction(user: UserRow, msgId: string, index: number): string | null {
  const row = db.prepare('SELECT actions FROM coach_messages WHERE user_id = ? AND id = ?').get(user.id, msgId) as { actions: string | null } | undefined;
  const action = row?.actions ? (JSON.parse(row.actions) as Action[])[index] : undefined;
  if (!action) return null;
  if (action.type === 'move_day') {
    const from = DAY_CODE.indexOf(action.from);
    const to = DAY_CODE.indexOf(action.to);
    const t = today();
    for (const ws of [weekStart(t), addDays(weekStart(t), 7)]) {
      const target = sessionsBetween(user.id, ws, addDays(ws, 6)).find((s) => s.status === 'planned' && weekday(s.date) === from && s.date >= t);
      const newDate = addDays(ws, to);
      if (target && newDate >= t && !sessionsBetween(user.id, newDate, newDate).some((s) => s.status !== 'skipped')) {
        updateSession(target.id, { date: newDate });
        markRead(user.id, msgId);
        return `Spostata al ${DAY_NAME[to]}`;
      }
    }
    markRead(user.id, msgId);
    return 'Niente da spostare questa settimana';
  }
  return null;
}

// ---------- Scheduler ----------

export async function proactiveTick(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < 8 || h > 20.5) return; // mai presto la mattina né la sera tardi
  const since = addDays(today(), -14);
  const users = db.prepare(`SELECT DISTINCT u.id FROM users u LEFT JOIN app_opens o ON o.user_id = u.id
    WHERE u.profile IS NOT NULL AND u.id NOT IN ('demo', 'demo-runner') AND (o.date >= ? OR u.start_date >= ?)`).all(since, since) as { id: string }[];
  for (const { id } of users) {
    const user = getUser(id);
    if (user) await evaluateUser(user).catch((e) => console.warn(`[coach-proattivo] ${id}: ${(e as Error).message}`));
  }
}

export function startProactive() {
  cron.schedule('*/15 * * * *', () => { proactiveTick().catch((e) => console.warn(`[coach-proattivo] tick: ${(e as Error).message}`)); }, { timezone: process.env.TZ || 'Europe/Rome' });
}

