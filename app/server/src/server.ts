import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import fastifyStatic from '@fastify/static';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { aiMode } from './ai/claude.js';
import { config } from './config.js';
import { BODY_ZONES, content, type BodyZone } from './content.js';
import { addDays, DAY_LETTERS, diffDays, today, weekStart } from './dates.js';
import { db } from './db.js';
import { acceptLevel, checkin, complete, completeShort, shortSession, skip, SHORT_SUFFIX } from './engine/actions.js';
import { mealFeedback } from './engine/meals.js';
import { submitTest, testsFor } from './engine/tests.js';
import { authorizeUrl, disconnectStrava, handleCallback, stravaConfigured, syncStravaIfStale, verifyState } from './engine/strava.js';
import { sendTo, subscribe, unsubscribe, vapid } from './engine/push.js';
import { applyAction, inbox, markRead, recordOpen, simulate, TRIGGERS, type Trigger } from './engine/proactive.js';
import { IngestSchema, healthToken, ingest, readiness, summary, userByHealthToken } from './engine/health.js';
import { afterFood, FoodSchema, foodPath, foodRecap, habitFor, saveFoodProfile, trainingFuel } from './engine/food.js';
import { CalendarError, demoIcs, isDemoIcs, normalizeIcsUrl } from './engine/calendar.js';
import { coachMessage, connectCalendar, disconnectCalendar } from './engine/coach.js';
import { onboardingStep } from './engine/onboarding.js';
import { isDemo, saveProfile, seedDemo, touchDemo } from './engine/seed.js';
import { CardPatchSchema, CardSchema, cautionFromHealth, cautionMessage, publicProfile, type Card } from './engine/person.js';
import {
  allSessions, consistencyAt, createUser, currentHabit, ensureCurrentWeek, getSessionRow, getUser, habitDoneDays, levelInfo, listWins,
  profileOf, replanFrom, sessionsBetween, toSession,
} from './engine/store.js';
import type { Profile, SessionRow, UserRow } from './engine/types.js';

class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const fail = (status: number, code: string, message: string) => new HttpError(status, code, message);

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw fail(400, 'bad_request', 'Qualcosa non torna nella richiesta. Riprova tra un attimo.');
  return r.data;
}

function requireUser(req: FastifyRequest, opts: { profile?: boolean } = { profile: true }): UserRow {
  const id = String(req.headers['x-user-id'] ?? '').trim();
  if (!id) throw fail(401, 'no_user', 'Non so ancora chi sei. Ricominciamo dal benvenuto?');
  if (isDemo(id)) seedDemo();
  const user = getUser(id);
  if (!user) throw fail(404, 'user_not_found', 'Non ti trovo più. Ricominciamo dal benvenuto?');
  if (isDemo(id) && req.method !== 'GET') touchDemo();
  if (opts.profile !== false && !user.profile) throw fail(409, 'no_profile', 'Prima raccontami qualcosa di te: finiamo la chiacchierata iniziale.');
  return user;
}

function requireSession(user: UserRow, id: string): SessionRow {
  const row = getSessionRow(user.id, id.endsWith(SHORT_SUFFIX) ? id.slice(0, -SHORT_SUFFIX.length) : id);
  if (!row) throw fail(404, 'session_not_found', 'Questa seduta non la trovo. Torna alla settimana e riprova.');
  return row;
}

function weekPayload(user: UserRow) {
  const ws = weekStart(today());
  return { weekStart: ws, sessions: sessionsBetween(user.id, ws, addDays(ws, 6)).map((s) => toSession(s, user)) };
}

function todaySession(user: UserRow) {
  const rows = sessionsBetween(user.id, today(), today());
  const row = rows.find((r) => r.status !== 'skipped') ?? rows[0];
  return row ? toSession(row, user) : null;
}

