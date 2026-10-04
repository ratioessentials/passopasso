import { config } from './config.js';
import { aiMode } from './ai/claude.js';
import { content } from './content.js';
import { seedDemo } from './engine/seed.js';
import { buildServer } from './server.js';
import { startScheduler } from './engine/push.js';

seedDemo();
const app = await buildServer();
if (process.env.PUSH_SCHEDULER !== 'off') startScheduler();
await app.listen({ port: config.port, host: config.host });
app.log.info(`PassoPasso su :${config.port} — AI: ${aiMode()} (${config.aiModel}) — contenuti: ${JSON.stringify(content.sources())}`);
