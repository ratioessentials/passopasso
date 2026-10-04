// Controllo dei contenuti verificati. Node senza dipendenze.
// Uso: node content/validate.mjs   (esce con codice 1 se trova errori)
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = dirname(fileURLToPath(import.meta.url));
const ZONES = ['collo', 'spalle', 'schiena_alta', 'schiena_bassa', 'petto', 'braccia', 'polsi', 'anche', 'ginocchia', 'caviglie'];
const CATEGORIES = ['riscaldamento', 'cardio', 'forza', 'mobilita', 'defaticamento'];
const EQUIPMENT = ['sedia', 'muro', 'tappetino', 'scalino', 'elastico', 'manubri'];
const WIN_TYPES = {
  sessions_done: true, restart_done: false, level_reached: true, habit_week_done: true,
  minutes_total: true, consistency_at_least: true, week_complete: true, meal_photos: true,
  adapted_session_done: false, feedback_count: true,
};
const MOTIONS = ['marcia', 'camminata_veloce', 'corsetta', 'corsa', 'scatto', 'squat', 'affondo', 'ponte', 'plank', 'flessioni_muro', 'polpacci', 'rotazioni_braccia', 'rotazioni_anche', 'allungamento', 'respirazione', 'jumping_jack', 'step'];
const ICONS = ['star', 'flag', 'heart', 'bolt', 'leaf', 'trophy', 'sun', 'sprout', 'shoe', 'clock', 'camera', 'water', 'calendar', 'shield', 'medal', 'smile'];
const FORBIDDEN_FOOD_WORDS = /calori|kcal|\bpeso\b|chil[oi]|dimagr|bilancia\b|grass[oi] corpore/i;
// mini-onboarding alimentare (profile.food): valori ammessi
const FOOD_FIELDS = {
  breakfast: (v) => typeof v === 'boolean',
  veggiesPerDay: (v) => isInt(v, 0, 10),
  sugaryDrinks: (v) => ['mai', 'a_volte', 'spesso'].includes(v),
  mealsOut: (v) => isInt(v, 0, 21),
  cooks: (v) => ['mai', 'raramente', 'a_volte', 'spesso'].includes(v),
};
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
    if (exercises.length < 45 || exercises.length > 90) warn('exercises.json', `${exercises.length} esercizi (obiettivo 45-90)`);
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
      if (typeof x.impact !== 'boolean') err(w, 'impact deve essere booleano');
      else if (['corsetta', 'corsa', 'scatto'].includes(x.motion) && !x.impact) err(w, 'corsa e scatti devono avere impact: true');
      if (!('motion' in x)) err(w, 'motion mancante (usa null)');
      else if (x.motion !== null && !MOTIONS.includes(x.motion)) err(w, `motion non valido: ${x.motion}`);
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
        // i rami con elastico o manubri regrediscono a corpo libero senza togliere la catena principale
        const loaded = (z) => z.equipment.some((q) => q === 'elastico' || q === 'manubri');
        if (y[back] !== x.id && loaded(x) === loaded(y)) warn(w, `${k} "${t}" non punta indietro (${back} = ${y[back]})`);
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
function checkSegment(where, sg, inner = false) {
  if (!isStr(sg?.label)) err(where, 'segmento senza label');
  if (!(typeof sg?.minutes === 'number' && sg.minutes > 0 && sg.minutes <= 120)) err(where, `segmento "${sg?.label}": minutes non valido`);
  if (!MOTIONS.includes(sg?.motion)) err(where, `segmento "${sg?.label}": motion non valido`);
  if (!isInt(sg?.rpe, 1, 10)) err(where, `segmento "${sg?.label}": rpe 1-10`);
  if (sg?.repeat !== undefined) {
    if (inner) err(where, 'recovery non può avere repeat');
    if (!isInt(sg.repeat, 2, 20)) err(where, `segmento "${sg.label}": repeat 2-20`);
    if (!sg.recovery) err(where, `segmento "${sg.label}": con repeat serve recovery`);
    else checkSegment(where, sg.recovery, true);
  }
}
function segMinutes(sgs) { return sgs.reduce((a, s) => a + s.minutes * (s.repeat ?? 1) + (s.recovery ? s.recovery.minutes * s.repeat : 0), 0); }
function checkRun(where, l) {
  const kinds = new Set(Object.keys(l.runSessions));
  for (const k of l.runWeek?.pattern ?? []) if (k !== 'forza' && k !== 'qualita' && !kinds.has(k)) err(where, `runWeek: seduta "${k}" non definita`);
  for (const k of l.runWeek?.qualita ?? []) if (!kinds.has(k)) err(where, `runWeek.qualita: seduta "${k}" non definita`);
  if ((l.runWeek?.pattern ?? []).length !== l.sessionsPerWeek) err(where, 'runWeek.pattern deve avere sessionsPerWeek sedute');
  for (const [k, rsn] of Object.entries(l.runSessions)) {
    const w = `${where}.runSessions.${k}`;
    if (!isStr(rsn.title) || !Array.isArray(rsn.segments) || !rsn.segments.length) { err(w, 'title e segments obbligatori'); continue; }
    rsn.segments.forEach((sg) => checkSegment(w, sg));
    const tot = segMinutes(rsn.segments);
    if (tot < 15 || tot > 120) err(w, `durata totale ${tot} min fuori scala`);
  }
  const pr = l.progression;
  if (!pr || !(pr.longRunStartMin < pr.longRunMaxMin) || !isInt(pr.deloadEvery, 2, 8) || !(pr.maxWeeklyIncrease > 0 && pr.maxWeeklyIncrease <= 0.1)) err(where, 'progression non valida (regola del 10%, scarico)');
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
    // senza impatto (impactAllowed = false) deve restare abbastanza scelta
    const soft = pool.filter((x) => !x.impact);
    if (soft.length < b.count) err(where, `${b.category} senza impatto: restano ${soft.length} esercizi su ${b.count}`);
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
  // percorsi
  const TRACKS = ['corsa', 'forza', 'mobilita'];
  const tracks = program.tracks;
  if (!tracks || typeof tracks !== 'object') err('program.json', 'tracks mancante');
  else {
    for (const t of TRACKS) if (!tracks[t]) err('program.json', `percorso mancante: ${t}`);
    if (!TRACKS.includes(program.defaultTrack)) err('program.json', 'defaultTrack non valido');
    for (const [tid, tr] of Object.entries(tracks)) {
      const tw = `program.json[tracks.${tid}]`;
      if (!TRACKS.includes(tid)) err(tw, 'percorso sconosciuto');
      if (!isStr(tr.name) || !isStr(tr.tagline)) err(tw, 'name e tagline obbligatori');
      if (!Array.isArray(tr.levels) || tr.levels.length !== 5) { err(tw, 'servono 5 livelli'); continue; }
      tr.levels.forEach((l, i) => {
        const w = `${tw}[livello ${l.n}]`;
        if (l.n !== i + 1) err(w, 'n deve andare da 1 a 5 in ordine');
        if (!isStr(l.verb) || !isStr(l.goal)) err(w, 'verb e goal obbligatori');
        if (!isInt(l.sessionsPerWeek, 2, 6)) err(w, 'sessionsPerWeek non valido');
        checkTemplate(w, l.sessionTemplate);
        checkCoverage(w, l.n, l.sessionTemplate);
        if (l.n < 5) {
          const r = l.readiness;
          if (!r || !isInt(r.minSessions, 1, 50) || !isInt(r.minConsistency, 0, 100) || !isInt(r.maxHardFeedbackLast3, 0, 3)) err(w, 'readiness non valida');
        }
        if (l.runSessions) checkRun(w, l);
      });
    }
    for (const n of [4, 5]) if (!tracks.corsa?.levels?.[n - 1]?.runSessions) err('program.json[tracks.corsa]', `il livello ${n} deve avere runSessions`);
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
      if (!Array.isArray(h.signals)) err(w, 'signals deve essere un array (anche vuoto)');
      else for (const sg of h.signals) {
        if (!(sg.field in FOOD_FIELDS)) err(w, `signal: campo sconosciuto ${sg.field}`);
        else if (!['eq', 'in', 'lte', 'gte'].includes(sg.op)) err(w, `signal: op non valido ${sg.op}`);
        else {
          const vals = sg.op === 'in' ? sg.value : [sg.value];
          if (!Array.isArray(vals) || !vals.every((v) => FOOD_FIELDS[sg.field](v))) err(w, `signal ${sg.field}: valore non valido ${JSON.stringify(sg.value)}`);
        }
        if (!isStr(sg.why)) err(w, 'signal senza why');
      }
    });
  }
}

