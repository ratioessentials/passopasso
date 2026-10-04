// Smoke test dell'API: node scripts/smoke.mjs [baseUrl]   (default http://localhost:3210 o $SMOKE_URL)
const BASE = process.argv[2] || process.env.SMOKE_URL || `http://localhost:${process.env.PORT || 3210}`;
let failures = 0;

async function api(method, path, { user, body } = {}) {
  const t0 = Date.now();
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(user ? { 'x-user-id': user } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json, ms: Date.now() - t0 };
}

function check(name, cond, extra = '') {
  console.log(`${cond ? '✓' : '✗'} ${name}${extra ? `  ${extra}` : ''}`);
  if (!cond) failures++;
}

const health = await api('GET', '/api/health');
check('health', health.status === 200 && health.json?.ok, `ai=${health.json?.ai}`);

// --- utente demo ---
const me = await api('GET', '/api/me', { user: 'demo' });
check('demo: /me', me.status === 200 && me.json.level.n === 2, `livello ${me.json?.level?.n}, costanza ${me.json?.consistency}, vittorie ${me.json?.wins?.length}`);
const week = await api('GET', '/api/week', { user: 'demo' });
check('demo: /week', week.status === 200 && Array.isArray(week.json.sessions), `${week.json?.sessions?.length} sedute`);
const widget = await api('GET', '/api/widget/demo');
check('widget pubblico', widget.status === 200 && widget.json.week.length === 7, JSON.stringify(widget.json?.week?.map((d) => d.status)));
const progress = await api('GET', '/api/progress', { user: 'demo' });
check('demo: /progress', progress.status === 200 && progress.json.sessionsDone > 0, `${progress.json?.sessionsDone} sedute, ${progress.json?.minutesTotal} min`);
const runner = await api('GET', '/api/me', { user: 'demo-runner' });
const segs = runner.json?.today?.segments;
check('demo-runner: livello 4, corsa a segmenti', runner.status === 200 && runner.json.level.n === 4 && Array.isArray(segs) && segs.length >= 3, `${runner.json?.today?.title}, ${runner.json?.today?.minutes} min`);
const levels = await api('GET', '/api/levels', { user: 'demo' });
check('/levels', levels.status === 200 && levels.json.levels.length === 5 && levels.json.current === 2);

// --- nuovo utente: onboarding (6 risposte) ---
const created = await api('POST', '/api/users');
const uid = created.json?.userId;
check('nuovo utente', created.status === 201 && /^u_/.test(uid), uid);
const card = await api('POST', '/api/onboarding/profile', { user: uid, body: {
  name: 'Marco', age: 52, sex: 'm', heightCm: 178, weightKg: 96, job: 'seduto', sleepHours: 6,
  health: { heartCondition: false, chestPain: false, dizziness: false, jointIssue: true, medication: false, pregnancy: false, otherCondition: false, notes: '' } } });
check('scheda salvata (problema articolare: niente prudenza)', card.status === 200 && card.json.ok && card.json.caution === false, card.json?.cautionMessage);
const answers = ['Marco', 'Quasi mai', 'Correre 20 minuti senza fermarmi', '3 giorni, 20 minuti', 'Una sedia', 'Ginocchia', 'Sera'];
const messages = [{ role: 'assistant', content: 'Ciao! Come ti chiami?' }];
let onboarding;
for (const a of answers) {
  messages.push({ role: 'user', content: a });
  onboarding = await api('POST', '/api/onboarding/message', { user: uid, body: { messages } });
  if (onboarding.status !== 200) break;
  if (onboarding.json.done) break;
  messages.push({ role: 'assistant', content: onboarding.json.reply });
}
// se l'AI vuole un'altra conferma, rispondiamo genericamente
for (let i = 0; i < 4 && onboarding.json && !onboarding.json.done; i++) {
  messages.push({ role: 'user', content: onboarding.json.quickReplies?.[0] || 'Va bene così' });
  onboarding = await api('POST', '/api/onboarding/message', { user: uid, body: { messages } });
  if (!onboarding.json.done) messages.push({ role: 'assistant', content: onboarding.json.reply });
}
check('onboarding completo', onboarding.status === 200 && onboarding.json.done && onboarding.json.profile?.startLevel >= 1,
  `${onboarding.ms} ms, livello ${onboarding.json?.profile?.startLevel}: "${onboarding.json?.reply}"`);

