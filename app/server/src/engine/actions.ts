import { content, type BodyZone, type RedFlag } from '../content.js';
import { db } from '../db.js';
import { addDays, today, weekStart } from '../dates.js';
import { buildRuleItems, clampIntensity, generateSession } from './builder.js';
import { derive } from './person.js';
import { adaptRun, segmentsMinutes } from './run.js';
import { testPassed, testSnoozed } from './tests.js';
import { readinessLine } from './health.js';
import {
  consistencyAt, evaluateWins, getUser, insertSession, levelInfo, profileOf, replanFrom, ruleDraft, sessionsBetween, toSession, updateSession, type Win,
} from './store.js';
import type { Feedback, Profile, Segment, SessionRow, UserRow } from './types.js';

// ---------- Check-in ----------

export type CheckinResult = { status: 'ok'; session: ReturnType<typeof toSession> } | { status: 'blocked'; redFlag: RedFlag };

export async function checkin(user: UserRow, profile: Profile, row: SessionRow, input: { minutes: number; energy: number; pain: BodyZone[]; redFlags: string[] }): Promise<CheckinResult> {
  // 1. Bandiere rosse: deterministico, prima di qualsiasi AI
  if (input.redFlags.length) {
    const flags = content.redFlags();
    const hit = input.redFlags.map((id) => flags.find((f) => f.id === id)).filter((f): f is RedFlag => !!f);
    const redFlag = hit.find((f) => f.urgent) ?? hit[0] ?? {
      id: input.redFlags[0], label: 'Sintomo da non sottovalutare', urgent: false,
      message: 'Oggi niente allenamento. Se il sintomo continua, sentiamo prima il medico.',
    };
    updateSession(row.id, { status: 'blocked', checkin: JSON.stringify(input) });
    return { status: 'blocked', redFlag };
  }
  // 2a. Corsa a segmenti: l'AI adatta i segmenti (10% e scarico restano deterministici)
  if (row.segments && row.kind === 'normale') {
    const run = await adaptRun(row, profile, input, user.intensity, readinessLine(user.id));
    updateSession(row.id, {
      status: 'planned', minutes: Math.round(segmentsMinutes(run.segments)), intensity: run.intensity, title: run.title,
      reason: run.reason, segments: run.segments, source: run.source, checkin: JSON.stringify(input),
    });
    return { status: 'ok', session: toSession(db.prepare('SELECT * FROM sessions WHERE id = ?').get(row.id) as SessionRow, user) };
  }
  // 2b. Seduta su misura (AI con esercizi filtrati, o regole)
  const restart = row.kind === 'ripartenza';
  const r = content.program().restartSession;
  const draft = await generateSession({
    level: row.level,
    profile,
    intensity: restart ? Math.min(r.intensity ?? 0.8, user.intensity) : user.intensity,
    checkin: { minutes: input.minutes, energy: input.energy, pain: input.pain },
    seed: `${row.id}:${input.energy}:${input.pain.join(',')}`,
    template: restart ? r.sessionTemplate : undefined,
    kindNote: restart ? `È una seduta di ripartenza dopo una seduta saltata: più corta e leggera, preferisci le versioni facili. Vale +${row.bonus_points} punti di costanza: ricordalo nella reason con calore, senza colpa.` : undefined,
    easy: restart,
    context: readinessLine(user.id),
  });
  updateSession(row.id, {
    status: 'planned', minutes: draft.minutes, intensity: draft.intensity, title: restart ? (r.title ?? draft.title) : draft.title,
    reason: draft.reason, items: draft.items, source: draft.source, checkin: JSON.stringify(input),
  });
  const updated = db.prepare('SELECT * FROM sessions WHERE id = ?').get(row.id) as SessionRow;
  return { status: 'ok', session: toSession(updated, user) };
}

// ---------- Dieci minuti invece di niente ----------

export const SHORT_SUFFIX = '~ridotta';

