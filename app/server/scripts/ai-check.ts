// Verifica rapida dell'autenticazione AI: npm run ai:check
import { z } from 'zod';
import { askJson, aiMode } from '../src/ai/claude.js';
import { config } from '../src/config.js';

console.log(`Modalità AI: ${aiMode()} — modello ${config.aiModel}`);
if (aiMode() === 'off') {
  console.log('AI spenta: imposta ANTHROPIC_API_KEY oppure CLAUDE_CODE_OAUTH_TOKEN in .env');
  process.exit(1);
}
const r = await askJson('Sei il coach di PassoPasso.', 'Scrivi un saluto di benvenuto di una frase e un numero da 1 a 5.', z.object({ saluto: z.string(), n: z.number().int().min(1).max(5) }), { label: 'ai:check' });
console.log('OK', r);