const meNew = await api('GET', '/api/me', { user: uid });
check('il peso non torna mai nel profilo', meNew.json?.profile && !('weightKg' in meNew.json.profile) && meNew.json.profile.impactAllowed === false);
const impactItems = (meNew.json?.today?.items ?? []).filter((i) => i.exercise.impact);
check('niente esercizi ad impatto con problema articolare', impactItems.length === 0, impactItems.map((i) => i.exerciseId).join(','));
const todayId = meNew.json?.today?.id;
check('prima seduta oggi', !!todayId, meNew.json?.today?.title);

// --- check-in con bandiera rossa ---
const blocked = await api('POST', `/api/sessions/${todayId}/checkin`, { user: uid, body: { minutes: 20, energy: 3, pain: [], redFlags: ['dolore_petto'] } });
check('check-in con bandiera rossa → blocked', blocked.json?.status === 'blocked' && !!blocked.json.redFlag?.message, `${blocked.ms} ms`);

// --- check-in normale (AI o regole) ---
const ck = await api('POST', `/api/sessions/${todayId}/checkin`, { user: uid, body: { minutes: 15, energy: 2, pain: ['ginocchia'], redFlags: [] } });
const items = ck.json?.session?.items ?? [];
check('check-in → seduta rigenerata', ck.json?.status === 'ok' && items.length >= 3, `${ck.ms} ms, ${items.length} esercizi, fonte ${ck.json?.session?.source}`);
check('nessun esercizio sulle ginocchia', items.every((i) => !i.exercise.zones.includes('ginocchia')));
console.log(`   reason: ${ck.json?.session?.reason}`);

// --- complete ---
const done = await api('POST', `/api/sessions/${todayId}/complete`, { user: uid, body: { feedback: 'facile' } });
check('complete', done.status === 200 && done.json.intensity === 1.1, `costanza ${done.json?.consistency}, vittorie nuove ${done.json?.newWins?.map((w) => w.id).join(',')}`);

// --- skip della prossima seduta ---
const wk = await api('GET', '/api/week', { user: uid });
const next = wk.json.sessions.find((s) => s.status === 'planned');
if (next) {
  const sk = await api('POST', `/api/sessions/${next.id}/skip`, { user: uid, body: { reason: 'tempo' } });
  check('skip → ripartenza con bonus', sk.status === 200 && sk.json.restart?.kind === 'ripartenza' && sk.json.restart.bonusPoints > 0, `${sk.json?.message} → ${sk.json?.restart?.date}`);
} else {
  console.log('  (nessuna altra seduta questa settimana: skip provato sul demo)');
}

// --- demo: complete della seduta di oggi → proposta di livello ---
const demoToday = me.json?.today;
if (demoToday && demoToday.status === 'planned') {
  const d = await api('POST', `/api/sessions/${demoToday.id}/complete`, { user: 'demo', body: { feedback: 'giusto' } });
  check('demo: complete → levelUp', d.status === 200 && d.json.levelUp?.to === 3, JSON.stringify(d.json?.levelUp));
  const noTest = await api('POST', '/api/level/accept', { user: 'demo' });
  check('demo: senza test non si sale', noTest.status === 409 && noTest.json.error.code === 'test_required');
  const tests = await api('GET', '/api/level/test', { user: 'demo' });
  const results = Object.fromEntries(tests.json.tests.map((t) => [t.id, t.direction === 'atMost' ? t.target : t.target + 2]));
  check('test di prontezza: target per età e sesso', tests.status === 200 && tests.json.tests.length >= 2, tests.json.tests.map((t) => `${t.id}→${t.target}`).join(', '));
  const sub = await api('POST', '/api/level/test', { user: 'demo', body: { results } });
  check('test superato → levelUp', sub.json?.passed === true && sub.json.levelUp?.to === 3, sub.json?.message);
  const acc = await api('POST', '/api/level/accept', { user: 'demo' });
  check('demo: accetta livello 3', acc.status === 200 && acc.json.level.n === 3);
}
const demoWeek = await api('GET', '/api/week', { user: 'demo' });
const demoNext = demoWeek.json.sessions.find((s) => s.status === 'planned');
if (demoNext) {
  const sk = await api('POST', `/api/sessions/${demoNext.id}/skip`, { user: 'demo', body: { reason: 'stanchezza' } });
  check('demo: skip', sk.status === 200 && sk.json.restart?.bonusPoints > 0, sk.json?.message);
}

