import { aiMode, type AiMeta } from '../ai/claude.js';
import type { BodyZone } from '../content.js';
import { allowedExercises, filterFor, isAllowed } from './builder.js';
import { readiness } from './health.js';
import { exclusions, runChecks, type Check } from './invariants.js';
import { derive } from './person.js';
import type { Item, Profile, Segment, SessionRow, UserRow } from './types.js';

/** "Perché questa seduta": cosa ha considerato il motore, cosa ha escluso e perché, i 7 controlli, la riga tecnica. */
export function buildExplain(opts: {
  user: UserRow; profile: Profile; level: number; input: { minutes: number; energy?: number; pain: BodyZone[] };
  checks: Check[]; meta?: AiMeta; fallback: boolean; repaired: boolean; violationsBefore: string[];
}) {
  const d = derive(opts.profile);
  const f = filterFor(opts.profile, opts.level, opts.input.pain);
  const excluded = exclusions(f, (e) => isAllowed(e, f));
  const r = readiness(opts.user.id);
  const aiUsed = aiMode() !== 'off' && opts.meta?.latencyMs !== undefined && !opts.meta.error;
  return {
    inputs: { minutes: opts.input.minutes, energy: opts.input.energy ?? null, pain: opts.input.pain, readiness: r?.level ?? null, impactAllowed: d.impactAllowed, caution: d.caution, level: opts.level },
    candidates: allowedExercises(f).length,
    excluded: excluded.slice(0, 25),
    excludedCount: excluded.length,
    checks: opts.checks,
    verified: opts.checks.every((c) => c.passed),
    ai: {
      model: aiUsed ? opts.meta!.model ?? null : null,
      latencyMs: aiUsed ? opts.meta!.latencyMs ?? null : null,
      validFirstTry: aiUsed ? !!opts.meta!.validFirstTry : null,
      repaired: !!opts.meta?.repaired || opts.repaired,
      fallback: opts.fallback,
      violationsCorrected: opts.violationsBefore,
    },
  };
}

/** Per le sedute senza check-in (pianificate a regole): spiegazione calcolata al momento. */
export function explainRow(user: UserRow, profile: Profile, row: SessionRow) {
  const ck = row.checkin ? JSON.parse(row.checkin) as { minutes: number; energy: number; pain: BodyZone[]; redFlags?: string[] } : null;
  const input = { minutes: ck?.minutes ?? row.minutes, energy: ck?.energy, pain: ck?.pain ?? [] };
  const checks = runChecks({ items: JSON.parse(row.items) as Item[], segments: row.segments ? JSON.parse(row.segments) as Segment[] : null, reason: row.reason ?? '' },
    { minutes: input.minutes, pain: input.pain, impactAllowed: derive(profile).impactAllowed, redFlags: ck?.redFlags ?? [] });
  return buildExplain({ user, profile, level: row.level, input, checks, fallback: row.source === 'rules', repaired: false, violationsBefore: [] });
}
