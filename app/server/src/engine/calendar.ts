import ical, { type EventInstance, type VEvent } from 'node-ical';
import { addDays, fmt, today, weekday } from '../dates.js';
import type { Profile } from './types.js';

export interface FreeSlot { date: string; start: string; end: string }
interface Busy { start: Date; end: Date }

const CACHE_MS = 15 * 60_000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_BYTES = 5 * 1024 * 1024;
const cache = new Map<string, { at: number; busy: Busy[] }>();

export class CalendarError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

/** webcal:// → https://, solo http(s), niente indirizzi locali. */
export function normalizeIcsUrl(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('webcal://')) s = `https://${s.slice('webcal://'.length)}`;
  let u: URL;
  try { u = new URL(s); } catch { throw new CalendarError('bad_url', 'Questo link non sembra un indirizzo valido. Copialo di nuovo dalle impostazioni del calendario.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new CalendarError('bad_url', 'Serve un link che inizia con https:// (o webcal://).');
  if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$)/i.test(u.hostname)) {
    throw new CalendarError('bad_url', 'Questo link non è raggiungibile da qui. Usa il link pubblico o "segreto" del calendario.');
  }
  return u.toString();
}

async function download(url: string): Promise<string> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, redirect: 'follow', headers: { accept: 'text/calendar, */*' } });
    if (!res.ok) throw new CalendarError('fetch_failed', 'Non riesco ad aprire il calendario. Controlla che il link sia quello "segreto" in formato iCal.');
    const text = await res.text();
    if (text.length > MAX_BYTES) throw new CalendarError('too_large', 'Questo calendario è molto grande. Prova con un calendario specifico, per esempio quello del lavoro.');
    if (!text.includes('BEGIN:VCALENDAR')) throw new CalendarError('not_ical', 'Il link si apre, ma non è un calendario iCal. Cerca la voce "formato iCal" nelle impostazioni.');
    return text;
  } catch (err) {
    if (err instanceof CalendarError) throw err;
    if ((err as Error).name === 'AbortError') throw new CalendarError('timeout', 'Il calendario ci mette troppo a rispondere. Riprova tra un attimo.');
    throw new CalendarError('fetch_failed', 'Non riesco ad aprire il calendario. Controlla il link e riprova.');
  } finally {
    clearTimeout(timer);
  }
}

/** Gli impegni dei prossimi 7 giorni. Gli eventi di un giorno intero (compleanni, festività) e quelli "libero" non bloccano. */
export function busyFromIcs(text: string, from: Date, to: Date): Busy[] {
  const data = ical.sync.parseICS(text);
  const busy: Busy[] = [];
  for (const comp of Object.values(data)) {
    if (!comp || comp.type !== 'VEVENT') continue;
    const ev = comp as VEvent;
    if (ev.status === 'CANCELLED' || ev.transparency === 'TRANSPARENT') continue;
    let instances: EventInstance[] = [];
    try {
      instances = ical.expandRecurringEvent(ev, { from, to, expandOngoing: true });
    } catch {
      if (ev.start && ev.end) instances = [{ start: ev.start, end: ev.end, isFullDay: ev.datetype === 'date' } as EventInstance];
    }
    for (const inst of instances) {
      if (inst.isFullDay || !inst.start) continue;
      const start = new Date(inst.start);
      const end = inst.end ? new Date(inst.end) : new Date(start.getTime() + 60 * 60_000);
      if (end > from && start < to) busy.push({ start, end });
    }
  }
  return busy.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Il calendario di esempio servito da noi: si legge senza passare dalla rete. */
export const isDemoIcs = (url: string) => /\/api\/calendar\/demo\.ics(\?|$)/.test(url);

export async function loadBusy(url: string): Promise<Busy[]> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.busy;
  const text = isDemoIcs(url) ? demoIcs() : await download(url);
  const from = new Date();
  const to = new Date(from.getTime() + 8 * 86400_000);
  const busy = busyFromIcs(text, from, to);
  cache.set(url, { at: Date.now(), busy });
  return busy;
}

const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const at = (date: string, h: number, m: number) => { const [y, mo, d] = date.split('-').map(Number); return new Date(y, mo - 1, d, h, m); };

/** Spazi liberi di almeno `minutes` tra le 6:30 e le 22:00 nei prossimi 7 giorni (oggi dall'ora attuale). */
export function freeSlots(busy: Busy[], minutes: number, now = new Date()): FreeSlot[] {
  const out: FreeSlot[] = [];
  const t = today();
  for (let i = 0; i < 7; i++) {
    const date = addDays(t, i);
    let cursor = at(date, 6, 30);
    const dayEnd = at(date, 22, 0);
    if (i === 0 && now > cursor) {
      cursor = new Date(Math.ceil(now.getTime() / (15 * 60_000)) * 15 * 60_000 + 15 * 60_000);
    }
    const events = busy.filter((b) => b.end > cursor && b.start < dayEnd);
    for (const ev of [...events, { start: dayEnd, end: dayEnd }]) {
      const gapEnd = ev.start < dayEnd ? ev.start : dayEnd;
      if ((gapEnd.getTime() - cursor.getTime()) / 60_000 >= minutes) out.push({ date, start: hhmm(cursor), end: hhmm(gapEnd) });
      if (ev.end > cursor) cursor = ev.end;
      if (cursor >= dayEnd) break;
    }
  }
  return out;
}