// --- coach e calendario (utente nuovo) ---
const coachRf = await api('POST', '/api/coach/message', { user: uid, body: { messages: [{ role: 'user', content: 'Stamattina mi girava la testa e sono quasi svenuto' }] } });
check('coach: bandiera rossa sul testo', coachRf.status === 200 && !!coachRf.json.redFlag, `${coachRf.ms} ms, ${coachRf.json?.redFlag?.id}`);
const coachNeg = await api('POST', '/api/coach/message', { user: uid, body: { messages: [{ role: 'user', content: 'Non ho febbre, tutto bene. Questa settimana però ho poco tempo, al massimo 15 minuti' }] } });
check('coach: modifica del piano', coachNeg.status === 200 && !coachNeg.json.redFlag && Array.isArray(coachNeg.json.applied), `${coachNeg.ms} ms, applied ${JSON.stringify(coachNeg.json?.applied)}`);
console.log(`   reply: ${coachNeg.json?.reply}`);
const badCal = await api('POST', '/api/calendar/connect', { user: uid, body: { icsUrl: 'non è un link' } });
check('calendario: link non valido → errore gentile', badCal.status === 422 && !!badCal.json?.error?.message, badCal.json?.error?.message);
const cal = await api('POST', '/api/calendar/connect', { user: uid, body: { icsUrl: `${BASE}/api/calendar/demo.ics` } });
check('calendario demo collegato', cal.status === 200 && cal.json.ok && cal.json.freeSlots.length > 0, `${cal.json?.eventsNext7Days} impegni, "${cal.json?.suggestion}"`);
const move = await api('POST', '/api/coach/message', { user: uid, body: { messages: [
  { role: 'assistant', content: cal.json?.suggestion ?? '' }, { role: 'user', content: 'Sì, spostale negli spazi liberi' }] } });
check('coach: sposta negli spazi liberi', move.status === 200 && move.json.applied.some((a) => /spazi liberi|riorganizzata/i.test(a)), `${move.ms} ms, ${JSON.stringify(move.json?.applied)}`);
const unlink = await api('DELETE', '/api/calendar', { user: uid });
check('calendario scollegato', unlink.status === 200 && unlink.json.ok);

// --- prudenza (PAR-Q+) e minorenni ---
const u2 = (await api('POST', '/api/users')).json.userId;
const c2 = await api('POST', '/api/onboarding/profile', { user: u2, body: { name: 'Anna', age: 61, sex: 'f', heightCm: 160, weightKg: 70, job: 'in_piedi', sleepHours: 7,
  health: { heartCondition: true, chestPain: false, dizziness: false, jointIssue: false, medication: true, pregnancy: false, otherCondition: false, notes: 'Pressione alta' } } });
