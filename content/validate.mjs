// Controllo dei contenuti verificati. Node senza dipendenze.
// Uso: node content/validate.mjs   (esce con codice 1 se trova errori)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ZONES = ['collo', 'spalle', 'schiena_alta', 'schiena_bassa', 'petto', 'braccia', 'polsi', 'anche', 'ginocchia', 'caviglie'];
const CATEGORIES = ['riscaldamento', 'cardio', 'forza', 'mobilita', 'defaticamento'];
const EQUIPMENT = ['sedia', 'muro', 'tappetino', 'scalino'];
const WIN_TYPES = {
  sessions_done: true, restart_done: false, level_reached: true, habit_week_done: true,
  minutes_total: true, consistency_at_least: true, week_complete: true, meal_photos: true,
  adapted_session_done: false, feedback_count: true,
};
const ICONS = ['star', 'flag', 'heart', 'bolt', 'leaf', 'trophy', 'sun', 'sprout', 'shoe', 'clock', 'camera', 'water', 'calendar', 'shield', 'medal', 'smile'];
const FORBIDDEN_FOOD_WORDS = /calori|kcal|\bpeso\b|chil[oi]|dimagr|bilancia|grass[oi] corpore/i;
const ID_RE = /^[a-z0-9]+(_[a-z0-9]+)*$/;

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`${where}: ${msg}`);

function load(name) {
  const p = join(DIR, name);
  if (!existsSync(p)) { err(name, 'file mancante'); return null; }
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { err(name, `JSON non valido (${e.message})`); return null; }
}
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const strArr = (v, min = 1) => Array.isArray(v) && v.length >= min && v.every(isStr);

function uniqueIds(file, arr) {
  const seen = new Set();
  for (const x of arr) {
    if (!isStr(x?.id) || !ID_RE.test(x.id)) err(file, `id non valido: ${JSON.stringify(x?.id)}`);
    else if (seen.has(x.id)) err(file, `id duplicato: ${x.id}`);
    seen.add(x?.id);
  }
  return seen;
}

// --- exercises.json ---
const exercises = load('exercises.json');
const exById = new Map();
if (exercises) {
  if (!Array.isArray(exercises)) err('exercises.json', 'deve essere un array');
  else {
    uniqueIds('exercises.json', exercises);
    for (const x of exercises) exById.set(x.id, x);
    if (exercises.length < 45 || exercises.length > 60) warn('exercises.json', `${exercises.length} esercizi (obiettivo 45-60)`);
    for (const x of exercises) {
      const w = `exercises.json[${x.id}]`;
      if (!isStr(x.name)) err(w, 'name mancante');
      if (!CATEGORIES.includes(x.category)) err(w, `category non valida: ${x.category}`);
      if (!isInt(x.minLevel, 1, 5)) err(w, 'minLevel deve essere 1-5');
      if (!Array.isArray(x.zones) || !x.zones.every((z) => ZONES.includes(z))) err(w, `zones non valide: ${JSON.stringify(x.zones)}`);
      if (!Array.isArray(x.equipment) || !x.equipment.every((q) => EQUIPMENT.includes(q))) err(w, `equipment non valido: ${JSON.stringify(x.equipment)}`);
      const p = x.prescription;
      if (!p || !['reps', 'seconds'].includes(p.type) || !isInt(p.default, 1, 3600)) err(w, 'prescription non valida');
      if (!strArr(x.instructions, 3) || x.instructions.length > 4) err(w, 'instructions: servono 3-4 passi');
      if (!strArr(x.commonMistakes, 1)) err(w, 'commonMistakes mancante');
      if (typeof x.formCheck !== 'boolean') err(w, 'formCheck deve essere booleano');
      if (x.formCheck && !/squat|alzat/.test(x.id)) err(w, 'formCheck: true solo sugli squat');
      for (const k of ['regression', 'progression']) {
        if (!(k in x)) err(w, `${k} mancante (usa null)`);
      }
    }
    // catene coerenti
    for (const x of exercises) {
      const w = `exercises.json[${x.id}]`;
      for (const k of ['regression', 'progression']) {
        const t = x[k];
        if (t === null) continue;
        const y = exById.get(t);
        if (!y) { err(w, `${k} "${t}" non esiste`); continue; }
        if (t === x.id) err(w, `${k} punta a se stesso`);
        if (k === 'regression' && y.minLevel > x.minLevel) err(w, `regression "${t}" ha minLevel più alto`);
        if (k === 'progression' && y.minLevel < x.minLevel) err(w, `progression "${t}" ha minLevel più basso`);
        const back = k === 'regression' ? 'progression' : 'regression';
        if (y[back] !== x.id) warn(w, `${k} "${t}" non punta indietro (${back} = ${y[back]})`);
      }
      // niente cicli lungo le progressioni
      const seen = new Set([x.id]);
      let cur = x.progression;
      while (cur) {
        if (seen.has(cur)) { err(w, 'ciclo nelle progressioni'); break; }
        seen.add(cur);
        cur = exById.get(cur)?.progression ?? null;
      }
    }
  }
}

