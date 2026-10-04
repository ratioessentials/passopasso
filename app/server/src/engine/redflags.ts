import { content, type RedFlag } from '../content.js';

/**
 * Parole chiave di riserva per le bandiere rosse di content/red_flags.json.
 * Se il file ha un campo `keywords`, si aggiungono a queste.
 */
const FALLBACK_KEYWORDS: Record<string, string[]> = {
  dolore_petto: ['dolore al petto', 'male al petto', 'oppressione', 'peso sul petto', 'stretta al petto', 'fitta al petto', 'dolore toracico', 'petto mi fa male'],
  svenimento_capogiri: ['svenuto', 'svenuta', 'svenimento', 'sono svenut', 'mi gira la testa', 'giramenti di testa', 'capogiri', 'vertigini', 'quasi svenut', 'perso i sensi'],
  fiato_corto_riposo: ['fiato corto anche da fermo', 'fiato corto a riposo', 'non riesco a respirare', 'manca il respiro', 'manca il fiato', 'fatico a respirare', 'respiro male'],
  palpitazioni: ['palpitazioni', 'cuore impazzito', 'battito irregolare', 'tachicardia', 'cuore a mille', 'battito accelerato', 'extrasistoli', 'il cuore salta'],
  debolezza_improvvisa: ['formicolio al braccio', 'braccio addormentato', 'bocca storta', 'non riesco a parlare', 'debolezza improvvisa', 'metà del corpo', 'vista offuscata', 'parlo male'],
  trauma_articolare: ['storta', 'distorsione', 'slogat', 'caduta', 'sono caduto', 'sono caduta', 'botta', 'gonfio dopo', 'gonfiore dopo', 'non riesco ad appoggiare'],
  febbre: ['febbre', 'influenza', 'brividi', 'ho la temperatura', 'covid', 'febbricola'],
  dolore_schiena_gamba: ['sciatica', 'scende lungo la gamba', 'formicolio alla gamba', 'gamba addormentata', 'scossa alla gamba', 'dolore che scende'],
  gravidanza_senza_ok: ['incinta', 'gravidanza', 'aspetto un bambino', 'aspetto una bambina', 'sono al mese'],
};

const NEGATIONS = ['non ho', 'non ho più', 'nessun', 'nessuna', 'niente', 'senza', 'mai avuto', 'non mi', 'non sono', 'non è', 'passata', 'passato'];

export const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ').replace(/\s+/g, ' ');

function keywordsOf(flag: RedFlag & { keywords?: unknown }): string[] {
  const fromFile = Array.isArray(flag.keywords) ? flag.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length >= 3) : [];
  return [...new Set([...(FALLBACK_KEYWORDS[flag.id] ?? []), ...fromFile].map(normalize))];
}

/** Il primo sintomo da bandiera rossa descritto nel testo, se c'è. Deterministico: niente AI. */
export function detectRedFlag(text: string): RedFlag | null {
  const t = normalize(text);
  const hits: RedFlag[] = [];
  for (const flag of content.redFlags()) {
    for (const kw of keywordsOf(flag)) {
      let idx = t.indexOf(kw);
      while (idx >= 0) {
        // "non ho dolore al petto", "nessuna febbre": negazione nelle ~4 parole prima
        const before = t.slice(Math.max(0, idx - 30), idx);
        const negated = NEGATIONS.some((n) => before.includes(n)) && !/\b(ma|pero|invece)\b/.test(before);
        if (!negated) { hits.push(flag); break; }
        idx = t.indexOf(kw, idx + kw.length);
      }
      if (hits.includes(flag)) break;
    }
  }
  return hits.find((f) => f.urgent) ?? hits[0] ?? null;
}