check('PAR-Q+ con un sì → prudenza e messaggio', c2.json?.caution === true && !!c2.json.cautionMessage, c2.json?.cautionMessage);
const m2 = [{ role: 'assistant', content: 'Ciao!' }];
let o2;
for (const a of ['Camminare senza fiatone', 'Quasi mai', '3 giorni, 20 minuti', 'Una sedia', 'Nessuna', 'Mattina', 'Va bene', 'Ok']) {
  m2.push({ role: 'user', content: a });
  o2 = await api('POST', '/api/onboarding/message', { user: u2, body: { messages: m2 } });
  if (o2.json?.done) break;
  m2.push({ role: 'assistant', content: o2.json.reply });
}
const me2 = await api('GET', '/api/me', { user: u2 });
const cats = new Set((me2.json?.today?.items ?? []).map((i) => i.exercise.category));
check('prudenza: niente forza nella seduta', o2.json?.done && me2.json?.profile?.caution === true && !cats.has('forza'), [...cats].join(','));
const ok2 = await api('POST', '/api/coach/message', { user: u2, body: { messages: [{ role: 'user', content: 'Il medico mi ha dato il via libera per allenarmi' }] } });
check('coach: via libera del medico → prudenza disattivata', ok2.status === 200 && (await api('GET', '/api/me', { user: u2 })).json.profile.caution === false, JSON.stringify(ok2.json?.applied));
const patch = await api('PATCH', '/api/me/profile', { user: u2, body: { sleepHours: 5.5 } });
check('PATCH della scheda', patch.status === 200 && patch.json.profile.sleepHours === 5.5 && !('weightKg' in patch.json.profile));
const u3 = (await api('POST', '/api/users')).json.userId;
const c3 = await api('POST', '/api/onboarding/profile', { user: u3, body: { name: 'Leo', age: 14, sex: 'm', job: 'seduto', sleepHours: 9 } });
const o3 = await api('POST', '/api/onboarding/message', { user: u3, body: { messages: [{ role: 'assistant', content: 'Ciao!' }, { role: 'user', content: 'Voglio correre' }] } });
check('minore di 16 anni → nessun piano', c3.json?.minor === true && o3.json?.minor === true && o3.json.done === true, o3.json?.reply);

// --- Health Bridge, push, piani ---
const demoMe = await api('GET', '/api/me', { user: 'demo' });
check('demo: prontezza media dai dati salute', demoMe.json?.readiness?.level === 'media' && demoMe.json.readiness.suggestedEnergy === 2, demoMe.json?.readiness?.signals?.join(' · '));
const tok = await api('GET', '/api/health/token', { user: uid });
check('token personale', /^ht_/.test(tok.json?.token ?? ''));
const todayNew = (await api('GET', '/api/week', { user: uid })).json.sessions.find((s) => s.status === 'planned');
const res = await fetch(`${BASE}/api/health/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-health-token': tok.json.token },
  body: JSON.stringify({ source: 'apple_health', steps: '8200', restingHr: 61, hrv: 40, sleepMinutes: 420,
    workouts: todayNew ? [{ type: 'walk', start: `${todayNew.date}T07:10:00+02:00`, minutes: 32, distanceKm: 3.1, avgHr: 112 }] : [] }) });
const ing = await res.json();
check('ingest dal Comando rapido', res.status === 200 && ing.ok && res.headers.get('access-control-allow-origin') === '*', `importati ${ing.imported}`);
const bad = await fetch(`${BASE}/api/health/ingest`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-health-token': 'ht_falso' }, body: '{}' });
check('ingest con token sbagliato → 401', bad.status === 401);
const sum = await api('GET', '/api/health/summary', { user: uid });
check('riepilogo salute', sum.status === 200 && sum.json.sources.find((x) => x.id === 'apple_health')?.connected && sum.json.history.length === 14);
const vap = await api('GET', '/api/push/vapid');
check('chiave VAPID pubblica', typeof vap.json?.publicKey === 'string' && vap.json.publicKey.length > 40);
const subOk = await api('POST', '/api/push/subscribe', { user: uid, body: { subscription: { endpoint: 'https://example.invalid/push/abc', keys: { p256dh: 'x', auth: 'y' } }, reminderMinutesBefore: 60 } });
check('iscrizione alle notifiche', subOk.status === 200 && subOk.json.ok);
await api('DELETE', '/api/push/subscribe', { user: uid });
const plans = await api('GET', '/api/plans');
check('piani', plans.status === 200 && plans.json.demo === true && Array.isArray(plans.json.plans));

const hab = await api('POST', '/api/habit/checkin', { user: uid });
check('habit checkin', hab.status === 200 && hab.json.doneDays >= 1);

const err = await api('GET', '/api/me', { user: 'u_nonesiste' });
check('errore nel formato del contratto', err.status === 404 && !!err.json?.error?.message, err.json?.error?.message);

await api('POST', '/api/demo/reset');
console.log(failures ? `\n${failures} controlli falliti` : '\nTutto ok');
process.exit(failures ? 1 : 0);
