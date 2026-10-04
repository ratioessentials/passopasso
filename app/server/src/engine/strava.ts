import crypto from 'node:crypto';
import { db } from '../db.js';
import { getUser } from './store.js';
import { importWorkout, touchSource, updateRunnerKm } from './health.js';
import type { UserRow } from './types.js';

/** Strava OAuth (authorization code) + import delle attività. Niente librerie: due chiamate HTTP. */

const AUTH_URL = 'https://www.strava.com/oauth/authorize';
const TOKEN_URL = 'https://www.strava.com/oauth/token';
const API = 'https://www.strava.com/api/v3';
const SYNC_EVERY_MS = 30 * 60_000;

export const stravaConfigured = () => !!(process.env.STRAVA_CLIENT_ID && process.env.STRAVA_CLIENT_SECRET);

function secret(): string {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'server_secret'").get() as { value: string } | undefined;
  if (row) return row.value;
  const v = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO meta (key, value) VALUES ('server_secret', ?)").run(v);
  return v;
}
const sign = (userId: string) => `${userId}.${crypto.createHmac('sha256', secret()).update(userId).digest('base64url').slice(0, 16)}`;
export function verifyState(state: string): string | null {
  const userId = state.split('.')[0];
  return userId && sign(userId) === state ? userId : null;
}

export function authorizeUrl(userId: string, redirectUri: string): string {
  const q = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID ?? '', response_type: 'code', redirect_uri: redirectUri,
    approval_prompt: 'auto', scope: 'read,activity:read_all', state: sign(userId),
  });
  return `${AUTH_URL}?${q}`;
}

interface Tokens { access_token: string; refresh_token: string; expires_at: number; athlete?: { id: number; firstname?: string }; demo?: boolean }

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID, client_secret: process.env.STRAVA_CLIENT_SECRET, ...params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`strava token ${res.status}`);
  return res.json() as Promise<Tokens>;
}

function getTokens(userId: string): Tokens | null {
  const row = db.prepare("SELECT data FROM health_sources WHERE user_id = ? AND source = 'strava'").get(userId) as { data: string | null } | undefined;
  return row?.data ? JSON.parse(row.data) as Tokens : null;
}

async function validToken(userId: string): Promise<string | null> {
  let t = getTokens(userId);
  if (!t || t.demo) return null;
  if (t.expires_at * 1000 < Date.now() + 60_000) {
    const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token });
    t = { ...t, ...fresh };
    db.prepare("UPDATE health_sources SET data = ? WHERE user_id = ? AND source = 'strava'").run(JSON.stringify(t), userId);
  }
  return t.access_token;
}

interface Activity { id: number; name: string; sport_type?: string; type?: string; start_date_local: string; start_date: string; moving_time: number; distance: number; average_heartrate?: number }

/** Importa le attività degli ultimi `days` giorni come allenamenti (dedup per id Strava). */
export async function syncStrava(user: UserRow, days = 30): Promise<number> {
  const token = await validToken(user.id);
  if (!token) return 0;
  const after = Math.floor((Date.now() - days * 86400_000) / 1000);
  let imported = 0;
  for (let page = 1; page <= 3; page++) {
    const res = await fetch(`${API}/athlete/activities?after=${after}&per_page=100&page=${page}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`strava activities ${res.status}`);
    const list = await res.json() as Activity[];
    for (const a of list) {
      const id = importWorkout(getUser(user.id)!, 'strava', {
        id: `strava:${a.id}`, type: a.sport_type ?? a.type ?? 'Workout', start: a.start_date_local.replace('Z', ''),
        minutes: a.moving_time / 60, distanceKm: a.distance ? a.distance / 1000 : undefined, avgHr: a.average_heartrate,
      }, a.start_date_local.slice(0, 10));
      if (id) imported++;
    }
    if (list.length < 100) break;
  }
  if (imported) updateRunnerKm(getUser(user.id)!);
  touchSource(user.id, 'strava');
  return imported;
}

export async function handleCallback(code: string, userId: string): Promise<number> {
  const t = await tokenRequest({ grant_type: 'authorization_code', code });
  touchSource(userId, 'strava', t);
  return syncStrava(getUser(userId)!, 30);
}

export async function syncStravaIfStale(user: UserRow) {
  const row = db.prepare("SELECT last_sync FROM health_sources WHERE user_id = ? AND source = 'strava'").get(user.id) as { last_sync: string | null } | undefined;
  if (!row || !stravaConfigured()) return;
  if (row.last_sync && Date.now() - Date.parse(row.last_sync) < SYNC_EVERY_MS) return;
  await syncStrava(user, 7);
}

export async function disconnectStrava(userId: string) {
  const t = getTokens(userId);
  if (t && !t.demo) {
    await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  }
  db.prepare("DELETE FROM health_sources WHERE user_id = ? AND source = 'strava'").run(userId);
}
