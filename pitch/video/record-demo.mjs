// Registra la demo come UNA sola ripresa continua: l'iPhone resta fisso, una manina tocca le aree
// mentre la voce spiega. Per ogni battuta salva il tempo d'inizio (marker): il montaggio ci mette la voce.
// Uso: node pitch/video/record-demo.mjs <cartella-voce> <cartella-output> [urlApp]
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const [voiceDir, outDir, APP = 'https://passopasso.andreavallieri.com'] = process.argv.slice(2);
const battute = JSON.parse(fs.readFileSync(path.join(voiceDir, 'battute.json'), 'utf8'));
const B = Object.fromEntries(battute.map((b) => [b.id, b]));
fs.mkdirSync(outDir, { recursive: true });
const EXE = '/root/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36';
const USER_KEY = 'passopasso.userId';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// La manina: un'icona fissa in sovrimpressione che si muove con una molla e "preme".
const HAND = `(() => {
  if (document.getElementById('__hand')) return;
  const h = document.createElement('div'); h.id = '__hand';
  h.innerHTML = '<svg width="44" height="52" viewBox="0 0 44 52"><defs><filter id="hs" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#0E2025" flood-opacity=".45"/></filter></defs><g filter="url(#hs)"><path d="M16 46V24a3.5 3.5 0 017 0v9l1-19a3.5 3.5 0 017 0v19l1-14a3.5 3.5 0 017 0v16l1-8a3 3 0 016 0v13c0 7-5 13-13 13H24c-5 0-8-3-11-8l-6-10a3.2 3.2 0 015-4l4 5z" fill="#FFF7EE" stroke="#2C6975" stroke-width="2.2" stroke-linejoin="round"/></g></svg>';
  h.style.cssText = 'position:fixed;left:-80px;top:-80px;width:44px;height:52px;z-index:999999;pointer-events:none;transform-origin:30% 10%;transition:left .55s cubic-bezier(.2,.9,.25,1.05),top .55s cubic-bezier(.2,.9,.25,1.05),transform .12s;will-change:left,top';
  document.body.appendChild(h);
})();`;

let page, t0;
const now = () => (Date.now() - t0) / 1000;
const markers = [];
const log = (...a) => console.log(`[${now().toFixed(1)}s]`, ...a);

async function hand() { await page.evaluate(HAND).catch(() => {}); }
async function moveTo(x, y) { await page.evaluate(([x, y]) => { const h = document.getElementById('__hand'); if (h) { h.style.left = x - 13 + 'px'; h.style.top = y - 6 + 'px'; } }, [x, y]); await sleep(650); }
async function pressAnim() { await page.evaluate(() => { const h = document.getElementById('__hand'); if (h) h.style.transform = 'scale(.86) translateY(3px)'; }); await sleep(130); await page.evaluate(() => { const h = document.getElementById('__hand'); if (h) h.style.transform = 'none'; }); }
function loc(sel) {
  if (typeof sel !== 'string' && !(sel instanceof RegExp)) return sel;
  return page.getByRole('button', { name: sel }).or(page.getByRole('link', { name: sel })).or(page.getByText(sel)).first();
}
async function tap(sel, { wait = 900, timeout = 2500, fast = false } = {}) {
  const l = loc(sel);
  await hand();
  try { await l.waitFor({ state: 'visible', timeout }); } catch { log('  manca:', String(sel)); return false; }
  await l.scrollIntoViewIfNeeded().catch(() => {});
  const box = await l.boundingBox().catch(() => null);
  if (box && !fast) await moveTo(box.x + box.width / 2, box.y + box.height / 2);
  if (!fast) await pressAnim();
  await l.click({ timeout: 3000 }).catch(async () => { if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {}); });
  await sleep(wait);
  return true;
}
async function typeIn(sel, value) {
  const l = page.locator(sel).first();
  try { await l.waitFor({ state: 'visible', timeout: 4000 }); } catch { log('  manca campo:', sel); return false; }
  const box = await l.boundingBox().catch(() => null);
  if (box) await moveTo(box.x + 30, box.y + box.height / 2);
  await l.click().catch(() => {});
  await l.pressSequentially(value, { delay: 60 }).catch(() => l.fill(value));
  return true;
}
const waitAI = (ms = 45000) => page.waitForFunction(() => !/Sto preparando|sta scrivendo|ci sta pensando|Sto pensando|Preparo|Guardo come ti senti|Guardo i risultati/i.test(document.body.innerText), null, { timeout: ms }).catch(() => {});
async function go(route, ms = 1500) { await page.goto(APP + route, { waitUntil: 'networkidle' }).catch(() => {}); await hand(); await sleep(ms); }
async function setUser(u) { await page.evaluate(([k, u]) => { try { if (u) localStorage.setItem(k, u); else localStorage.removeItem(k); } catch {} }, [USER_KEY, u]); }
async function scrollBy(y, ms = 1200) { await page.mouse.move(960, 540); await page.mouse.wheel(0, y); await sleep(ms); }
const tab = (name) => tap(page.getByRole('link', { name: new RegExp(name, 'i') }).last(), { wait: 1500 });

