import cron from 'node-cron';
import webpush from 'web-push';
import { content } from '../content.js';
import { addDays, today } from '../dates.js';
import { db } from '../db.js';
import { readiness } from './health.js';
import { getUser, profileOf, sessionsBetween } from './store.js';

/**
 * Web Push (VAPID). Promemoria gentili: prima della seduta, la mattina dopo una seduta saltata, quando i dati consigliano riposo.
 * Mai più di una al giorno, mai prima delle 7 né dopo le 21, testi da copy.json.
 */

let keys: { publicKey: string; privateKey: string } | null = null;

/** Chiavi VAPID da .env; se mancano, generate una volta e salvate nel DB (restano stabili sul volume). */
export function vapid() {
  if (keys) return keys;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    keys = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  } else {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'vapid'").get() as { value: string } | undefined;
    keys = row ? JSON.parse(row.value) : webpush.generateVAPIDKeys();
    if (!row) {
      db.prepare("INSERT INTO meta (key, value) VALUES ('vapid', ?)").run(JSON.stringify(keys));
      console.warn('[push] VAPID non in .env: chiavi generate e salvate nel database');
    }
  }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:ciao@passopasso.app', keys!.publicKey, keys!.privateKey);
  return keys!;
}

export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string }; expirationTime?: number | null }

export function subscribe(userId: string, sub: PushSub, minutesBefore = 60) {
  db.prepare(`INSERT INTO push_subs (endpoint, user_id, subscription, minutes_before, created_at) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, subscription = excluded.subscription, minutes_before = excluded.minutes_before`)
    .run(sub.endpoint, userId, JSON.stringify(sub), minutesBefore, new Date().toISOString());
}

export function unsubscribe(userId: string, endpoint?: string) {
  if (endpoint) db.prepare('DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?').run(userId, endpoint);
  else db.prepare('DELETE FROM push_subs WHERE user_id = ?').run(userId);
}

/** Manda a tutti i dispositivi della persona; le iscrizioni scadute (404/410) si cancellano. */
export async function sendTo(userId: string, payload: { title: string; body: string; url?: string; tag?: string }): Promise<number> {
  vapid();
  const subs = db.prepare('SELECT endpoint, subscription FROM push_subs WHERE user_id = ?').all(userId) as { endpoint: string; subscription: string }[];
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(JSON.parse(s.subscription), JSON.stringify({ url: '/', ...payload }), { TTL: 3600 });
      sent++;
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(s.endpoint);
      else console.warn(`[push] invio fallito (${code ?? (err as Error).message})`);
    }
  }
  return sent;
}

const SESSION_AT: Record<string, [number, number]> = { mattina: [7, 30], pausa_pranzo: [13, 0], sera: [19, 0] };
const minutesNow = (d = new Date()) => d.getHours() * 60 + d.getMinutes();

/** Cosa mandare ora a questa persona (o niente). Pura: testata dallo scheduler e da /api/push/test. */
export function dueMessage(userId: string, now = new Date()): { kind: string; title: string; body: string; tag: string } | null {
  const user = getUser(userId);
  const profile = user && profileOf(user);
  if (!user || !profile) return null;
  const nowMin = minutesNow(now);
  if (nowMin < 7 * 60 || nowMin > 21 * 60) return null; // mai di notte né di sera tardi
  const t = today();
  const window = (at: number) => nowMin >= at && nowMin < at + 15;
  const title = 'PassoPasso';
  // 1. riposo consigliato dai dati (7:45)
  const r = readiness(userId, t);
  if (r?.restAdvised && window(7 * 60 + 45)) {
    return { kind: 'rest', title, body: content.text('push.rest', 'I tuoi dati dicono che serve recupero. Oggi riposo vero: ti fa bene.'), tag: 'rest' };
  }
  const todays = sessionsBetween(user.id, t, t).filter((s) => s.status === 'planned');
  // 2. la mattina dopo una seduta saltata, se oggi c'è la ripartenza (8:30)
  const skippedYesterday = sessionsBetween(user.id, addDays(t, -1), addDays(t, -1)).some((s) => s.status === 'skipped');
  const restart = todays.find((s) => s.kind === 'ripartenza');
  if (skippedYesterday && restart && window(8 * 60 + 30)) {
    return { kind: 'restart', title, body: content.text('push.restart', `Capita. Oggi c'è una ripartenza da ${restart.minutes} minuti, se ti va.`).replace('{minutes}', String(restart.minutes)), tag: 'restart' };
  }
  // 3. promemoria prima della seduta
  const next = todays[0];
  if (next) {
    const sub = db.prepare('SELECT MIN(minutes_before) AS m FROM push_subs WHERE user_id = ?').get(userId) as { m: number | null };
    const [h, m] = SESSION_AT[profile.preferredTime] ?? [19, 0];
    const at = h * 60 + m - (sub.m ?? 60);
    if (window(at)) {
      const when = (sub.m ?? 60) >= 60 ? "Tra un'ora" : `Tra ${sub.m} minuti`;
      return { kind: 'reminder', title, body: content.text('push.reminder', `${when} c'è la tua seduta: ${next.minutes} minuti, come stai?`).replace('{when}', when).replace('{minutes}', String(next.minutes)), tag: 'reminder' };
    }
  }
  return null;
}

/** Ogni minuto: al massimo una notifica al giorno per persona. */
export async function tick(now = new Date()) {
  const users = (db.prepare('SELECT DISTINCT user_id FROM push_subs').all() as { user_id: string }[]).map((r) => r.user_id);
  const t = today();
  for (const userId of users) {
    if (db.prepare('SELECT 1 FROM push_log WHERE user_id = ? AND date = ?').get(userId, t)) continue;
    const msg = dueMessage(userId, now);
    if (!msg) continue;
    const sent = await sendTo(userId, { title: msg.title, body: msg.body, tag: msg.tag });
    if (sent) db.prepare('INSERT OR IGNORE INTO push_log (user_id, date, kind, sent_at) VALUES (?, ?, ?, ?)').run(userId, t, msg.kind, new Date().toISOString());
  }
}

export function startScheduler() {
  vapid();
  cron.schedule('* * * * *', () => { tick().catch((e) => console.warn(`[push] tick: ${(e as Error).message}`)); }, { timezone: process.env.TZ || 'Europe/Rome' });
}
