// Registra le scene del video: slide (slides.html) e demo dell'app pubblica, una clip per battuta.
// Uso: node pitch/video/record.mjs <cartella-voce> <cartella-output> [urlApp] [soloBattute,comma,separate]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [voiceDir, outDir, APP = 'https://passopasso.andreavallieri.com', only = ''] = process.argv.slice(2);
const ONLY = only ? new Set(only.split(',')) : null;
const here = path.dirname(fileURLToPath(import.meta.url));
const battute = JSON.parse(fs.readFileSync(path.join(voiceDir, 'battute.json'), 'utf8'));
const dur = Object.fromEntries(battute.map((b) => [b.id, b.seconds]));
const hold = Object.fromEntries(battute.map((b) => [b.id, b.hold || 0]));
fs.mkdirSync(outDir, { recursive: true });
const EXE = '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
const USER_KEY = 'passopasso.userId';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Cursore finto, iniettato in ogni pagina dell'app.
const CURSOR = `(() => {
  if (document.getElementById('__cursor')) return;
  const c = document.createElement('div'); c.id = '__cursor';
  c.style.cssText = 'position:fixed;left:-50px;top:-50px;width:26px;height:26px;border-radius:50%;background:rgba(44,105,117,.5);border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.35);z-index:999999;pointer-events:none;transition:left .4s cubic-bezier(.2,.8,.2,1),top .4s cubic-bezier(.2,.8,.2,1),transform .15s';
  document.body.appendChild(c);
})();`;

async function moveTo(page, locator) {
  const box = await locator.boundingBox().catch(() => null);
  if (!box) return false;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.evaluate(([x, y]) => { const c = document.getElementById('__cursor'); if (c) { c.style.left = x - 13 + 'px'; c.style.top = y - 13 + 'px'; } }, [x, y]);
  await sleep(500);
  return true;
}
function loc(page, sel) {
  if (typeof sel !== 'string' && !(sel instanceof RegExp)) return sel;
  return page.getByRole('button', { name: sel }).or(page.getByRole('link', { name: sel })).or(page.getByText(sel)).first();
}
async function click(page, sel, { wait = 1000 } = {}) {
  const l = loc(page, sel);
  const n = await l.count().catch(() => 0);
  if (!n) { console.log('   (manca:', String(sel), ')'); return false; }
  await l.scrollIntoViewIfNeeded().catch(() => {});
  await moveTo(page, l);
  await page.evaluate(() => { const c = document.getElementById('__cursor'); if (c) c.style.transform = 'scale(.75)'; });
  await l.click({ timeout: 4000 }).catch((e) => console.log('   (clic fallito su', String(sel) + ')', e.message.split('\n')[0]));
  await page.evaluate(() => { const c = document.getElementById('__cursor'); if (c) c.style.transform = 'scale(1)'; });
  await sleep(wait);
  return true;
}
async function typeIn(page, sel, value) {
  const l = typeof sel === 'string' ? page.locator(sel).first() : sel;
  if (!(await l.count().catch(() => 0))) { console.log('   (manca campo:', String(sel), ')'); return false; }
  await moveTo(page, l); await l.click().catch(() => {});
  await l.pressSequentially(value, { delay: 55 }).catch(() => l.fill(value));
  return true;
}
const waitAI = (page, ms = 45000) => page.waitForFunction(() => !/Sto preparando|sta scrivendo|ci sta pensando|Sto pensando|Preparo|Guardo come ti senti/i.test(document.body.innerText), null, { timeout: ms }).catch(() => {});
const scrollTo = async (page, y, ms = 900) => { await page.evaluate((y) => { const el = document.querySelector('[data-scroll], main, .screen') || document.scrollingElement; (el || window).scrollTo({ top: y, behavior: 'smooth' }); window.scrollTo({ top: y, behavior: 'smooth' }); }, y); await sleep(ms); };

const browser = await chromium.launch({ executablePath: EXE });
const manifest = [];

