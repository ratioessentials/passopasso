import Anthropic from '@anthropic-ai/sdk';
import { query, type SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import os from 'node:os';
import { z } from 'zod';
import { config } from '../config.js';

/**
 * Un solo punto d'accesso a Claude.
 * - "sdk": SDK Anthropic con ANTHROPIC_API_KEY (Messages API).
 * - "cli": Claude Agent SDK (Claude Code) con CLAUDE_CODE_OAUTH_TOKEN, senza strumenti, un solo turno.
 * - "off": nessuna chiamata, il motore usa le regole di riserva.
 */
export type AiMode = 'sdk' | 'cli' | 'off';

export function aiMode(): AiMode {
  const m = config.aiMode;
  if (m === 'off') return 'off';
  if (m === 'sdk') return process.env.ANTHROPIC_API_KEY ? 'sdk' : 'off';
  if (m === 'cli') return 'cli';
  if (process.env.ANTHROPIC_API_KEY) return 'sdk';
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return 'cli';
  return 'off';
}

export class AiUnavailable extends Error {}

type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } };
type UserContent = string | Array<{ type: 'text'; text: string } | ImageBlock>;
type Turn = { role: 'user' | 'assistant'; content: UserContent };

export interface AskOpts {
  /** etichetta per i log */
  label?: string;
  timeoutMs?: number;
  maxTokens?: number;
  /** riempito con l'esito della chiamata (per ai_calls e /explain) */
  meta?: AiMeta;
}

export interface AiMeta { model?: string; latencyMs?: number; validFirstTry?: boolean; repaired?: boolean; error?: string }

let anthropic: Anthropic | null = null;

async function callSdk(system: string, turns: Turn[], maxTokens: number, signal: AbortSignal): Promise<string> {
  anthropic ??= new Anthropic({ maxRetries: 1 });
  const res = await anthropic.messages.create(
    {
      model: config.aiModel,
      max_tokens: maxTokens,
      system,
      messages: turns as Anthropic.MessageParam[],
      output_config: { effort: config.aiEffort },
    },
    { signal },
  );
  if (res.stop_reason === 'refusal') throw new Error('refusal');
  return res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
}

async function callAgentSdk(system: string, turns: Turn[], signal: AbortSignal): Promise<string> {
  // L'Agent SDK non accetta una cronologia: la serializziamo in un unico messaggio utente.
  const last = turns[turns.length - 1];
  const history = turns.slice(0, -1)
    .map((t) => `${t.role === 'user' ? 'UTENTE' : 'TU (risposta precedente)'}:\n${typeof t.content === 'string' ? t.content : t.content.map((c) => (c.type === 'text' ? c.text : '[immagine]')).join('\n')}`)
    .join('\n\n');
  const lastBlocks = typeof last.content === 'string' ? [{ type: 'text' as const, text: last.content }] : last.content;
  const content = history ? [{ type: 'text' as const, text: `Scambio precedente:\n\n${history}\n\n---\n` }, ...lastBlocks] : lastBlocks;

  async function* prompt(): AsyncIterable<SDKUserMessage> {
    yield { type: 'user', message: { role: 'user', content: content as never }, parent_tool_use_id: null } as SDKUserMessage;
  }

  const abortController = new AbortController();
  signal.addEventListener('abort', () => abortController.abort(), { once: true });
  let out = '';
  for await (const msg of query({
    prompt: prompt(),
    options: {
      model: config.aiModel,
      systemPrompt: system,
      tools: [],
      allowedTools: [],
      maxTurns: 1,
      settingSources: [],
      persistSession: false,
      effort: config.aiEffort,
      cwd: os.tmpdir(),
      abortController,
      env: { ...process.env, CLAUDE_AGENT_SDK_CLIENT_APP: 'passopasso/0.1' },
    },
  })) {
    if (msg.type === 'result') {
      if (msg.subtype !== 'success' || msg.is_error) throw new Error(`agent sdk: ${msg.subtype} ${"result" in msg ? String(msg.result).slice(0, 200) : ""}`);
      out = msg.result;
    }
  }
  return out;
}