function mePayload(user: UserRow) {
  ensureCurrentWeek(user);
  habitFor(user);
  const info = levelInfo(user);
  const habit = currentHabit(user);
  return {
    profile: publicProfile(profileOf(user)),
    level: { n: info.n, name: info.name, verb: info.verb, progress: info.progress, ready: info.ready },
    consistency: info.consistency,
    intensity: user.intensity,
    today: todaySession(user),
    habit: { ...habit, doneDays: habitDoneDays(user.id) },
    wins: listWins(user.id),
    readiness: readiness(user.id),
  };
}

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

/** Aggiorna la scheda: il peso vuoto resta com'era; se cambia la salute si ricalcola la prudenza e si ripianifica. */
function patchProfile(user: UserRow, patch: Partial<Omit<Card, 'health'>> & { health?: Partial<Card['health']> }) {
  const old = profileOf(user)!;
  const health = { ...(old.health ?? {}), ...(patch.health ?? {}) } as NonNullable<Profile['health']>;
  const next: Profile = {
    ...old,
    ...Object.fromEntries(Object.entries(patch).filter(([k, v]) => v !== undefined && v !== null && k !== 'health')),
    health,
  } as Profile;
  // prudenza: nessun "sì" la spegne; un "sì" nuovo la riaccende anche dopo il via libera del medico
  const keys = ['heartCondition', 'chestPain', 'dizziness', 'medication', 'pregnancy', 'otherCondition'] as const;
  const newYes = keys.some((k) => health[k] && !old.health?.[k]);
  next.caution = cautionFromHealth(health) && (newYes || !!old.caution || !old.medicalOk);
  if (newYes) next.medicalOk = null;
  db.prepare('UPDATE users SET profile = ? WHERE id = ?').run(JSON.stringify(next), user.id);
  replanFrom(getUser(user.id)!, next, { pain: [] });
  return { ok: true, caution: !!next.caution, cautionMessage: next.caution ? cautionMessage(health) : null, profile: publicProfile(next) };
}

const tableExists = (name: string) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);

const SESSION_TIME: Record<string, [number, number]> = { mattina: [7, 30], pausa_pranzo: [13, 0], sera: [19, 0] };