async function scene(id, run, { kind = 'app', slide = null, userId = 'demo', extra = 0 } = {}) {
  if (ONLY && !ONLY.has(id)) return;
  const want = (dur[id] || 8) + hold[id] + 1.4 + extra;
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, userAgent: UA, locale: 'it-IT',
    recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
  });
  if (kind === 'app') await ctx.addInitScript(([k, u]) => { try { if (u) localStorage.setItem(k, u); else localStorage.removeItem(k); localStorage.setItem('passopasso.voice', 'off'); } catch {} }, [USER_KEY, userId]);
  const page = await ctx.newPage();
  const t0 = Date.now();
  console.log(`▶ ${id} (${want.toFixed(1)} s)`);
  try {
    if (kind === 'slide') {
      await page.goto('file://' + path.join(here, 'slides.html') + `?s=${slide}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(want * 1000);
    } else {
      page.on('load', () => page.evaluate(CURSOR).catch(() => {}));
      await run(page);
      const left = want * 1000 - (Date.now() - t0);
      if (left > 0) await page.waitForTimeout(left);
    }
  } catch (e) { console.log('   errore scena:', e.message.split('\n')[0]); }
  const video = page.video();
  await ctx.close();
  const file = await video.path();
  const final = path.join(outDir, `${id}.webm`);
  fs.renameSync(file, final);
  manifest.push({ id, file: final, recorded: (Date.now() - t0) / 1000, voice: dur[id], kind });
  console.log(`   ok ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}

async function open(page, route, ms = 1200) {
  await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => {});
  await page.evaluate(CURSOR).catch(() => {});
  await page.waitForTimeout(ms);
}
const tab = (page, name) => click(page, page.getByRole('link', { name: new RegExp('^' + name + '$', 'i') }).or(page.getByText(new RegExp('^' + name + '$'))).last(), { wait: 1400 });

// Reset del demo prima di registrare.
await fetch(APP + '/api/demo/reset', { method: 'POST', headers: { 'User-Agent': UA } }).catch(() => {});

// ---- Scene ----
await scene('B01', null, { kind: 'slide', slide: 1 });
await scene('B02', null, { kind: 'slide', slide: 2 });
await scene('B03', null, { kind: 'slide', slide: 3 });

await scene('B04', async (p) => {           // seduta zero
  await open(p, '/benvenuto', 1500);
  await click(p, /Prova 5 minuti/i, { wait: 2500 });
  await p.waitForTimeout(3500);
  await click(p, /Salta esercizio/i, { wait: 2500 });
  await p.waitForTimeout(2500);
}, { userId: null });

await scene('B05', async (p) => {           // scheda
  await open(p, '/benvenuto', 800);
  await click(p, /Costruisci il mio percorso/i, { wait: 1500 });
  await typeIn(p, 'input[name="name"], input[placeholder*="nome" i], input[type="text"]', 'Giulia');
  await p.waitForTimeout(1500);
  await scrollTo(p, 500);
  await p.waitForTimeout(1500);
  await click(p, /Avanti|Continua/, { wait: 1800 });
  await p.waitForTimeout(2500);
  await scrollTo(p, 400);
}, { userId: null });

await scene('B06', async (p) => {           // onboarding a chat (demo: mostra la conversazione)
  await open(p, '/benvenuto', 600);
  await click(p, /Costruisci il mio percorso/i, { wait: 1200 });
  await p.goto(APP + '/onboarding', { waitUntil: 'networkidle' }).catch(() => {});
  await p.evaluate(CURSOR).catch(() => {});
  await p.waitForTimeout(1500);
  await waitAI(p); await click(p, /Correre|Vorrei|Quasi|Cammin|Muovermi|forma/i, { wait: 1200 });
  await waitAI(p);
  if (await typeIn(p, 'textarea, input[type="text"]', 'Tre giorni a settimana, venti minuti')) { await p.keyboard.press('Enter'); await p.waitForTimeout(800); }
  await waitAI(p);
  await p.waitForTimeout(2500);
}, { userId: null, extra: 4 });

await scene('B07', async (p) => {           // home con prontezza e check-in
  await open(p, '/', 2200);
  await click(p, /^Inizia/, { wait: 1600 });
  await click(p, /^15/, { wait: 900 });
  await click(p, /Bassa|Scarica/i, { wait: 900 });
  await click(p, p.locator('svg circle[cy="296"]').first(), { wait: 1200 });
});

await scene('B08', async (p) => {           // seduta rigenerata
  await open(p, '/', 800);
  await click(p, /^Inizia/, { wait: 900 });
  await click(p, /^15/, { wait: 400 });
  await click(p, p.locator('svg circle[cy="296"]').first(), { wait: 400 });
  await click(p, /Prepara/i, { wait: 800 });
  await waitAI(p);
  await p.waitForTimeout(3000);
}, { extra: 3 });

await scene('B09', null, { kind: 'slide', slide: 4 });

await scene('B10', async (p) => {           // perché questa seduta + bandiera rossa
  await open(p, '/', 600);
  await click(p, /^Inizia/, { wait: 800 });
  await click(p, /^15/, { wait: 300 });
  await click(p, p.locator('svg circle[cy="296"]').first(), { wait: 300 });
  await click(p, /Prepara/i, { wait: 600 });
  await waitAI(p);
  await click(p, /Come l'ha costruita/i, { wait: 2000 });
  await p.waitForTimeout(5000);
  await p.keyboard.press('Escape').catch(() => {});
  await p.mouse.click(300, 300).catch(() => {});
  await p.waitForTimeout(400);
  await open(p, '/', 500);
  await click(p, /^Inizia/, { wait: 700 });
  await click(p, /sintomo insolito/i, { wait: 900 });
  await click(p, /petto/i, { wait: 600 });
  await click(p, /Prepara/i, { wait: 800 });
  await p.waitForTimeout(3000);
}, { extra: 4 });

await scene('B11', async (p) => {           // feedback, test, livello
  await open(p, '/', 600);
  await p.goto(APP + '/test', { waitUntil: 'networkidle' }).catch(() => {});
  await p.evaluate(CURSOR).catch(() => {});
  await p.waitForTimeout(2200);
  await click(p, /Inizia il test/i, { wait: 1500 });
  await click(p, /Via, 30 secondi|Via/i, { wait: 1500 });
  for (let i = 0; i < 7; i++) { await click(p, /tocca a ogni alzata/i, { wait: 600 }); }
  await p.waitForTimeout(2500);
});

await scene('B12', async (p) => {           // skip gate: il tuo perché
  await open(p, '/settimana', 1500);
  await click(p, 'Oggi non ce la faccio', { wait: 2000 });
  await p.waitForTimeout(3500);
});

await scene('B13', async (p) => {           // ripartenza
  await open(p, '/settimana', 800);
  await click(p, 'Oggi non ce la faccio', { wait: 1200 });
  await click(p, /Oggi salto davvero/i, { wait: 1500 });
  await click(p, /Non ho tempo/i, { wait: 1500 });
  await waitAI(p);
  await p.waitForTimeout(3500);
}, { extra: 2 });

await scene('B14', async (p) => {           // coach proattivo
  await open(p, '/coach', 2500);
  await scrollTo(p, 250, 1500);
  await p.waitForTimeout(2500);
});

await scene('B15', async (p) => {           // cibo
  await open(p, '/cibo', 2200);
  await click(p, /percorso/i, { wait: 1800 });
  await p.waitForTimeout(2500);
  await scrollTo(p, 400, 1500);
});

await scene('B16', async (p) => {           // cresce con te (demo-runner)
  await open(p, '/percorso', 2800);
  await tab(p, 'Settimana'); await p.waitForTimeout(2600);
  await open(p, '/coach/salute', 3200);
  await open(p, '/widget', 3000);
}, { userId: 'demo-runner', extra: 1 });

await scene('B17', async (p) => {           // perché funziona, i miei dati
  await open(p, '/scienza', 2500);
  await scrollTo(p, 400, 1800);
  await open(p, '/coach/dati', 2500);
});

await scene('B18', null, { kind: 'slide', slide: 5 });
await scene('B19', null, { kind: 'slide', slide: 6 });
await scene('B20', null, { kind: 'slide', slide: 7 });

await browser.close();
fs.writeFileSync(path.join(outDir, ONLY ? 'manifest-partial.json' : 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('fatto:', manifest.length, 'clip');