// Una battuta: segna il tempo, esegue le azioni, poi aspetta che la voce (più l'eventuale pausa) sia finita.
async function beat(id, actions) {
  const b = B[id];
  const start = now();
  markers.push({ id, at: start });
  log('▶', id, b.text.slice(0, 50));
  try { await actions(); } catch (e) { log('  errore:', e.message.split('\n')[0]); }
  const end = start + b.seconds + (b.hold || 0) + 0.5;
  const left = end - now();
  if (left > 0) await sleep(left * 1000);
  else log(`  (azioni più lunghe della voce di ${(-left).toFixed(1)} s)`);
}

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, userAgent: UA, locale: 'it-IT',
  recordVideo: { dir: outDir, size: { width: 1920, height: 1080 } },
});
await ctx.addInitScript(() => { try { localStorage.setItem('passopasso.voice', 'off'); } catch {} });
await fetch(APP + '/api/demo/reset', { method: 'POST', headers: { 'User-Agent': UA } }).catch(() => {});
page = await ctx.newPage();
t0 = Date.now();
page.on('load', () => page.evaluate(HAND).catch(() => {}));

// ---------- la ripresa ----------
await go('/benvenuto', 1200);
await setUser(null);
await go('/benvenuto', 800);

await beat('B04', async () => {                 // seduta zero
  await tap(/Prova 5 minuti/i, { wait: 2600 });
  await sleep(2600);
  await tap(/Salta esercizio/i, { wait: 2200 });
  await tap(/Salta esercizio/i, { wait: 1500 });
});

await beat('B05', async () => {                 // la scheda
  await go('/scheda', 1200);
  await typeIn('input[name="name"], input[placeholder*="nome" i], input[type="text"]', 'Giulia');
  await sleep(900);
  await scrollBy(420, 1400);
  await tap(/Avanti/, { wait: 1600 });
  await scrollBy(300, 1200);
});

await beat('B06', async () => {                 // onboarding a chat
  await go('/onboarding', 1200);
  await waitAI();
  await tap(/Correre|Vorrei|Quasi|Cammin|Muovermi|forma|Sentirmi/i, { wait: 1000 });
  await waitAI();
  if (await typeIn('input[placeholder="Scrivi qui…"], input[type="text"], textarea', 'Tre giorni a settimana, venti minuti')) { await page.keyboard.press('Enter'); }
  await waitAI(20000);
});

await beat('B07', async () => {                 // home con prontezza, check-in
  await setUser('demo');
  await go('/', 2000);
  await tap(/^Inizia/, { wait: 1500 });
  await tap(/^15/, { wait: 700 });
  await tap(/^Bassa/i, { wait: 700 });
  await tap(page.locator('svg circle[r="34"][cy="296"]').first(), { wait: 900 });
});

await beat('B08', async () => {                 // seduta rigenerata
  await tap(/Prepara la mia seduta/i, { wait: 500 });
  await waitAI();
  await sleep(1500);
});

