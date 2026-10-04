import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.TZ ||= 'Europe/Rome';

export const SERVER_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fromRoot = (p: string) => path.resolve(SERVER_ROOT, p);

export const config = {
  port: Number(process.env.PORT || 3210),
  host: process.env.HOST || '0.0.0.0',
  contentDir: fromRoot(process.env.CONTENT_DIR || '../../content'),
  fixturesDir: fromRoot('fixtures'),
  dataDir: fromRoot(process.env.DATA_DIR || './data'),
  webDist: fromRoot(process.env.WEB_DIST || '../web/dist'),
  aiModel: process.env.AI_MODEL || 'claude-sonnet-5-5',
  aiEffort: (process.env.AI_EFFORT || 'low') as 'low' | 'medium' | 'high',
  aiMode: (process.env.AI_MODE || 'auto').toLowerCase(),
  aiTimeoutMs: Number(process.env.AI_TIMEOUT_MS || 25000),
};