// --- program.json ---
const program = load('program.json');
function checkTemplate(where, t) {
  if (!t || !isInt(t.minutes, 5, 120)) err(where, 'sessionTemplate.minutes non valido');
  if (!Array.isArray(t?.blocks) || !t.blocks.length) { err(where, 'sessionTemplate.blocks mancante'); return; }
  for (const b of t.blocks) {
    if (!CATEGORIES.includes(b.category)) err(where, `blocco con category non valida: ${b.category}`);
    if (!isInt(b.count, 1, 10)) err(where, `blocco ${b.category}: count non valido`);
    if (b.seconds !== undefined && !isInt(b.seconds, 30, 3600)) err(where, `blocco ${b.category}: seconds non valido`);
  }
}
function checkCoverage(where, level, t) {
  if (!exercises || !Array.isArray(t?.blocks)) return;
  const avail = exercises.filter((x) => x.minLevel <= level);
  for (const b of t.blocks) {
    const pool = avail.filter((x) => x.category === b.category);
    // serve un po' di scelta: almeno il doppio di quelli richiesti (minimo count + 2)
    const need = Math.max(b.count * 2, b.count + 2);
    if (pool.length < b.count) err(where, `${b.category}: ${pool.length} esercizi, ne servono ${b.count}`);
    else if (pool.length < need) err(where, `${b.category}: solo ${pool.length} esercizi disponibili (minimo ${need} per variare)`);
    // senza attrezzatura
    const free = pool.filter((x) => x.equipment.length === 0);
    if (free.length < 1) warn(where, `${b.category}: nessun esercizio a corpo libero`);
    // con dolore in una zona deve restare almeno un esercizio
    for (const z of ZONES) {
      const left = pool.filter((x) => !x.zones.includes(z));
      if (left.length < b.count) warn(where, `${b.category} con dolore a "${z}": restano ${left.length} esercizi su ${b.count}`);
    }
  }
}
if (program) {
  const levels = program.levels;
  if (!Array.isArray(levels) || levels.length !== 5) err('program.json', 'servono 5 livelli');
  else {
    let minW = 0, maxW = 0;
    levels.forEach((l, i) => {
      const w = `program.json[livello ${l.n}]`;
      if (l.n !== i + 1) err(w, 'n deve andare da 1 a 5 in ordine');
      for (const k of ['name', 'verb', 'goal']) if (!isStr(l[k])) err(w, `${k} mancante`);
      if (!Array.isArray(l.weeks) || l.weeks.length !== 2 || !(l.weeks[0] <= l.weeks[1])) err(w, 'weeks deve essere [min, max]');
      else { minW += l.weeks[0]; maxW += l.weeks[1]; }
      if (!isInt(l.sessionsPerWeek, 2, 6)) err(w, 'sessionsPerWeek non valido');
      checkTemplate(w, l.sessionTemplate);
      checkCoverage(w, l.n, l.sessionTemplate);
      if (l.n < 5) {
        const r = l.readiness;
        if (!r || !isInt(r.minSessions, 1, 50) || !isInt(r.minConsistency, 0, 100) || !isInt(r.maxHardFeedbackLast3, 0, 3)) err(w, 'readiness non valida');
      } else if (l.readiness !== null) warn(w, "l'ultimo livello di solito ha readiness null");
    });
    if (minW > 12 || maxW < 12) warn('program.json', `durata complessiva ${minW}-${maxW} settimane (obiettivo circa 12)`);
    const names = levels.map((l) => l.name).join(',');
    if (names !== 'Attivazione,Fondamenta,Costruzione,Slancio,Autonomia') err('program.json', `nomi dei livelli inattesi: ${names}`);
  }
  const rs = program.restartSession;
  if (!rs) err('program.json', 'restartSession mancante');
  else {
    checkTemplate('program.json[restartSession]', rs.sessionTemplate);
    checkCoverage('program.json[restartSession]', 1, rs.sessionTemplate);
    if (rs.bonusPoints !== 10) err('program.json[restartSession]', 'bonusPoints deve essere 10');
    if (levels && rs.sessionTemplate?.minutes >= levels[0].sessionTemplate.minutes) err('program.json[restartSession]', 'deve essere più leggera del livello 1');
  }
}