/** Le sedute della settimana (da oggi) in iCalendar: 30 minuti all'orario preferito, con il link all'app. */
function weekIcs(user: UserRow, origin: string): string {
  const profile = profileOf(user)!;
  const [h, m] = SESSION_TIME[profile.preferredTime] ?? [19, 0];
  const t = today();
  const rows = sessionsBetween(user.id, t, addDays(weekStart(t), 13)).filter((s) => s.status === 'planned');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const local = (date: string, hh: number, mm: number) => `${date.replaceAll('-', '')}T${String(hh).padStart(2, '0')}${String(mm).padStart(2, '0')}00`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PassoPasso//Settimana//IT', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:PassoPasso', 'X-WR-TIMEZONE:Europe/Rome'];
  for (const s of rows) {
    const endM = m + 30;
    lines.push('BEGIN:VEVENT', `UID:${s.id}@passopasso`, `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Rome:${local(s.date, h, m)}`, `DTEND;TZID=Europe/Rome:${local(s.date, h + Math.floor(endM / 60), endM % 60)}`,
      `SUMMARY:${esc(`PassoPasso · ${s.title}`)}`,
      `DESCRIPTION:${esc(`${s.minutes} minuti. ${s.reason ?? ''}\nApri la seduta: ${origin}/`)}`,
      `URL:${origin}/`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Tra poco la tua seduta', 'TRIGGER:-PT30M', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map((l) => (l.length > 74 ? l.match(/.{1,73}/g)!.join('\r\n ') : l)).join('\r\n');
}

export async function buildServer() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' }, bodyLimit: 10 * 1024 * 1024 });

  // JSON tollerante: un corpo vuoto (es. DELETE dal client con content-type json) vale {}
  app.removeContentTypeParser('application/json');
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    if (!body || !String(body).trim()) return done(null, {});
    try { done(null, JSON.parse(String(body))); } catch (e) { (e as Error & { statusCode?: number }).statusCode = 400; done(e as Error, undefined); }
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    if (err.statusCode === 413) return reply.status(413).send({ error: { code: 'too_large', message: 'La foto è un po\' pesante. Prova con una più piccola.' } });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: { code: 'bad_request', message: 'Qualcosa non torna nella richiesta. Riprova tra un attimo.' } });
    req.log.error(err);
    return reply.status(500).send({ error: { code: 'server_error', message: 'Ops, qui qualcosa si è inceppato. Riprova tra poco.' } });
  });

  // ---------- Endpoint ----------

  app.get('/api/health', async () => ({ ok: true, ai: aiMode(), model: config.aiModel, content: content.sources() }));

  // Le voci "Oggi hai…?" del check-in (content/red_flags.json)
  app.get('/api/red-flags', async () => content.redFlags());

  app.post('/api/users', async (_req, reply) => reply.status(201).send({ userId: createUser().id }));

  app.post('/api/onboarding/message', async (req) => {
    const user = requireUser(req, { profile: false });
    if (isDemo(user.id)) throw fail(409, 'demo', 'Il profilo demo è già pronto: crea un nuovo profilo per fare l\'onboarding.');
    const { messages } = parse(z.object({
      messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).min(1).max(40),
    }), req.body);
    if (messages[messages.length - 1].role !== 'user') throw fail(400, 'bad_request', 'Manca la tua risposta. Scrivimi qualcosa!');
    const card = (user.draft ? JSON.parse(user.draft) : {}) as Partial<Card> & { caution?: boolean };
    const step = await onboardingStep(messages, card);
    if (step.minor) return { reply: step.reply, done: true, minor: true };
    if (step.done && step.profile) {
      saveProfile(user, step.profile);
      return { reply: step.reply, done: true, profile: publicProfile(step.profile) };
    }
    return { reply: step.reply, done: false, quickReplies: step.quickReplies ?? [], askWhy: !!step.askWhy };
  });

  // La scheda (chi sei + PAR-Q+) prima della conversazione
  app.post('/api/onboarding/profile', async (req) => {
    const user = requireUser(req, { profile: false });
    if (isDemo(user.id)) throw fail(409, 'demo', 'Il profilo demo è già pronto: crea un nuovo profilo per provare la scheda.');
    const card = parse(CardSchema, req.body);
    const caution = cautionFromHealth(card.health);
    if (user.profile) {
      // già fatto l'onboarding: vale come modifica della scheda
      return patchProfile(user, card);
    }
    db.prepare('UPDATE users SET draft = ? WHERE id = ?').run(JSON.stringify({ ...card, caution }), user.id);
    return { ok: true, caution, cautionMessage: cautionMessage(card.health), minor: card.age < 16 };
  });

  app.patch('/api/me/profile', async (req) => {
    const user = requireUser(req);
    return patchProfile(user, parse(CardPatchSchema, req.body));
  });

  app.get('/api/me', async (req) => {
    const user = requireUser(req);
    recordOpen(user.id); // per il trigger "assenza_3_giorni"
    return mePayload(user);
  });

  // ---------- Coach proattivo (inbox) ----------
  app.get('/api/coach/inbox', async (req) => inbox(requireUser(req).id));
  app.post('/api/coach/inbox/:id/read', async (req, reply) => {
    const user = requireUser(req);
    if (!markRead(user.id, (req.params as { id: string }).id)) throw fail(404, 'not_found', 'Questo messaggio non lo trovo.');
    return reply.status(204).send();
  });
  app.post('/api/coach/inbox/:id/action', async (req) => {
    const user = requireUser(req);
    const { actionIndex } = parse(z.object({ actionIndex: z.coerce.number().int().min(0).max(5).default(0) }), req.body);
    const done = applyAction(user, (req.params as { id: string }).id, actionIndex);
    if (!done) throw fail(404, 'not_found', 'Questa azione non è più disponibile.');
    return { ...mePayload(getUser(user.id)!), applied: [done] };
  });
  app.post('/api/coach/inbox/simulate', async (req) => {
    const user = requireUser(req);
    const { trigger } = parse(z.object({ trigger: z.enum(TRIGGERS) }), req.body);
    return simulate(user, trigger as Trigger);
  });

  app.get('/api/week', async (req) => {
    const user = requireUser(req);
    ensureCurrentWeek(user);
    return weekPayload(user);
  });

  app.get('/api/sessions/:id', async (req) => {
    const user = requireUser(req);
    const id = (req.params as { id: string }).id;
    const row = requireSession(user, id);
    return id.endsWith(SHORT_SUFFIX) && row.status === 'planned' ? shortSession(user, profileOf(user)!, row) : toSession(row, user);
  });

  // Prima di saltare: il tuo perché e la seduta da 10 minuti
  app.get('/api/sessions/:id/alternatives', async (req) => {
    const user = requireUser(req);
    const row = requireSession(user, (req.params as { id: string }).id);
    if (row.status !== 'planned') throw fail(409, 'not_planned', 'Questa seduta non è più da fare.');
    const profile = profileOf(user)!;
    return { why: profile.why ?? null, short: shortSession(user, profile, row) };
  });

  app.post('/api/sessions/:id/checkin', async (req) => {
    const user = requireUser(req);
    const row = requireSession(user, (req.params as { id: string }).id);
    if (row.status === 'done') throw fail(409, 'already_done', 'Questa seduta l\'hai già fatta. Bel colpo!');
    if (row.status === 'skipped') throw fail(409, 'skipped', 'Questa seduta l\'abbiamo lasciata andare. Guarda la prossima nella settimana.');
    const body = parse(z.object({
      minutes: z.coerce.number().int().min(5).max(90).default(20),
      energy: z.coerce.number().int().min(1).max(5).default(3),
      pain: z.array(z.string()).default([]),
      redFlags: z.array(z.string()).default([]),
    }), req.body);
    const pain = body.pain.filter((p): p is BodyZone => BODY_ZONES.includes(p as BodyZone));
    return checkin(user, profileOf(user)!, row, { ...body, pain });
  });

  app.post('/api/sessions/:id/complete', async (req) => {
    const user = requireUser(req);
    const row = requireSession(user, (req.params as { id: string }).id);
    if (row.status === 'done') throw fail(409, 'already_done', 'Questa seduta risulta già fatta. Bel colpo!');
    if (row.status === 'blocked') throw fail(409, 'blocked', 'Oggi la seduta è in pausa per sicurezza. Riprendiamo quando stai bene.');
    const { feedback } = parse(z.object({ feedback: z.enum(['facile', 'giusto', 'duro']) }), req.body);
    const short = (req.params as { id: string }).id.endsWith(SHORT_SUFFIX);
    const res = short ? completeShort(user, profileOf(user)!, row, feedback) : complete(user, row, feedback);
    return { ...res, afterFood: afterFood() };
  });

  app.post('/api/sessions/:id/skip', async (req) => {
    const user = requireUser(req);
    const row = requireSession(user, (req.params as { id: string }).id);
    if (row.status === 'done') throw fail(409, 'already_done', 'Questa seduta l\'hai già fatta: niente da saltare!');
    if (row.status === 'skipped') throw fail(409, 'skipped', 'Questa seduta è già stata spostata. Riprendiamo dalla prossima.');
    const { reason } = parse(z.object({ reason: z.enum(['tempo', 'stanchezza', 'malessere', 'altro']).default('altro') }), req.body);
    const res = skip(user, profileOf(user)!, row, reason);
    return { message: res.message, week: weekPayload(user), restart: res.restart };
  });

  app.post('/api/level/accept', async (req) => {
    const user = requireUser(req);
    const res = acceptLevel(user);
    if (res === 'not_ready') throw fail(409, 'not_ready', 'Ancora qualche seduta e ci siamo. Il prossimo livello ti aspetta.');
    if (res === 'test_required') throw fail(409, 'test_required', 'Prima un piccolo test di prontezza: due prove brevi, e si sale.');
    return mePayload(getUser(user.id)!);
  });

  // ---------- Salute e wearable (Health Bridge) ----------
  app.get('/api/health/token', async (req) => {
    const user = requireUser(req);
    return { token: healthToken(user.id, (req.query as { new?: string }).new === '1'), ingestUrl: '/api/health/ingest' };
  });
  app.post('/api/health/token', async (req) => ({ token: healthToken(requireUser(req).id, true) }));

  // Pubblico con token personale (Comando rapido di Apple Salute): CORS aperto
  app.options('/api/health/ingest', async (_req, reply) => reply
    .header('Access-Control-Allow-Origin', '*').header('Access-Control-Allow-Methods', 'POST, OPTIONS')
    .header('Access-Control-Allow-Headers', 'Content-Type, X-Health-Token').status(204).send());
  app.post('/api/health/ingest', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*');
    const token = String(req.headers['x-health-token'] ?? (req.query as { token?: string }).token ?? '').trim();
    const user = token ? userByHealthToken(token) : undefined;
    if (!user || !user.profile) throw fail(401, 'bad_token', 'Token non valido. Copialo di nuovo da Coach → Salute e dispositivi.');
    if (isDemo(user.id)) touchDemo();
    const body = parse(IngestSchema, req.body);
    const res = ingest(user, body);
    return { ok: true, imported: res.imported, readiness: readiness(user.id, body.date ?? today()) };
  });

  app.get('/api/health/summary', async (req) => {
    const user = requireUser(req);
    await syncStravaIfStale(user).catch((e) => req.log.warn(e));
    return summary(user);
  });

  // Strava: OAuth vero. Il link si apre dal browser (niente header): l'utente arriva anche come ?u=
  const originOf = (req: FastifyRequest) => `${(req.headers['x-forwarded-proto'] as string) ?? req.protocol}://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
  app.get('/api/connect/strava', async (req, reply) => {
    const q = req.query as { u?: string };
    if (q.u && !req.headers['x-user-id']) req.headers['x-user-id'] = q.u;
    const user = requireUser(req);
    if (!stravaConfigured()) return reply.redirect('/coach?connected=strava&error=non_configurato');
    return reply.redirect(authorizeUrl(user.id, `${originOf(req)}/api/connect/strava/callback`));
  });
  app.get('/api/connect/strava/callback', async (req, reply) => {
    const q = req.query as { code?: string; state?: string; error?: string };
    const userId = q.state ? verifyState(q.state) : null;
    if (q.error || !q.code || !userId || !getUser(userId)) return reply.redirect('/coach?connected=strava&error=annullato');
    try {
      const n = await handleCallback(q.code, userId);
      return reply.redirect(`/coach?connected=strava&imported=${n}`);
    } catch (err) {
      req.log.warn(err);
      return reply.redirect('/coach?connected=strava&error=scambio_token');
    }
  });
  app.delete('/api/connect/strava', async (req) => {
    const user = requireUser(req);
    await disconnectStrava(user.id);
    return { ok: true };
  });

  // ---------- Notifiche push ----------
  app.get('/api/push/vapid', async () => ({ publicKey: vapid().publicKey }));
  app.post('/api/push/subscribe', async (req) => {
    const user = requireUser(req);
    const body = parse(z.object({
      subscription: z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string(), auth: z.string() }), expirationTime: z.number().nullish() }),
      reminderMinutesBefore: z.coerce.number().int().min(10).max(240).default(60),
    }), req.body);
    subscribe(user.id, body.subscription, body.reminderMinutesBefore);
    return { ok: true };
  });
  app.delete('/api/push/subscribe', async (req) => {
    const user = requireUser(req);
    const body = (req.body ?? {}) as { endpoint?: string };
    unsubscribe(user.id, typeof body.endpoint === 'string' ? body.endpoint : undefined);
    return { ok: true };
  });
  app.post('/api/push/test', async (req) => {
    const user = requireUser(req);
    const sent = await sendTo(user.id, { title: 'PassoPasso', body: content.text('push.test_body', 'Eccomi! Così ti arriveranno i promemoria: gentili, al massimo uno al giorno.'), tag: 'test' });
    if (!sent) throw fail(409, 'no_subscription', 'Prima attiva i promemoria su questo dispositivo, poi riprova.');
    return { ok: true, sent };
  });

  // ---------- Piani ----------
  app.get('/api/plans', async () => {
    try { return { demo: true, ...content.plans() }; } catch { return { demo: true, plans: [] }; }
  });

  // ---------- I miei dati ----------
  app.get('/api/me/export', async (req, reply) => {
    const user = requireUser(req, { profile: false });
    const all = (sql: string) => db.prepare(sql).all(user.id);
    const data = {
      exportedAt: new Date().toISOString(),
      note: 'I tuoi dati di PassoPasso. Le foto dei piatti non vengono salvate: qui trovi solo le valutazioni.',
      user: { id: user.id, createdAt: user.created_at, level: user.level, intensity: user.intensity, startDate: user.start_date },
      profile: profileOf(user) ?? (user.draft ? JSON.parse(user.draft) : null),
      sessions: allSessions(user.id).map((s) => ({ ...toSession(s, user), feedback: s.feedback, skipReason: s.skip_reason, checkin: s.checkin ? JSON.parse(s.checkin) : null })),
      wins: listWins(user.id),
      levelHistory: all('SELECT n, from_date AS "from", to_date AS "to" FROM level_history WHERE user_id = ? ORDER BY rowid'),
      habitCheckins: all('SELECT date, habit_id AS habitId FROM habit_checkins WHERE user_id = ? ORDER BY date'),
      meals: (all('SELECT date, habit_id AS habitId, feedback FROM meals WHERE user_id = ? ORDER BY id') as { date: string; habitId: string; feedback: string }[]).map((m) => ({ ...m, feedback: JSON.parse(m.feedback) })),
      levelTests: all('SELECT date, to_level AS toLevel, results, passed, skipped FROM level_tests WHERE user_id = ? ORDER BY rowid'),
      health: tableExists('health_days') ? all('SELECT * FROM health_days WHERE user_id = ? ORDER BY date') : [],
    };
    return reply
      .header('Content-Disposition', `attachment; filename="passopasso-dati-${today()}.json"`)
      .type('application/json; charset=utf-8')
      .send(JSON.stringify(data, null, 2));
  });

  app.delete('/api/me', async (req, reply) => {
    const user = requireUser(req, { profile: false });
    if (isDemo(user.id)) seedDemo(true); // il demo non si cancella: torna allo stato iniziale
    else db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    return reply.status(204).send();
  });

  // La settimana nel calendario: header X-User-Id oppure ?u= (un link dal browser non manda header)
  app.get('/api/week.ics', async (req, reply) => {
    const q = req.query as { u?: string };
    if (q.u && !req.headers['x-user-id']) req.headers['x-user-id'] = q.u;
    const user = requireUser(req);
    ensureCurrentWeek(user);
    const origin = `${(req.headers['x-forwarded-proto'] as string) ?? req.protocol}://${req.headers['x-forwarded-host'] ?? req.headers.host}`;
    const ics = weekIcs(user, origin);
    return reply
      .header('Content-Disposition', 'attachment; filename="passopasso-settimana.ics"')
      .type('text/calendar; charset=utf-8')
      .send(ics);
  });

  // ---------- Perché funziona ----------
  app.get('/api/science', async () => {
    try { return content.science(); } catch { return []; }
  });

  // ---------- Test di prontezza ----------
  app.get('/api/level/test', async (req) => testsFor(requireUser(req)));
  app.post('/api/level/test', async (req) => {
    const user = requireUser(req);
    const body = parse(z.object({ results: z.record(z.string(), z.coerce.number()).optional(), skip: z.boolean().optional() }), req.body);
    if (!body.skip && !body.results) throw fail(400, 'bad_request', 'Mancano i risultati del test.');
    return submitTest(user, body);
  });

  app.get('/api/levels', async (req) => {
    const id = String(req.headers['x-user-id'] ?? '');
    if (isDemo(id)) seedDemo();
    const user = id ? getUser(id) : undefined;
    const profile = user ? profileOf(user) : null;
    const track = profile?.track ?? 'corsa';
    const levels = content.program().levels.map((l) => content.level(l.n, track));
    const t = content.tracks()[track] ?? {};
    return { levels, current: user?.level ?? 1, track: { id: track, name: t.name ?? track, tagline: t.tagline ?? null } };
  });

  app.get('/api/progress', async (req) => {
    const user = requireUser(req);
    const sessions = allSessions(user.id).filter((s) => s.date <= today());
    const done = sessions.filter((s) => s.status === 'done');
    const firstWeek = weekStart(user.start_date ?? today());
    const history = [];
    for (let w = firstWeek; w <= weekStart(today()); w = addDays(w, 7)) {
      const end = addDays(w, 6) < today() ? addDays(w, 6) : today();
      history.push({ week: w, value: consistencyAt(user.id, end) });
    }
    const levelHistory = (db.prepare('SELECT n, from_date AS "from", to_date AS "to" FROM level_history WHERE user_id = ? ORDER BY from_date, rowid').all(user.id)) as { n: number; from: string; to: string | null }[];
    return {
      consistencyHistory: history,
      sessionsDone: done.length,
      minutesTotal: done.reduce((a, s) => a + s.minutes, 0),
      wins: listWins(user.id),
      levelHistory,
    };
  });

  app.post('/api/habit/checkin', async (req) => {
    const user = requireUser(req);
    db.prepare('INSERT OR IGNORE INTO habit_checkins (user_id, date, habit_id) VALUES (?, ?, ?)').run(user.id, today(), currentHabit(user).id);
    return { doneDays: habitDoneDays(user.id) };
  });

  // ---------- Alimentazione 2.0 ----------
  app.post('/api/food/profile', async (req) => {
    const user = requireUser(req);
    return saveFoodProfile(user, parse(FoodSchema, req.body));
  });

  app.get('/api/food/today', async (req) => {
    const user = requireUser(req);
    ensureCurrentWeek(user);
    const chosen = habitFor(user);
    return { habit: chosen?.habit ?? currentHabit(user), why: chosen?.why ?? null, doneDays: habitDoneDays(user.id), training: trainingFuel(user) };
  });

  app.get('/api/food/recap', async (req) => foodRecap(requireUser(req)));
  app.get('/api/food/path', async (req) => foodPath(requireUser(req)));

  app.post('/api/meals/photo', async (req) => {
    const user = requireUser(req);
    const { imageBase64, mimeType } = parse(z.object({ imageBase64: z.string().min(100), mimeType: z.string().default('image/jpeg') }), req.body);
    const data = imageBase64.replace(/^data:[^;]+;base64,/, '');
    if (data.length > 6 * 1024 * 1024 * 1.37) throw fail(413, 'too_large', 'La foto è un po\' pesante. Prova con una più piccola.');
    habitFor(user);
    const habit = currentHabit(user);
    const fb = await mealFeedback({ base64: data, mimeType }, habit);
    db.prepare('INSERT INTO meals (user_id, date, habit_id, feedback) VALUES (?, ?, ?, ?)').run(user.id, today(), habit.id, JSON.stringify(fb));
    return fb;
  });

  app.get('/api/widget/:userId', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*').header('Cache-Control', 'no-store');
    const id = (req.params as { userId: string }).userId;
    if (isDemo(id)) seedDemo();
    const user = getUser(id);
    if (!user || !user.profile) throw fail(404, 'user_not_found', 'Profilo non trovato.');
    ensureCurrentWeek(user);
    const t = today();
    const ws = weekStart(t);
    const rows = sessionsBetween(user.id, ws, addDays(ws, 6));
    const week = DAY_LETTERS.map((day, i) => {
      const date = addDays(ws, i);
      const ofDay = rows.filter((r) => r.date === date);
      let status: 'done' | 'skipped' | 'planned' | 'rest' = 'rest';
      if (ofDay.some((r) => r.status === 'done')) status = 'done';
      else if (ofDay.some((r) => r.status === 'planned')) status = date < t ? 'skipped' : 'planned';
      else if (ofDay.some((r) => r.status === 'skipped')) status = 'skipped';
      return { day, status };
    });
    const nextRow = (db.prepare("SELECT * FROM sessions WHERE user_id = ? AND status = 'planned' AND date >= ? ORDER BY date LIMIT 1").get(user.id, t)) as SessionRow | undefined;
    const info = levelInfo(user);
    const habit = currentHabit(user);
    const lastWin = listWins(user.id)[0];
    let next = null;
    if (nextRow) {
      const dd = diffDays(nextRow.date, t);
      const label = dd === 0 ? 'Oggi' : dd === 1 ? 'Domani' : DAY_NAMES[(new Date(nextRow.date + 'T12:00:00').getDay() + 6) % 7];
      next = { date: nextRow.date, label, minutes: nextRow.minutes, title: nextRow.title };
    }
    return {
      level: { n: info.n, name: info.name, progress: info.progress },
      levelIconUrl: `/icons/level-${info.n}.svg`,
      consistency: info.consistency,
      next,
      week,
      habit: { title: habit.title, doneDays: habitDoneDays(user.id) },
      lastWin: lastWin ? { title: lastWin.title } : null,
    };
  });

  app.post('/api/coach/message', async (req) => {
    const user = requireUser(req);
    const { messages } = parse(z.object({
      messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(2000) })).min(1).max(60),
    }), req.body);
    if (messages[messages.length - 1].role !== 'user') throw fail(400, 'bad_request', 'Manca il tuo messaggio. Scrivimi pure!');
    return coachMessage(user, messages.slice(-20));
  });

  app.post('/api/calendar/connect', async (req) => {
    const user = requireUser(req);
    const { icsUrl } = parse(z.object({ icsUrl: z.string().min(1).max(2000) }), req.body);
    try {
      const url = isDemoIcs(icsUrl) ? icsUrl.trim() : normalizeIcsUrl(icsUrl);
      return await connectCalendar(user, url);
    } catch (err) {
      if (err instanceof CalendarError) throw fail(422, err.code, err.message);
      req.log.warn(err);
      throw fail(422, 'calendar_error', 'Non riesco a leggere questo calendario. Controlla il link e riprova.');
    }
  });

  app.delete('/api/calendar', async (req) => disconnectCalendar(requireUser(req)));

  // Calendario di esempio per provare la funzione senza il proprio (settimana di lavoro relativa a oggi)
  app.get('/api/calendar/demo.ics', async (_req, reply) => reply.type('text/calendar; charset=utf-8').send(demoIcs()));

  // Riporta l'utente demo allo stato iniziale (usato dallo smoke test e prima di registrare la demo).
  app.post('/api/demo/reset', async () => { seedDemo(true); return { ok: true }; });

  app.all('/api/*', async () => { throw fail(404, 'not_found', 'Questa strada non porta da nessuna parte.'); });

  // ---------- PWA statica in produzione ----------
  const indexHtml = path.join(config.webDist, 'index.html');
  if (fs.existsSync(indexHtml)) {
    await app.register(fastifyStatic, { root: config.webDist, wildcard: false });
    app.setNotFoundHandler((req, reply: FastifyReply) => {
      if (req.method !== 'GET' || req.url.startsWith('/api/')) return reply.status(404).send({ error: { code: 'not_found', message: 'Non trovato.' } });
      return reply.type('text/html').send(fs.readFileSync(indexHtml));
    });
    app.log.info(`PWA servita da ${config.webDist}`);
  }

  return app;
}
