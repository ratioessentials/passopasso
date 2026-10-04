import { aiMode, type AiMeta } from '../ai/claude.js';
import { config } from '../config.js';
import { db } from '../db.js';

/** Registro delle generazioni (tabella ai_calls): esito dell'AI e degli invarianti, per /explain e /api/ai/stats. */

export interface CallLog {
  userId?: string | null; sessionId?: string | null; kind: string; meta?: AiMeta; fallback: boolean;
  before?: string[]; after?: string[]; explain?: unknown;
}

export function logCall(c: CallLog) {
  const mode = aiMode();
  const usedAi = mode !== 'off' && c.meta?.latencyMs !== undefined;
  db.prepare(`INSERT INTO ai_calls (created_at, user_id, session_id, kind, mode, model, latency_ms, valid_first_try, repaired, fallback, violations_before, violations_after, explain)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
    new Date().toISOString(), c.userId ?? null, c.sessionId ?? null, c.kind, mode, usedAi ? c.meta?.model ?? config.aiModel : null,
    usedAi ? c.meta?.latencyMs ?? null : null, usedAi ? (c.meta?.validFirstTry ? 1 : 0) : null, c.meta?.repaired ? 1 : 0, c.fallback ? 1 : 0,
    JSON.stringify(c.before ?? []), JSON.stringify(c.after ?? []), c.explain === undefined ? null : JSON.stringify(c.explain),
  );
}

export function lastExplain(sessionId: string): unknown | null {
  const row = db.prepare('SELECT explain FROM ai_calls WHERE session_id = ? AND explain IS NOT NULL ORDER BY id DESC LIMIT 1').get(sessionId) as { explain: string } | undefined;
  return row ? JSON.parse(row.explain) : null;
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 1000 : 0);
function percentile(xs: number[], p: number) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

/** Statistiche delle generazioni di sedute (check-in): quante valide al primo colpo, corrette, di riserva, violazioni. */
export function stats(kinds = ['seduta', 'corsa']) {
  const rows = db.prepare(`SELECT mode, latency_ms, valid_first_try, repaired, fallback, violations_before, violations_after FROM ai_calls WHERE kind IN (${kinds.map(() => '?').join(',')})`).all(...kinds) as
    { mode: string; latency_ms: number | null; valid_first_try: number | null; repaired: number; fallback: number; violations_before: string; violations_after: string }[];
  const ai = rows.filter((r) => r.mode !== 'off');
  const lat = ai.map((r) => r.latency_ms).filter((x): x is number => typeof x === 'number');
  return {
    generations: rows.length,
    withAi: ai.length,
    validFirstTry: pct(ai.filter((r) => r.valid_first_try === 1).length, ai.length),
    repaired: pct(ai.filter((r) => r.repaired === 1).length, ai.length),
    fallback: pct(rows.filter((r) => r.fallback === 1).length, rows.length),
    invariantViolationsBeforeValidation: pct(rows.filter((r) => r.violations_before !== '[]').length, rows.length),
    invariantViolationsShown: pct(rows.filter((r) => r.violations_after !== '[]').length, rows.length),
    p50LatencyMs: percentile(lat, 50),
    p95LatencyMs: percentile(lat, 95),
    model: config.aiModel,
  };
}