const DAY = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];
const minutesOf = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };

function partOfDay(slot: FreeSlot, need: number, pref: Profile['preferredTime']): { label: string; score: number } {
  const s = minutesOf(slot.start);
  const e = minutesOf(slot.end);
  const fits = (from: number, to: number) => Math.min(e, to) - Math.max(s, from) >= need;
  const parts = [
    { key: 'mattina', label: 'mattina', ok: fits(390, 720) },
    { key: 'pausa_pranzo', label: 'in pausa pranzo', ok: fits(720, 870) },
    { key: 'sera', label: 'sera', ok: fits(1020, 1320) },
  ].filter((p) => p.ok);
  const best = parts.find((p) => p.key === pref) ?? parts[0];
  return best ? { label: best.label, score: best.key === pref ? 2 : 1 } : { label: `alle ${slot.start}`, score: 0 };
}

/** Sceglie i giorni per le sedute (niente giorni consecutivi se possibile) e prepara la proposta. */
export function suggestDays(slots: FreeSlot[], count: number, profile: Profile) {
  const need = profile.minutesPerSession + 15;
  const byDate = new Map<string, { slot: FreeSlot; label: string; score: number }>();
  for (const slot of slots) {
    const p = partOfDay(slot, need, profile.preferredTime);
    const cur = byDate.get(slot.date);
    if (!cur || p.score > cur.score) byDate.set(slot.date, { slot, ...p });
  }
  const dates = [...byDate.keys()].sort();
  const chosen: string[] = [];
  for (const d of dates) if (chosen.length < count && !chosen.some((c) => addDays(c, 1) === d)) chosen.push(d);
  for (const d of dates) if (chosen.length < count && !chosen.includes(d)) chosen.push(d);
  chosen.sort();
  const picks = chosen.map((d) => ({ date: d, ...byDate.get(d)! }));
  let suggestion: string;
  if (!picks.length) suggestion = 'Questa settimana il calendario è pienissimo. Teniamo sedute brevi dove capita, va bene lo stesso.';
  else {
    const labels = picks.map((p) => `${DAY[weekday(p.date)]} ${p.label}`);
    const sameLabel = picks.every((p) => p.label === picks[0].label);
    const list = sameLabel ? picks.map((p) => DAY[weekday(p.date)]) : labels;
    const joined = list.length > 1 ? `${list.slice(0, -1).join(', ')} e ${list[list.length - 1]}` : list[0];
    suggestion = `Vedo spazio ${joined}${sameLabel ? ` ${picks[0].label}` : ''}: sposto lì le sedute?`;
  }
  return { dates: chosen, picks, suggestion };
}

/** Calendario di esempio per la demo: una settimana di lavoro realistica, relativa a oggi. */
export function demoIcs(): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PassoPasso//Demo//IT', 'CALSCALE:GREGORIAN'];
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const local = (date: string, h: number, m: number) => `${date.replaceAll('-', '')}T${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
  let n = 0;
  const add = (date: string, h1: number, m1: number, h2: number, m2: number, title: string) => {
    lines.push('BEGIN:VEVENT', `UID:demo-${n++}@passopasso`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Europe/Rome:${local(date, h1, m1)}`, `DTEND;TZID=Europe/Rome:${local(date, h2, m2)}`, `SUMMARY:${title}`, 'END:VEVENT');
  };
  for (let i = 0; i < 8; i++) {
    const date = addDays(today(), i);
    const wd = weekday(date);
    if (wd < 5) {
      add(date, 8, 0, 9, 0, 'Accompagnare i bimbi');
      add(date, 9, 0, 13, 0, 'Lavoro');
      add(date, 14, 0, 18, 30, 'Lavoro');
      if (wd === 1 || wd === 3) add(date, 7, 0, 8, 0, 'Riunione con il team USA');
      if (wd === 2) add(date, 19, 0, 21, 30, 'Cena da amici');
      if (wd === 4) add(date, 12, 30, 14, 0, 'Pranzo di lavoro');
    } else if (wd === 5) {
      add(date, 10, 0, 12, 0, 'Spesa e commissioni');
      add(date, 16, 0, 20, 0, 'Compleanno di Luca');
    } else {
      add(date, 12, 30, 15, 30, 'Pranzo dai nonni');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export { fmt };