await beat('B09', async () => {                 // perché non inventa: il foglio con esclusioni e 7 controlli
  if (await tap(/Come l'ha costruita/i, { wait: 2500 })) { await sleep(6000); await scrollBy(260, 2500); await scrollBy(260, 2500); }
  else { await scrollBy(300, 3000); await scrollBy(300, 3000); await scrollBy(-600, 2000); }
});

await beat('B10', async () => {                 // chiudi il foglio, bandiera rossa
  await page.keyboard.press('Escape').catch(() => {});
  await page.mouse.click(300, 900).catch(() => {});
  await sleep(800);
  await go('/', 900);
  await tap(/^Inizia/, { wait: 1000 });
  await scrollBy(500, 800);
  await tap(/sintomo insolito/i, { wait: 1000 });
  await tap(/petto/i, { wait: 800 });
  await tap(/Prepara la mia seduta/i, { wait: 1200 });
});

await beat('B11', async () => {                 // feedback della seduta di oggi → proposta del test
  const me = await fetch(APP + '/api/me', { headers: { 'User-Agent': UA, 'X-User-Id': 'demo' } }).then((r) => r.json()).catch(() => null);
  const sid = me?.today?.id;
  if (sid) { await go(`/feedback/${sid}`, 1500); await tap(/^Giusto/i, { wait: 1500 }); await waitAI(20000); await sleep(2500); }
  if (!(await tap(/Facciamo il test/i, { wait: 1500 }))) await go('/test', 1200);
});

await beat('B11b', async () => {                // il test e il livello
  await tap(page.getByRole('button', { name: /Via, 30 secondi/i }), { wait: 500 });
  const counter = page.locator('button:has(div.font-title)').first();
  await tap(counter, { wait: 250, timeout: 1500 });
  for (let i = 0; i < 6; i++) await tap(counter, { wait: 250, timeout: 1200, fast: true });
  await tap(/Ho finito prima/i, { wait: 600 });
  const plus = page.getByRole('button', { name: /^\+$/ });
  await tap(plus, { wait: 200, timeout: 1500 });
  for (let i = 0; i < 6; i++) await tap(plus, { wait: 160, timeout: 1200, fast: true });
  await tap(/Conferma/i, { wait: 1000 });
  await tap(page.getByRole('button', { name: /Via/i }), { wait: 1200 });
  await tap(/Ho finito prima/i, { wait: 600 });
  await tap(page.getByRole('button', { name: /^4$/ }), { wait: 400 });
  await tap(/Conferma/i, { wait: 1000 });
  await waitAI(15000);
  await sleep(1200);
  await tap(/Passa al livello/i, { wait: 1500 });
  await sleep(3000);
});

await beat('B12', async () => {                 // il tuo perché, prima di saltare
  await fetch(APP + '/api/demo/reset', { method: 'POST', headers: { 'User-Agent': UA } }).catch(() => {});
  await go('/settimana', 1400);
  await tap('Oggi non ce la faccio', { wait: 1500 });
});

await beat('B13', async () => {                 // ripartenza
  await tap(/Oggi salto davvero/i, { wait: 1200 });
  await tap(/Non ho tempo/i, { wait: 1200 });
  await waitAI();
  await tap(/Va bene/i, { wait: 1200 });
});

await beat('B14', async () => {                 // coach proattivo
  await tab('Coach');
  await sleep(1200);
  await scrollBy(200, 1500);
});

await beat('B15', async () => {                 // cibo
  await tab('Cibo');
  await sleep(1200);
  await tap(/percorso alimentare/i, { wait: 1800 });
  await scrollBy(380, 1800);
});

await beat('B16', async () => {                 // cresce con te: il corridore
  await setUser('demo-runner');
  await go('/percorso', 2600);
  await tab('Settimana'); await sleep(2800);
  await go('/coach/salute', 3200);
  await go('/widget', 2500);
});

await beat('B17', async () => {                 // fonti e dati
  await go('/scienza', 2000);
  await scrollBy(350, 1800);
  await go('/coach/dati', 1800);
});

const endAt = now();
await sleep(800);
const video = page.video();
await ctx.close();
const file = await video.path();
const final = path.join(outDir, 'demo.webm');
fs.renameSync(file, final);
fs.writeFileSync(path.join(outDir, 'markers.json'), JSON.stringify({ file: final, end: endAt, markers }, null, 2));
await browser.close();
console.log('fatto: demo continua di', endAt.toFixed(1), 's, marker:', markers.map((m) => `${m.id}@${m.at.toFixed(1)}`).join(' '));