// --- fuel.json ---
const fuel = load('fuel.json');
if (fuel) {
  const slots = Object.keys(fuel.slots ?? {});
  const types = Object.keys(fuel.types ?? {});
  if (slots.join() !== 'mattina,pranzo,sera') err('fuel.json', 'slots: mattina, pranzo, sera');
  if (!['leggera', 'forza', 'corsa', 'corsa_lunga'].every((t) => types.includes(t))) err('fuel.json', 'types: leggera, forza, corsa, corsa_lunga');
  for (const sl of slots) for (const t of types) {
    const a = (fuel.advice ?? []).filter((x) => x.slot === sl && x.type === t);
    if (a.length !== 1) err('fuel.json', `serve un consiglio per ${sl}/${t}`);
    else if (!isStr(a[0].before) || !isStr(a[0].after)) err('fuel.json', `${sl}/${t}: before e after obbligatori`);
  }
  for (const k of ['corsa', 'forza', 'mobilita']) if (!isStr(fuel.trackNotes?.[k])) err('fuel.json', `trackNotes.${k} mancante`);
  if (!isStr(fuel.safety)) err('fuel.json', 'safety mancante');
  const txt = JSON.stringify(fuel.advice) + JSON.stringify(fuel.trackNotes);
  if (FORBIDDEN_FOOD_WORDS.test(txt) || /\d+\s*(g|gr|grammi|ml|kcal)\b/i.test(txt)) err('fuel.json', 'niente quantità, calorie o peso');
}