// --- habits.json ---
const habits = load('habits.json');
if (habits) {
  if (!Array.isArray(habits) || habits.length !== 12) err('habits.json', 'servono 12 abitudini');
  else {
    uniqueIds('habits.json', habits);
    habits.forEach((h, i) => {
      const w = `habits.json[${h.id}]`;
      if (h.week !== i + 1) err(w, `week deve essere ${i + 1}`);
      for (const k of ['title', 'why', 'photoPrompt']) if (!isStr(h[k])) err(w, `${k} mancante`);
      if (!strArr(h.tips, 2)) err(w, 'servono almeno 2 tips');
      if (FORBIDDEN_FOOD_WORDS.test(JSON.stringify(h))) err(w, 'niente calorie, peso o bilancia');
    });
  }
}

// --- red_flags.json ---
const flags = load('red_flags.json');
if (flags) {
  if (!Array.isArray(flags) || flags.length < 6 || flags.length > 10) err('red_flags.json', 'servono 6-10 bandiere rosse');
  else {
    uniqueIds('red_flags.json', flags);
    for (const f of flags) {
      const w = `red_flags.json[${f.id}]`;
      if (!isStr(f.label) || !isStr(f.message)) err(w, 'label e message obbligatori');
      if (typeof f.urgent !== 'boolean') err(w, 'urgent deve essere booleano');
      if (!/medic/i.test(f.message ?? '')) err(w, 'il messaggio deve consigliare di sentire un medico');
      if (f.urgent && !/112/.test(f.message ?? '')) err(w, 'i sintomi urgenti devono citare il 112');
    }
    if (!flags.some((f) => f.urgent)) err('red_flags.json', 'serve almeno una bandiera urgente');
  }
}

// --- wins.json ---
const wins = load('wins.json');
if (wins) {
  if (!Array.isArray(wins) || wins.length < 15 || wins.length > 20) err('wins.json', 'servono 15-20 vittorie');
  else {
    uniqueIds('wins.json', wins);
    for (const v of wins) {
      const w = `wins.json[${v.id}]`;
      if (!isStr(v.title) || !isStr(v.condition)) err(w, 'title e condition obbligatori');
      if (!ICONS.includes(v.icon)) err(w, `icon non valida: ${v.icon}`);
      const r = v.rule;
      if (!r || !(r.type in WIN_TYPES)) { err(w, `rule.type non valido: ${r?.type}`); continue; }
      if (WIN_TYPES[r.type] && !(typeof r.value === 'number' && r.value > 0)) err(w, `rule.value obbligatorio per ${r.type}`);
      if (r.type === 'level_reached' && !isInt(r.value, 2, 5)) err(w, 'level_reached: value 2-5');
      if (FORBIDDEN_FOOD_WORDS.test(JSON.stringify(v))) err(w, 'niente vittorie legate alla bilancia');
    }
  }
}

// --- copy.json ---
const copy = load('copy.json');
if (copy) {
  if (typeof copy !== 'object' || Array.isArray(copy)) err('copy.json', 'deve essere un oggetto chiave → testo');
  else {
    const required = ['onboarding.hello', 'skip.title', 'restart.title', 'blocked.title', 'levelup.title', 'feedback.facile', 'feedback.giusto', 'feedback.duro', 'empty.wins'];
    for (const k of required) if (!isStr(copy[k])) err('copy.json', `chiave mancante: ${k}`);
    for (const [k, v] of Object.entries(copy)) {
      if (!/^[a-z]+(\.[a-zA-Z0-9_]+)+$/.test(k)) err('copy.json', `chiave non valida: ${k}`);
      if (!isStr(v)) err('copy.json', `${k}: testo vuoto`);
      if (/\b(dovevi|avresti dovuto|pigr|fallit|deluso|vergogn)/i.test(v)) err('copy.json', `${k}: tono colpevolizzante`);
    }
  }
}

for (const w of warnings) console.log(`  avviso  ${w}`);
for (const e of errors) console.log(`  ERRORE  ${e}`);
if (errors.length) {
  console.log(`\n✗ ${errors.length} errori, ${warnings.length} avvisi`);
  process.exit(1);
}
console.log(`✓ contenuti validi (${exercises?.length} esercizi, ${habits?.length} abitudini, ${flags?.length} bandiere rosse, ${wins?.length} vittorie, ${Object.keys(copy ?? {}).length} testi; ${warnings.length} avvisi)`);