/** La seduta ridotta da 10 minuti (a regole, mai AI): virtuale finché non viene completata. */
export function shortSession(user: UserRow, profile: Profile, row: SessionRow) {
  const base = toSession(row, user);
  const items = buildRuleItems({
    level: row.level, profile, minutes: 10, intensity: Math.min(user.intensity, 0.9), seed: `${row.id}:ridotta`, easy: true,
    template: { minutes: 10, blocks: [{ category: 'riscaldamento', count: 1 }, { category: 'forza', count: 2 }, { category: 'defaticamento', count: 1 }] },
  });
  const segments: Segment[] | null = row.segments ? [
    { label: 'Riscaldamento', minutes: 2, motion: 'marcia', rpe: 2 },
    { label: 'Facile', minutes: 6, motion: derive(profile).impactAllowed ? 'corsetta' : 'camminata_veloce', rpe: 3 },
    { label: 'Defaticamento', minutes: 2, motion: 'marcia', rpe: 2 },
  ] : null;
  return {
    ...base,
    id: `${row.id}${SHORT_SUFFIX}`,
    kind: 'ridotta' as const,
    status: 'planned' as const,
    minutes: 10,
    intensity: Math.min(user.intensity, 0.9),
    title: '10 minuti invece di niente',
    reason: 'Bastano dieci minuti per non perdere il filo. Conta come una seduta fatta.',
    items: segments ? [] : items.filter((i) => content.exercise(i.exerciseId)).map((i) => ({ ...i, exercise: content.exercise(i.exerciseId)! })),
    segments,
    bonusPoints: 0,
  };
}

/** Completare la ridotta: la seduta originale diventa "ridotta" e fatta (conta per la costanza). */
export function completeShort(user: UserRow, profile: Profile, row: SessionRow, feedback: Feedback) {
  const s = shortSession(user, profile, row);
  updateSession(row.id, { kind: 'ridotta', minutes: 10, title: s.title, reason: s.reason, items: s.items.map(({ exercise: _e, ...i }) => i), segments: s.segments, checkin: null });
  return complete(getUser(user.id)!, { ...row, kind: 'ridotta' }, feedback);
}

// ---------- Skip ----------

const SKIP_MESSAGES: Record<string, string> = {
  tempo: 'Capita. Riprendiamo da qui, con calma.',
  stanchezza: 'Ascoltarsi è parte dell\'allenamento. Riprendiamo da qui, con calma.',
  malessere: 'Prima stai bene, poi si riparte. Ti ho lasciato un giorno in più di riposo.',
  altro: 'Capita. Riprendiamo da qui, con calma.',
};

export function skip(user: UserRow, profile: Profile, row: SessionRow, reason: string) {
  const t = today();
  updateSession(row.id, { status: 'skipped', skip_reason: reason });
  const base = row.date > t ? row.date : t;
  const gap = reason === 'malessere' ? 2 : 1;
  const draft = ruleDraft(user, profile, addDays(base, gap), { restart: true });
  // Niente carico in più: la ripartenza prende il posto della prossima seduta vicina, oppure va nel primo giorno libero.
  const upcoming = sessionsBetween(user.id, addDays(base, gap), addDays(base, gap + 1)).find((s) => s.status === 'planned' && s.kind === 'normale');
  let restartId: string;
  if (upcoming) {
    updateSession(upcoming.id, {
      kind: 'ripartenza', bonus_points: draft.bonus_points, minutes: draft.minutes, intensity: draft.intensity,
      title: draft.title, reason: draft.reason, items: draft.items, source: 'rules', recovers: row.id, checkin: null, segments: null, run_type: null,
    });
    restartId = upcoming.id;
  } else {
    let date = addDays(base, gap);
    const busy = new Set(sessionsBetween(user.id, date, addDays(date, 14)).map((s) => s.date));
    while (busy.has(date)) date = addDays(date, 1);
    restartId = insertSession(user.id, { ...draft, date, level: user.level, recovers: row.id });
  }
  // Se nella settimana restano due sedute in giorni consecutivi dopo la ripartenza, sposta la seconda di un giorno (se libero).
  const ws = weekStart(t);
  const rest = sessionsBetween(user.id, t, addDays(ws, 6)).filter((s) => s.status === 'planned');
  for (let i = 1; i < rest.length; i++) {
    const prev = rest[i - 1];
    const cur = rest[i];
    const next = addDays(cur.date, 1);
    if (addDays(prev.date, 1) === cur.date && next <= addDays(ws, 6) && !rest.some((s) => s.date === next)) {
      updateSession(cur.id, { date: next });
      cur.date = next;
    }
  }
  const restart = db.prepare('SELECT * FROM sessions WHERE id = ?').get(restartId) as SessionRow;
  return {
    message: reason === 'tempo' || reason === 'altro' ? content.text('skip.title', SKIP_MESSAGES.tempo) : SKIP_MESSAGES[reason] ?? SKIP_MESSAGES.tempo,
    restart: toSession(restart, user),
  };
}