// --- tests.json ---
const tests = load('tests.json');
if (tests) {
  const byId = new Map((tests.tests ?? []).map((x) => [x.id, x]));
  for (const id of ['sit_to_stand_30s', 'marcia_1min']) if (!byId.has(id)) err('tests.json', `test mancante: ${id}`);
  for (const x of tests.tests ?? []) {
    const w = `tests.json[${x.id}]`;
    for (const k of ['title', 'measures', 'unit', 'safety']) if (!isStr(x[k])) err(w, `${k} mancante`);
    if (!['atLeast', 'atMost'].includes(x.direction)) err(w, 'direction: atLeast | atMost');
    if (!strArr(x.instructions, 3)) err(w, 'servono almeno 3 istruzioni');
    if (!isStr(x.norms?.source) || !/^https?:\/\//.test(x.norms?.url ?? '')) err(w, 'norms: fonte e link obbligatori');
  }
  const sts = byId.get('sit_to_stand_30s');
  if (sts) {
    const bands = sts.norms.bands ?? [];
    for (let a = 16; a <= 100; a++) if (bands.filter((b) => a >= b.ageMin && a <= b.ageMax).length !== 1) { err('tests.json[sit_to_stand_30s]', `età ${a}: serve esattamente una fascia`); break; }
    for (const b of bands) for (const s of ['f', 'm']) if (!(Array.isArray(b[s]) && b[s][0] < b[s][1])) err('tests.json[sit_to_stand_30s]', `fascia ${b.ageMin}-${b.ageMax}: ${s} non valido`);
    for (const n of ['2', '3', '4', '5']) if (!Number.isInteger(sts.levelBonus?.[n])) err('tests.json[sit_to_stand_30s]', `levelBonus.${n} mancante`);
    for (const t of ['corsa', 'forza', 'mobilita']) if (!Number.isInteger(sts.trackAdjust?.[t])) err('tests.json[sit_to_stand_30s]', `trackAdjust.${t} mancante`);
  }
  const m1 = byId.get('marcia_1min');
  if (m1 && (!Array.isArray(m1.scale) || m1.scale.length !== 11 || !isInt(m1.target, 1, 10))) err('tests.json[marcia_1min]', 'scala 0-10 e target obbligatori');
}

// --- science.json ---
const science = load('science.json');
if (science) {
  if (!Array.isArray(science) || science.length < 8) err('science.json', 'servono almeno 8 voci');
  else {
    uniqueIds('science.json', science);
    for (const x of science) {
      const w = `science.json[${x.id}]`;
      for (const k of ['claim', 'source', 'inApp']) if (!isStr(x[k])) err(w, `${k} mancante`);
      if (!/^https:\/\//.test(x.url ?? '')) err(w, 'url https obbligatorio');
    }
  }
}

// --- red_flags.json ---
const flags = load('red_flags.json');
const allKeywords = [];
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
      const kw = f.keywords;
      if (!Array.isArray(kw) || kw.length < 6 || kw.length > 12) err(w, 'keywords: servono 6-12 parole o espressioni');
      else for (const k of kw) {
        if (!isStr(k) || k !== k.toLowerCase().trim()) err(w, `keyword non valida (minuscole, senza spazi ai bordi): ${JSON.stringify(k)}`);
        allKeywords.push([k, f.id]);
      }
    }
    if (!flags.some((f) => f.urgent)) err('red_flags.json', 'serve almeno una bandiera urgente');
    const seenKw = new Map();
    for (const [k, id] of allKeywords) {
      if (seenKw.has(k) && seenKw.get(k) !== id) warn('red_flags.json', `keyword "${k}" in ${seenKw.get(k)} e ${id}`);
      seenKw.set(k, id);
    }
    // frasi innocue che non devono far scattare un blocco
    const SAFE = ['oggi ho poco tempo', 'questa settimana lavoro di sera', 'ho un po\' di male alle ginocchia', 'mi sento stanco', 'voglio correre di più', 'ho i muscoli indolenziti dopo ieri', 'mi fanno male le gambe dopo la corsa', 'dopo la corsa ho il fiato corto', 'ho il ginocchio un po\' gonfio', 'faccio gli allungamenti del petto', 'questa settimana ho poco tempo'];
    for (const t of SAFE) for (const [k, id] of allKeywords) if (t.includes(k)) err('red_flags.json', `keyword "${k}" (${id}) scatta sulla frase innocua "${t}"`);
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
      if (r.type === 'feedback_count' && !['facile', 'giusto', 'duro'].includes(r.feedback)) err(w, 'feedback_count: serve feedback facile | giusto | duro');
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
