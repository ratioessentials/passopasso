// Importato per primo da ogni test: database temporaneo, niente AI, niente scheduler.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'passopasso-test-'));
process.env.AI_MODE = 'off';
process.env.PUSH_SCHEDULER = 'off';
process.env.TZ = 'Europe/Rome';