async function call(system: string, turns: Turn[], opts: AskOpts, signal: AbortSignal): Promise<string> {
  const mode = aiMode();
  if (mode === 'off') throw new AiUnavailable('AI disattivata');
  return mode === 'sdk' ? callSdk(system, turns, opts.maxTokens ?? 4000, signal) : callAgentSdk(system, turns, signal);
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf('{');
  const end = src.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('nessun oggetto JSON nella risposta');
  return JSON.parse(src.slice(start, end + 1));
}

function jsonInstructions(schema: z.ZodType): string {
  let js = '';
  try { js = JSON.stringify(z.toJSONSchema(schema)); } catch { /* schema non serializzabile */ }
  return `\n\nFORMATO DI RISPOSTA: rispondi SOLO con un oggetto JSON valido, senza testo prima o dopo e senza blocchi di codice.${js ? `\nJSON Schema da rispettare:\n${js}` : ''}`;
}

async function withTimeout<T>(ms: number, fn: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const ac = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { ac.abort(); reject(new Error(`timeout dopo ${ms} ms`)); }, ms);
  });
  try {
    return await Promise.race([fn(ac.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

async function askWithTurns<T>(system: string, first: UserContent, schema: z.ZodType<T>, opts: AskOpts): Promise<T> {
  const label = opts.label ?? 'ai';
  const t0 = Date.now();
  const sys = system + jsonInstructions(schema);
  try {
    return await withTimeout(opts.timeoutMs ?? config.aiTimeoutMs, async (signal) => {
      const turns: Turn[] = [{ role: 'user', content: first }];
      const text = await call(sys, turns, opts, signal);
      let problem: string;
      try {
        const parsed = schema.safeParse(extractJson(text));
        if (parsed.success) { if (opts.meta) { opts.meta.validFirstTry = true; opts.meta.repaired = false; } return parsed.data; }
        problem = z.prettifyError(parsed.error);
      } catch (e) {
        problem = (e as Error).message;
      }
      // Un solo tentativo di correzione
      console.warn(`[${label}] JSON non valido, ritento: ${problem.slice(0, 300)}`);
      turns.push({ role: 'assistant', content: text || '(vuoto)' });
      turns.push({ role: 'user', content: `La risposta non è valida:\n${problem}\nRiscrivila correggendo il problema. Solo il JSON.` });
      if (opts.meta) { opts.meta.validFirstTry = false; opts.meta.repaired = true; }
      const retry = await call(sys, turns, opts, signal);
      return schema.parse(extractJson(retry));
    });
  } catch (err) {
    if (opts.meta) opts.meta.error = (err as Error).message;
    throw err;
  } finally {
    if (opts.meta) { opts.meta.model = config.aiModel; opts.meta.latencyMs = Date.now() - t0; }
    console.log(`[${label}] ${aiMode()} ${config.aiModel} ${Date.now() - t0} ms`);
  }
}

/** Il testo della persona va nel prompt come DATI: delimitato e senza tag che possano chiudere il delimitatore. */
export function asData(messages: { role: 'user' | 'assistant'; content: string }[], who = { user: 'PERSONA', assistant: 'COACH' }): string {
  const clean = (t: string) => t.replace(/[<>]/g, (c) => (c === '<' ? '‹' : '›')).slice(0, 2000);
  return `<conversazione>\n${messages.map((m) => `${m.role === 'user' ? who.user : who.assistant}: ${clean(m.content)}`).join('\n')}\n</conversazione>`;
}

/** Chiede a Claude una risposta JSON validata con zod. Lancia un errore se fallisce: chi chiama usa le regole di riserva. */
export function askJson<T>(system: string, user: string, schema: z.ZodType<T>, opts: AskOpts = {}): Promise<T> {
  return askWithTurns(system, user, schema, opts);
}

/** Come askJson, con un'immagine (foto del piatto). */
export function askVision<T>(
  system: string,
  user: string,
  image: { base64: string; mimeType: string },
  schema: z.ZodType<T>,
  opts: AskOpts = {},
): Promise<T> {
  const media = (['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(image.mimeType) ? image.mimeType : 'image/jpeg') as ImageBlock['source']['media_type'];
  return askWithTurns(system, [
    { type: 'image', source: { type: 'base64', media_type: media, data: image.base64 } },
    { type: 'text', text: user },
  ], schema, opts);
}