// ---------- Complete ----------

const COMPLETE_MESSAGES: Record<Feedback, string> = {
  facile: 'Bel lavoro. La prossima la alziamo un pelo.',
  giusto: 'Perfetto così. Continuiamo su questo passo.',
  duro: 'Grazie di avermelo detto. La prossima la facciamo più leggera.',
};

export function complete(user: UserRow, row: SessionRow, feedback: Feedback) {
  const delta = feedback === 'facile' ? 0.1 : feedback === 'duro' ? -0.1 : 0;
  const intensity = clampIntensity(user.intensity + delta);
  db.transaction(() => {
    updateSession(row.id, { status: 'done', feedback, done_at: new Date().toISOString() });
    db.prepare('UPDATE users SET intensity = ? WHERE id = ?').run(intensity, user.id);
    // le prossime sedute ancora da fare seguono la nuova intensità
    db.prepare("UPDATE sessions SET intensity = ? WHERE user_id = ? AND status = 'planned' AND kind = 'normale' AND date > ?").run(intensity, user.id, row.date);
  })();
  const fresh = getUser(user.id)!;
  const newWins: Win[] = evaluateWins(fresh);
  const info = levelInfo(fresh);
  // proposta di livello: prontezza raggiunta e test non rimandato ("Non oggi" o non superato → tra una settimana)
  const levelUp = info.ready && !testSnoozed(fresh.id, fresh.level + 1)
    ? { from: fresh.level, to: fresh.level + 1, name: content.level(fresh.level + 1, profileOf(fresh)?.track).name, testRequired: !testPassed(fresh.id, fresh.level + 1) }
    : null;
  let message = content.text(`feedback.${feedback}_reply`, COMPLETE_MESSAGES[feedback]);
  if (row.kind === 'ripartenza') message = `${content.text('restart.done', 'Ripartenza fatta.')} +${row.bonus_points} punti di costanza.`;
  return { consistency: consistencyAt(user.id), intensity, newWins, levelUp, message };
}

// ---------- Cambio di livello ----------

export function acceptLevel(user: UserRow): 'ok' | 'not_ready' | 'test_required' {
  const info = levelInfo(user);
  if (!info.ready) return 'not_ready';
  if (!testPassed(user.id, user.level + 1)) return 'test_required';
  const t = today();
  const next = user.level + 1;
  const profile = profileOf(user)!;
  db.transaction(() => {
    db.prepare('UPDATE level_history SET to_date = ? WHERE user_id = ? AND to_date IS NULL').run(t, user.id);
    db.prepare('INSERT INTO level_history (user_id, n, from_date) VALUES (?, ?, ?)').run(user.id, next, t);
    db.prepare('UPDATE users SET level = ?, level_since = ?, intensity = 1.0 WHERE id = ?').run(next, t, user.id);
  })();
  const fresh = getUser(user.id)!;
  // ripianifica le sedute ancora da fare al nuovo livello (oggi compreso; da corsa 4 in su arriva la settimana da podista)
  db.prepare("UPDATE sessions SET checkin = NULL WHERE user_id = ? AND status = 'planned' AND date >= ?").run(user.id, t);
  replanFrom(fresh, profile, { pain: [] });
  for (const s of db.prepare("SELECT * FROM sessions WHERE user_id = ? AND status = 'planned' AND kind = 'ripartenza' AND date >= ?").all(user.id, t) as SessionRow[]) {
    const d = ruleDraft(fresh, profile, s.date, { restart: true });
    updateSession(s.id, { level: next, minutes: d.minutes, intensity: d.intensity, title: d.title, reason: d.reason, items: d.items });
  }
  evaluateWins(fresh);
  return 'ok';
}
