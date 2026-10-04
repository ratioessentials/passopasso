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
import { acceptLevel, checkin, complete, skip } from './engine/actions.js';
import { mealFeedback } from './engine/meals.js';
import { onboardingStep } from './engine/onboarding.js';
import { saveProfile, seedDemo, touchDemo, DEMO_ID } from './engine/seed.js';
import {
  allSessions, consistencyAt, createUser, currentHabit, ensureCurrentWeek, getSessionRow, getUser, habitDoneDays, levelInfo, listWins,
  profileOf, sessionsBetween, toSession,
} from './engine/store.js';
import type { SessionRow, UserRow } from './engine/types.js';

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
  if (id === DEMO_ID) seedDemo();
  const user = getUser(id);
  if (!user) throw fail(404, 'user_not_found', 'Non ti trovo più. Ricominciamo dal benvenuto?');
  if (id === DEMO_ID && req.method !== 'GET') touchDemo();
  if (opts.profile !== false && !user.profile) throw fail(409, 'no_profile', 'Prima raccontami qualcosa di te: finiamo la chiacchierata iniziale.');
  return user;
}

function requireSession(user: UserRow, id: string): SessionRow {
  const row = getSessionRow(user.id, id);
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
  const info = levelInfo(user);
  const habit = currentHabit(user);
  return {
    profile: profileOf(user),
    level: { n: info.n, name: info.name, verb: info.verb, progress: info.progress, ready: info.ready },
    consistency: info.consistency,
    intensity: user.intensity,
    today: todaySession(user),
    habit: { ...habit, doneDays: habitDoneDays(user.id) },
    wins: listWins(user.id),
  };
}

const DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];

export async function buildServer() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' }, bodyLimit: 10 * 1024 * 1024 });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: { code: err.code, message: err.message } });
    if (err.statusCode === 413) return reply.status(413).send({ error: { code: 'too_large', message: 'La foto è un po\' pesante. Prova con una più piccola.' } });
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send({ error: { code: 'bad_request', message: 'Qualcosa non torna nella richiesta. Riprova tra un attimo.' } });
    req.log.error(err);
    return reply.status(500).send({ error: { code: 'server_error', message: 'Ops, qui qualcosa si è inceppato. Riprova tra poco.' } });
  });

  // ---------- Endpoint ----------

  app.get('/api/health', async () => ({ ok: true, ai: aiMode(), model: config.aiModel, content: content.sources() }));

  app.post('/api/users', async (_req, reply) => reply.status(201).send({ userId: createUser().id }));

  app.post('/api/onboarding/message', async (req) => {
    const user = requireUser(req, { profile: false });
    if (user.id === DEMO_ID) throw fail(409, 'demo', 'Il profilo demo è già pronto: crea un nuovo profilo per fare l\'onboarding.');
    const { messages } = parse(z.object({
      messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(2000) })).min(1).max(40),
    }), req.body);
    if (messages[messages.length - 1].role !== 'user') throw fail(400, 'bad_request', 'Manca la tua risposta. Scrivimi qualcosa!');
    const step = await onboardingStep(messages);
    if (step.done && step.profile) {
      saveProfile(user, step.profile);
      return { reply: step.reply, done: true, profile: step.profile };
    }
    return { reply: step.reply, done: false, quickReplies: step.quickReplies ?? [] };
  });

  app.get('/api/me', async (req) => mePayload(requireUser(req)));

  app.get('/api/week', async (req) => {
    const user = requireUser(req);
    ensureCurrentWeek(user);
    return weekPayload(user);
  });

  app.get('/api/sessions/:id', async (req) => {
    const user = requireUser(req);
    return toSession(requireSession(user, (req.params as { id: string }).id), user);
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
    return complete(user, row, feedback);
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
    if (!acceptLevel(user)) throw fail(409, 'not_ready', 'Ancora qualche seduta e ci siamo. Il prossimo livello ti aspetta.');
    return mePayload(getUser(user.id)!);
  });

  app.get('/api/levels', async (req) => {
    const id = String(req.headers['x-user-id'] ?? '');
    if (id === DEMO_ID) seedDemo();
    const user = id ? getUser(id) : undefined;
    const levels = content.program().levels;
    return { levels, current: user?.level ?? 1 };
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

  app.post('/api/meals/photo', async (req) => {
    const user = requireUser(req);
    const { imageBase64, mimeType } = parse(z.object({ imageBase64: z.string().min(100), mimeType: z.string().default('image/jpeg') }), req.body);
    const data = imageBase64.replace(/^data:[^;]+;base64,/, '');
    if (data.length > 6 * 1024 * 1024 * 1.37) throw fail(413, 'too_large', 'La foto è un po\' pesante. Prova con una più piccola.');
    const habit = currentHabit(user);
    const fb = await mealFeedback({ base64: data, mimeType }, habit);
    db.prepare('INSERT INTO meals (user_id, date, habit_id, feedback) VALUES (?, ?, ?, ?)').run(user.id, today(), habit.id, JSON.stringify(fb));
    return fb;
  });

  app.get('/api/widget/:userId', async (req, reply) => {
    reply.header('Access-Control-Allow-Origin', '*').header('Cache-Control', 'no-store');
    const id = (req.params as { userId: string }).userId;
    if (id === DEMO_ID) seedDemo();
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
